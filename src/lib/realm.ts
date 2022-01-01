import * as THREE from 'three';
import * as Comlink from 'comlink';

import { Game } from './game';
import { GameECS } from './gameECS';
import { RealmRPCs, ChunkGenerationResult } from '../workers/realm';
import type { PackedRealmJson } from './resourcePacker';
import { loadPackedRealm } from './resourceLoader';

import { getObjPath, ObjPath } from './obj/obj';
import { createBaseRealm } from './obj/realm';
import {
  Cell, getChunkEntityComponents, createChunk,
  mergeChunk, destroy as destroyChunk,
} from './chunk/chunk';
import { addChunkMeshToScene, removeChunkMeshFromScene } from './chunk/render';
import { addSubObjToScene, destroySubObj } from './subObj/subObj';

import { EntityRef, entityEqual } from './utils/ecs';
import { createCanvas2d } from './utils/web';
import { Vec2, warnIfNotPresent } from './utils/utils';
import { listenToWorkerNextValue } from './utils/worker';
import Map2D from './utils/map2d';

import { CHUNK_SIZE } from './consts';

export interface Realm {
  currentObj: EntityRef;
  brandNew: boolean;
  light: THREE.DirectionalLight;
  ambientLight: THREE.AmbientLight;
  worker: Comlink.Remote<RealmRPCs>;
  emptyMaterial: THREE.Material;
  gridMaterial: THREE.Material;
  prevChunks?: Map2D<EntityRef>;
  rmEditingWhileUpdateChunkTexture?: boolean; // temporary
}

export function init(ecs: GameECS): Realm {
  const currentObj = createBaseRealm(ecs);

  const light = new THREE.DirectionalLight(0xFFFFFF, 1);
  light.position.set(0, 1, 0);
  light.target.position.set(0.25, 0, 0);

  const ambientLight = new THREE.AmbientLight(0x404040);

  const worker = Comlink.wrap<RealmRPCs>(
    new Worker(new URL('../workers/realm', import.meta.url))
  );

  return {
    currentObj,
    brandNew: true,
    light,
    ambientLight,
    worker,
    emptyMaterial: createEmptyMaterial(),
    gridMaterial: createGridMaterial(),
  };
}

export function addToScene(game: Game) {
  game.scene.add(game.realm.light);
  game.scene.add(game.realm.light.target);
  game.scene.add(game.realm.ambientLight);

  listenToWorkerNextValue(game.realm.worker.nextGeneratedChunk, result => {
    handleNextGeneratedChunk(result, game);
  });

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
  game.realm.currentObj = loadPackedRealm(realmObjPath, json, game.ecs);
  game.realm.brandNew = false;
  resetRealm(game);
}

export function afterSaved(savedRealmObjPath: ObjPath, game: Game) {
  game.resource.savedRealmObjPath = savedRealmObjPath;
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
    addSubObjToScene(subObjEntity, game);
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
