import * as THREE from 'three';
import * as Comlink from 'comlink';

import { Game } from './game';
import { GameECS } from './gameECS';
import { RealmRPCs, ChunkGenerationResult } from '../workers/realm';
import { ExportedRealmJson, loadExportedRealm } from './storage';
import { hideRealmExportedOptions, showRealmExportedOptions } from './tools';

import { getObjPath, ObjPath } from './obj/obj';
import { createBaseRealm } from './obj/realm';
import {
  Cell, Located,
  getChunkEntityComponents, createChunk, getChunkAndCell, afterChunkChanged,
  mergeChunk, destroy as destroyChunk,
} from './chunk/chunk';
import { addChunkMeshToScene, removeChunkMeshFromScene } from './chunk/render';
import { addOrRefreshSubObjToScene, destroySubObj } from './subObj/subObj';

import { EntityRef, entityEqual } from './utils/ecs';
import { createCanvas2d } from './utils/web';
import { Vec2, warnIfNotPresent, rangeVec2s } from './utils/utils';
import { listenToWorkerNextValue } from './utils/worker';
import Map2D from './utils/map2d';

import { CHUNK_SIZE } from './consts';

type RealmState = 'inited' | 'changed' | 'saved';
export interface Realm {
  currentObj: EntityRef;
  loadedExternal: boolean;
  state: RealmState,
  markChanged: () => void,
  prevChunks?: Map2D<EntityRef>;
  light: THREE.DirectionalLight;
  worker: Comlink.Remote<RealmRPCs>;
  emptyMaterial: THREE.Material;
  gridMaterial: THREE.Material;
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
    loadedExternal: false,
    state: 'inited',
    markChanged: () => {},
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

  game.realm.markChanged = () => {
    markChanged(game);
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

export function switchRealm(realmObjPath: ObjPath, json: ExportedRealmJson, game: Game) {
  const currentRealmObjComponents = game.ecs.getEntityComponents(game.realm.currentObj);

  game.realm.prevChunks = currentRealmObjComponents.get('obj/realm').chunks;
  game.ecs.deallocate(game.realm.currentObj);
  game.realm.currentObj = loadExportedRealm(realmObjPath, json, game.ecs);
  markUnchanged(game, 'inited');
  game.realm.loadedExternal = game.storage.savedRealmObjPath !== realmObjPath;
  resetRealm(game);
}

export function adjustTerrain(altitudeChange: number, flatness: number, range: number, located: Located, game: Game) {
  const { chunkIJ, cellIJ } = located;

  const updatedCells = new Map2D<Cell>();

  rangeVec2s(cellIJ, range).map(cellIJ => {
    const [chunk, cell] = getChunkAndCell(chunkIJ, cellIJ, game.realm.currentObj, game.ecs);
    cell.altitude += altitudeChange;
    updatedCells.put(...cellIJ, cell);
    afterChunkChanged(chunk, game);
  })

  rangeVec2s(cellIJ, range + 1).map(cellIJ => {
    const [chunk, cell] = getChunkAndCell(chunkIJ, cellIJ, game.realm.currentObj, game.ecs);
    cell.flatness = flatness;
    updatedCells.put(...cellIJ, cell);
    afterChunkChanged(chunk, game);
  })

  game.realm.worker.updateCells(chunkIJ, updatedCells.entries());
}

export function markChanged(game: Game) {
  hideRealmExportedOptions(game);
  game.realm.state = 'changed';
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
