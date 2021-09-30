import * as THREE from 'three';
import Game from './game';
import { Obj, Chunk, calcChunkMesh, calcChunkSubObjs } from './obj';
import Map2D from './utils/map2d';

import { createRndChunk, createDevChunk1, createDevSubObj, heroObj } from './dev-data';

export interface Realm {
  obj: Obj;
}

export function create(): Realm {
  const chunks = new Map2D<Chunk>();
  chunks.put(-1, -1, createRndChunk(-1, -1, 0))
  chunks.put(0, -1,  createRndChunk(0, -1,  0))
  chunks.put(1, -1,  createRndChunk(1, -1,  0))
  chunks.put(-1, 0,  createDevChunk1(-1, 0, 0))
  chunks.put(0, 0,   createDevChunk1(0, 0,  0))
  chunks.put(1, 0,   createDevChunk1(1, 0,  0, [createDevSubObj(heroObj, 1, 0)]))
  chunks.put(-1, 1,  createDevChunk1(-1, 1, 0))
  chunks.put(0, 1,   createDevChunk1(0, 1,  0))
  chunks.put(1, 1,   createDevChunk1(1, 1,  0))

  return {
    obj: {
      chunks,
      spriteSheetMaterial: {
        url: '',
        colRow: [1, 1],
        normal: {
          animations: [[0, 0]],
          speed: 0,
        },
      },
    }
  }
}

export function addToScene(realm: Realm, loader: THREE.TextureLoader, game: Game) {
  realm.obj.chunks.entries().forEach(([[i, j], chunk]) => {
    calcChunkMesh(chunk, i, j, realm.obj.chunks, loader);
    calcChunkSubObjs(chunk, realm.obj.chunks, loader);
    //game.scene.add(chunk.line);
    game.scene.add(chunk.mesh);
    chunk.subObjs.forEach(subObj => {
      game.scene.add(subObj.sprite);
    });
  })
}

// TODO:
// loadRealm
// exportRealm
// ...
