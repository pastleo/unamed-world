import * as THREE from 'three';
import * as Comlink from 'comlink';

import { Game } from './game';
import { GameECS } from './gameECS';
import { RealmRPCs, ChunkGenerationResult } from '../workers/realm';
import { PackedRealmJson, loadExportedRealm } from './storage';
import { hideRealmExportedOptions, showRealmExportedOptions } from './tools';

import { getObjPath, ObjPath } from './obj/obj';
import { createBaseRealm } from './obj/realm';
import {
  Cell, getChunkEntityComponents, createChunk, getChunkAndCell, afterChunkChanged,
  mergeChunk, destroy as destroyChunk,
} from './chunk/chunk';
import { addChunkMeshToScene, removeChunkMeshFromScene, editChunkCanvas2d } from './chunk/render';
import { addOrRefreshSubObjToScene, destroySubObj } from './subObj/subObj';

import { EntityRef, entityEqual } from './utils/ecs';
import { createCanvas2d } from './utils/web';
import { Vec2, warnIfNotPresent, rangeVec2s } from './utils/utils';
import { listenToWorkerNextValue } from './utils/worker';
import Map2D from './utils/map2d';
import SetVec2 from './utils/setVec2';

import { CHUNK_SIZE, DRAW_CANVAS_SIZE, REALM_CHANGED_BROADCAST_INTIVAL } from './consts';

type RealmState = 'inited' | 'changed' | 'saved';
export interface Realm {
  currentObj: EntityRef;
  brandNew: boolean;
  state: RealmState;
  dispatchChunkAction: (action: ChunkAction) => void;
  changedChunkIJs: SetVec2;
  changedBroadcastLoop?: ReturnType<typeof setTimeout>;
  prevChunks?: Map2D<EntityRef>;
  light: THREE.DirectionalLight;
  worker: Comlink.Remote<RealmRPCs>;
  emptyMaterial: THREE.Material;
  gridMaterial: THREE.Material;
}

export interface ChunkAction {
  type: string;
  chunkIJ: Vec2;
}
export interface ChunkDrawAction extends ChunkAction {
  type: 'draw';
  erasing: boolean;
  color: string;
  uv: Vec2;
  radius: number;
}
export interface ChunkTerrainAltitudeAction extends ChunkAction {
  type: 'terrainAltitude';
  cellIJ: Vec2;
  altitudeAdjustment: number;
  flatness: number;
  range: number;
}

export function init(ecs: GameECS): Realm {
  const currentObj = createBaseRealm(ecs);

  const light = new THREE.DirectionalLight(0xFFFFFF, 1);
  light.position.set(0, 1, 0);
  light.target.position.set(0.25, 0, 0);

  const worker = Comlink.wrap<RealmRPCs>(
    new Worker(new URL('../workers/realm', import.meta.url))
  );

  return {
    currentObj,
    brandNew: true,
    state: 'inited',
    dispatchChunkAction: () => {},
    changedChunkIJs: new SetVec2(),
    light,
    worker,
    emptyMaterial: createEmptyMaterial(),
    gridMaterial: createGridMaterial(),
  };
}

export function addToScene(game: Game) {
  game.scene.add(game.realm.light);
  game.scene.add(game.realm.light.target);

  listenToWorkerNextValue(game.realm.worker.nextGeneratedChunk, result => {
    handleNextGeneratedChunk(result, game);
  });

  game.realm.dispatchChunkAction = action => {
    dispatchChunkAction(action, game);
  };

  resetRealm(game);
}

export function resetRealm(game: Game) {
  const { backgrounds } = game.ecs.getComponent(game.realm.currentObj, 'obj/realm');

  const backgroundLoader = new THREE.CubeTextureLoader();
  const texture = backgroundLoader.load(backgrounds);
  game.scene.background = texture;

  (async () => {
    await game.realm.worker.load(getObjPath(game.realm.currentObj, game.ecs));
    await game.realm.worker.triggerRealmGeneration([0, 0]);
  })();
}

export function switchRealm(realmObjPath: ObjPath, json: PackedRealmJson, game: Game) {
  const currentRealmObjComponents = game.ecs.getEntityComponents(game.realm.currentObj);

  game.realm.prevChunks = currentRealmObjComponents.get('obj/realm').chunks;
  game.ecs.deallocate(game.realm.currentObj);
  game.realm.currentObj = loadExportedRealm(realmObjPath, json, game.ecs);
  game.realm.brandNew = false;
  markUnchanged(game, 'inited');
  resetRealm(game);
}

export function dispatchChunkAction(action: ChunkAction, game: Game) {
  switch (action.type) {
    case 'draw':
      draw(action as ChunkDrawAction, game);
      break;
    case 'terrainAltitude':
      adjustTerrain(action as ChunkTerrainAltitudeAction, game);
      break;
    default:
      return console.warn('dispatchChunkAction: unknown action', action);
  }

  hideRealmExportedOptions(game);
  game.realm.state = 'changed';

  game.realm.changedChunkIJs.add(action.chunkIJ);

  if (game.realm.changedBroadcastLoop) return;
  game.realm.changedBroadcastLoop = setTimeout(() => {
    broadcastChanged(game);
  }, REALM_CHANGED_BROADCAST_INTIVAL);
}

