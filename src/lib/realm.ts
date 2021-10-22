import * as THREE from 'three';
import * as Comlink from 'comlink';

import { getObjEntity } from './obj/obj';
import { createBaseRealm } from './obj/realm';
import { Cell } from './chunk/chunk';
import { createChunkMesh } from './chunk/render';
import { RealmWorker } from './worker/realm';
import { Game } from './game';
import { GameECS } from './gameECS';
import { ChunkGenerationResult } from './worker/realm';
import { addSubObj } from './subObj/subObj';
import { updateSpritePosition } from './subObj/spriteRender';

import { EntityRef } from './utils/ecs';
import { Vec2 } from './utils/utils';
import { spawnWorker, listenToWorkerNextValue } from './utils/worker';
import Map2D from './utils/map2d';

import { CHUNK_SIZE } from './consts';
import { loadObjSprites } from './dev-data';

export interface Realm {
  currentObj: EntityRef;
  light: THREE.DirectionalLight;
  worker: Comlink.Remote<RealmWorker>;
  baseMaterial: THREE.Material;
}

export function init(ecs: GameECS): Realm {
  const currentObj = createBaseRealm(ecs);

  const light = new THREE.DirectionalLight(0xFFFFFF, 1);
  light.position.set(0, 1, 0);
  light.target.position.set(0, 0, 0);

  const worker = spawnWorker<RealmWorker>('realm');

  return {
    currentObj,
    light,
    worker,
    baseMaterial: createBaseMaterial(),
  };
}

export function addToScene(game: Game) {
  const { backgrounds } = game.ecs.getComponent(game.realm.currentObj, 'obj/realm');

  game.scene.add(game.realm.light);
  game.scene.add(game.realm.light.target);

  {
    // TODO: load realm asynchronously, adding subObjs
    loadObjSprites(game.ecs);
    addSubObj(getObjEntity('hero-1'), [-5, 0, -5], game);
    addSubObj(getObjEntity('flying-bitch-1'), [0, 0, -5], game);
    addSubObj(getObjEntity('giraffe-1'), [5, 0, -5], game);

    // TODO: cache realm, chunk entities and components to localstorage
    //
    // TODO: should not hard-code
    if (window.location.hash === '#/realm-1') {
      game.realm.worker.load('realm-1');
    }

    listenToWorkerNextValue(game.realm.worker.nextGeneratedChunk, result => {
      handleNextGeneratedChunk(result, game.realm, game);
    });

    const backgroundLoader = new THREE.CubeTextureLoader();
    const texture = backgroundLoader.load(backgrounds);
    game.scene.background = texture;

    game.realm.worker.triggerRealmGeneration([0, 0]);
  }
}

function handleNextGeneratedChunk(result: ChunkGenerationResult, realm: Realm, game: Game) {
  const { chunks } = game.ecs.getComponent(realm.currentObj, 'obj/realm');
  const { chunkIJ, cellEntries, textureUrl, attributeArrays } = result;

  const cells = Map2D.fromEntries<Cell>(cellEntries);

  const chunkEntity = chunks.get(...chunkIJ) || game.ecs.allocate();
  let chunk = game.ecs.getComponent(chunkEntity, 'chunk');
  if (chunk) {
    chunk.cells = cells;
    chunk.textureUrl = textureUrl;
  } else {
    chunk = {
      cells, textureUrl,
      chunkIJ,
      chunkEntity,
      subObjs: [], // TODO: add subObj to scene
      persistance: false,
    }

    game.ecs.setComponent(chunkEntity, 'chunk', chunk);
    chunks.put(...chunkIJ, chunkEntity);
  }

  chunk.subObjs.forEach(subObjEntity => {
    // all possible subObj render systems:
    updateSpritePosition(subObjEntity, game);
  })

  createChunkMesh(chunkEntity, chunkIJ, attributeArrays, game);
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
