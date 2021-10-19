import * as THREE from 'three';
import * as Comlink from 'comlink';

import { EntityRef } from './utils/ecs';
import { Vec2 } from './utils/utils';
import { spawnWorker, listenToWorkerNextValue } from './utils/worker';
import Map2D from './utils/map2d';

import { Cell } from './chunk/chunk';
import { createChunkMesh } from './chunk/render';
import { RealmWorker } from './worker/realm';
import { Game } from './game';
import { GameECS } from './gameECS';
import { ChunkGenerationResult } from './worker/realm';
import { updateSpritePosition } from './subObj/spriteRender';

import { backgrounds } from './dev-data';

export interface Realm {
  currentObj: EntityRef;
  worker: Comlink.Remote<RealmWorker>;
}

export function init(ecs: GameECS): Realm {
  const currentObj = ecs.allocate();
  const worker = spawnWorker<RealmWorker>('realm');

  // TODO: built-in empty realm:
  ecs.setComponent(currentObj, 'obj/realm', {
    chunks: new Map2D(),
    backgrounds,
  });

  // TODO: load realm asynchronously, adding subObjs

  // TODO: transfer realm, chunk entities and components to worker.create()
  worker.create();

  return {
    currentObj,
    worker,
  };
}

export function addToScene(game: Game) {
  const { backgrounds } = game.ecs.getComponent(game.realm.currentObj, 'obj/realm');

  { // TODO: await realm loading completion
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