function draw(action: ChunkDrawAction, game: Game) {
  const chunkEntityComponents = getChunkEntityComponents(action.chunkIJ, game.realm.currentObj, game.ecs);
  editChunkCanvas2d((canvas2d: CanvasRenderingContext2D) => {
    if (action.erasing) {
      canvas2d.fillStyle = 'rgba(255, 255, 255, 1)';
      canvas2d.globalCompositeOperation = 'destination-out';
    } else {
      canvas2d.fillStyle = action.color;
      canvas2d.globalCompositeOperation = 'source-over';
    }

    canvas2d.beginPath();
    canvas2d.arc(
      DRAW_CANVAS_SIZE * action.uv[0], DRAW_CANVAS_SIZE * (1 - action.uv[1]),
      action.radius,
      0, 2 * Math.PI);
    canvas2d.fill();
  }, chunkEntityComponents, game);

  afterChunkChanged(chunkEntityComponents.get('chunk'));
}

function adjustTerrain(action: ChunkTerrainAltitudeAction, game: Game) {
  const updatedCells = new Map2D<Cell>();

  rangeVec2s(action.cellIJ, action.range).map(cellIJ => {
    const [chunk, cell] = getChunkAndCell(action.chunkIJ, cellIJ, game.realm.currentObj, game.ecs);
    cell.altitude += action.altitudeAdjustment;
    updatedCells.put(...cellIJ, cell);
    afterChunkChanged(chunk);
  });

  rangeVec2s(action.cellIJ, action.range + 1).map(cellIJ => {
    const [chunk, cell] = getChunkAndCell(action.chunkIJ, cellIJ, game.realm.currentObj, game.ecs);
    cell.flatness = action.flatness;
    updatedCells.put(...cellIJ, cell);
    afterChunkChanged(chunk);
  });

  game.realm.worker.updateCells(action.chunkIJ, updatedCells.entries());
}

function broadcastChanged(game: Game) {
  // WIP
}

export function markUnchanged(game: Game, state: 'inited' | 'saved') {
  game.realm.state = state;
  if (state === 'saved') {
    showRealmExportedOptions(game);
  } else {
    hideRealmExportedOptions(game);
  }
}

export function afterSaved(savedRealmObjPath: ObjPath, game: Game) {
  game.storage.savedRealmObjPath = savedRealmObjPath;
  markUnchanged(game, 'saved');
}

function handleNextGeneratedChunk(result: ChunkGenerationResult, game: Game) {
  const { chunkIJ, repeatable, textureUrl, attributeArrays, cellEntries } = result;
  
  let chunkEntityComponents = getChunkEntityComponents(chunkIJ, game.realm.currentObj, game.ecs);
  if (chunkEntityComponents) {
    mergeChunk({
      chunkIJ,
      textureUrl,
      subObjs: [],
      persistance: false,
      repeatable,
      ...(cellEntries ? {
        cells: Map2D.fromEntries<Cell>(cellEntries),
      } : {})
    }, game);
  } else {
    if (warnIfNotPresent(cellEntries)) return;
    const chunkEntity = createChunk({
      chunkIJ,
      textureUrl,
      subObjs: [],
      persistance: false,
      repeatable,
      cells: Map2D.fromEntries<Cell>(cellEntries),
    }, game.realm.currentObj, game.ecs);
    chunkEntityComponents = game.ecs.getEntityComponents(chunkEntity);
  }

  addChunkMeshToScene(chunkEntityComponents, chunkIJ, attributeArrays, game);
  const chunk = chunkEntityComponents.get('chunk');
  chunk.subObjs.forEach(subObjEntity => {
    addOrRefreshSubObjToScene(subObjEntity, game);
  });

  if (game.realm.prevChunks) {
    const prevChunkComponents = game.ecs.getEntityComponents(
      game.realm.prevChunks.get(...chunkIJ)
    );
    if (
      prevChunkComponents &&
      !entityEqual(prevChunkComponents.entity, chunkEntityComponents.entity)
    ) {
      prevChunkComponents.get('chunk').subObjs.forEach(subObjEntity => {
        if (chunk.subObjs.findIndex(sObj => entityEqual(sObj, subObjEntity)) === -1) {
          destroySubObj(subObjEntity, game);
        }
      });

      removeChunkMeshFromScene(prevChunkComponents);
      destroyChunk(prevChunkComponents, game.ecs);
    }

    game.realm.prevChunks.put(...chunkIJ, null);
  }
}

export function triggerRealmGeneration(centerChunkIJ: Vec2, game: Game) {
  game.realm.worker.triggerRealmGeneration(centerChunkIJ);
}

function createEmptyMaterial(): THREE.Material {
  return createMaterial(_ctx => {}, 256, 256);
}
function createGridMaterial(): THREE.Material {
  return createMaterial(ctx => {
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;

    ctx.beginPath();
    const cellSize = ctx.canvas.width / CHUNK_SIZE;
    for(let i = 0; i <= CHUNK_SIZE; i++) {
      const pos = cellSize * i;
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, ctx.canvas.height);
      ctx.moveTo(0, pos);
      ctx.lineTo(ctx.canvas.width, pos);
    }
    ctx.stroke();
  }, 256, 256);
}

export function createMaterial(callback: (ctx: CanvasRenderingContext2D) => void, width: number, height: number): THREE.Material {
  const ctx = createCanvas2d(width, height);

  callback(ctx);

  const texture = new THREE.CanvasTexture(ctx.canvas);
  return new THREE.MeshPhongMaterial({
    map: texture,
    transparent: true,
  });
}
