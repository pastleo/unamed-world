import * as THREE from 'three';
import { Game } from '../game';
import Obj from '../obj/obj';
import { Cell } from '../obj/chunk';
import { initSprite } from '../sprite';
import { createChunkMesh, reCalcChunkSubObjs } from '../obj/chunk';
import Map2D from '../utils/map2d';
import { Vec2 } from '../utils/utils';
import { service as realmWorker, listenToNextGeneratedChunk, ChunkGenerationResult } from '../worker/realm';

import { createDevRealm } from '../dev-data';

export interface Realm {
  obj: Obj;
  backgrounds: [
    urlPosX: string, urlNegX: string,
    urlPosY: string, urlNegY: string,
    urlPosZ: string, urlPosZ: string
  ];
}

export async function create(): Promise<Realm> {
  const realm = createDevRealm();

  await realmWorker.create();

  return realm;
}

export function addToScene(realm: Realm, loader: THREE.TextureLoader, game: Game) {
  listenToNextGeneratedChunk(result => {
    handleNextGeneratedChunk(result, realm, loader, game);
  });

  realmWorker.triggerRealmGeneration([0, 0]);

  realm.obj.chunks.entries().forEach(([_, chunk]) => {
    reCalcChunkSubObjs(chunk, realm.obj, (subObj, located) => {
      initSprite(subObj, realm.obj, loader, located);
      game.scene.add(subObj.sprite);
    });
  });

  const backgroundLoader = new THREE.CubeTextureLoader();
  const texture = backgroundLoader.load(realm.backgrounds);
  game.scene.background = texture;
  //game.scene.rotation.x = -Math.PI / 2; // because our z is normal coord system's y
}

function handleNextGeneratedChunk(result: ChunkGenerationResult, realm: Realm, loader: THREE.TextureLoader, game: Game) {
  const { chunkI, chunkJ, cellEntries, textureUrl, attributeArrays } = result;

  const cells = Map2D.fromEntries<Cell>(cellEntries);

  let chunk = realm.obj.chunks.get(chunkI, chunkJ);
  if (chunk) {
    chunk.cells = cells;
    chunk.textureUrl = textureUrl;
  } else {
    chunk = {
      cells, textureUrl, subObjs: [],
    }
  }

  if (chunk.mesh) {
    chunk.mesh.removeFromParent();
  }

  chunk.mesh = createChunkMesh(chunk, chunkI, chunkJ, attributeArrays, loader);
  //game.scene.add(chunk.mesh);
}

export function triggerRealmGeneration(_realm: Realm, centerChunkIJ: Vec2, _game: Game) {
  realmWorker.triggerRealmGeneration(centerChunkIJ);
}

// TODO:
// loadRealm
// exportRealm
// ...
