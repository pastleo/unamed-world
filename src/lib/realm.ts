import * as THREE from 'three';
import * as Comlink from 'comlink';

import { Game } from './game';
import { GameECS } from './gameECS';
import { RealmRPCs, ChunkGenerationResult } from '../workers/realm';
import { ExportedRealmJson, loadExportedRealm } from './storage';

import { createBaseRealm } from './obj/realm';
import {
  Cell, getChunkEntityComponents, createChunk, mergeChunk, destroy as destroyChunk,
} from './chunk/chunk';
import { addChunkMeshToScene, removeChunkMeshFromScene } from './chunk/render';
import { addOrRefreshSubObjToScene, destroySubObj } from './subObj/subObj';

import { EntityRef, entityEqual } from './utils/ecs';
import { Vec2, warnIfNotPresent } from './utils/utils';
import { listenToWorkerNextValue } from './utils/worker';
import Map2D from './utils/map2d';

import { CHUNK_SIZE } from './consts';

export interface Realm {
  currentObj: EntityRef;
  prevChunks?: Map2D<EntityRef>;
  light: THREE.DirectionalLight;
  worker: Comlink.Remote<RealmRPCs>;
  baseMaterial: THREE.Material;
}

export function init(ecs: GameECS): Realm {
  const currentObj = createBaseRealm(ecs);

  const light = new THREE.DirectionalLight(0xFFFFFF, 1);
  light.position.set(0, 1, 0);
  light.target.position.set(0, 0, 0);

  const worker = Comlink.wrap<RealmRPCs>(
    new Worker(new URL('../workers/realm', import.meta.url))
  );

  return {
    currentObj,
    light,
    worker,
    baseMaterial: createBaseMaterial(),
  };
}

export function addToScene(game: Game) {
  game.scene.add(game.realm.light);
  game.scene.add(game.realm.light.target);

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
    await game.realm.worker.load(game.ecs.getUUID(game.realm.currentObj));
    await game.realm.worker.triggerRealmGeneration([0, 0]);
  })();
}

export function switchRealm(objUUID: string, json: ExportedRealmJson, game: Game) {
  const currentRealmObjComponents = game.ecs.getEntityComponents(game.realm.currentObj);

  game.realm.prevChunks = currentRealmObjComponents.get('obj/realm').chunks;
  game.ecs.deallocate(game.realm.currentObj);
  game.realm.currentObj = loadExportedRealm(objUUID, json, game.ecs);
  resetRealm(game);
}

function handleNextGeneratedChunk(result: ChunkGenerationResult, game: Game) {
  const { chunkIJ, textureUrl, attributeArrays, cellEntries } = result;
  
  let chunkEntityComponents = getChunkEntityComponents(chunkIJ, game.realm.currentObj, game.ecs);
  if (chunkEntityComponents) {
    mergeChunk({
      chunkIJ,
      textureUrl,
      subObjs: [],
      persistance: false,
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

function createBaseMaterial(): THREE.Material {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'white';
  ctx.lineWidth = 1;

  ctx.beginPath();
  const cellSize = canvas.width / CHUNK_SIZE;
  for(let i = 0; i <= CHUNK_SIZE; i++) {
    const pos = cellSize * i;
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, canvas.height);
    ctx.moveTo(0, pos);
    ctx.lineTo(canvas.width, pos);
  }
  ctx.stroke();

  const texture = new THREE.CanvasTexture(ctx.canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  return new THREE.MeshPhongMaterial({
    map: texture,
    transparent: true,
  });
}
