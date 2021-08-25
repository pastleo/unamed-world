import * as THREE from 'three';
import Game from './game';
import { Obj, Cell, Chunk, calcChunkMesh } from './obj';
import Map2D from './utils/map2d';
import { CHUNK_SIZE } from './consts';

export interface Realm {
  obj: Obj;
}

export function create(): Realm {
  const chunks = new Map2D<Chunk>();
  chunks.put(-1, -1, createRndChunk(-1, -1, 0))
  chunks.put(0, -1,  createRndChunk(0, -1,  0))
  chunks.put(1, -1,  createRndChunk(1, -1,  0))
  chunks.put(-1, 0,  createDevChunk1(-1, 0,  0))
  chunks.put(0, 0,   createDevChunk1(0, 0,   0))
  chunks.put(1, 0,   createDevChunk1(1, 0,   0))
  chunks.put(-1, 1,  createDevChunk1(-1, 1,  0))
  chunks.put(0, 1,   createDevChunk1(0, 1,   0))
  chunks.put(1, 1,   createDevChunk1(1, 1,   0))

  return {
    obj: {
      chunks,
      textureUrl: '',
    }
  }
}

export function addToScene(realm: Realm, loader: THREE.TextureLoader, game: Game) {
  realm.obj.chunks.entries().forEach(([[i, j], chunk]) => {
    calcChunkMesh(chunk, i, j, realm.obj.chunks, loader);
    //game.scene.add(chunk.line);
    game.scene.add(chunk.mesh);
  })
}

const DEV_CHUNK_DATA = [
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, .5, .5, 0, .2, .2,
  0, 0, 0, .5, .5, 0, .2, .2,
  0, 0, 0, .5, .5, 0, .2, .2,
  0, 0, 0, .5, .5, 0, .2, .2,
]
function createDevChunk1(_chunkI: number, _chunkJ: number, _z: number): Chunk {
  const cells = new Map2D<Cell>((i, j) => (
    { z: DEV_CHUNK_DATA[j * CHUNK_SIZE + i] || 0, flatness: 0.5 }
  ), 0, CHUNK_SIZE - 1, 0, CHUNK_SIZE - 1);

  return {
    cells,
    textureUrl: 'assets/small-rocks.png',
    subObjs: [],
  }
}
function createRndChunk(_chunkI: number, _chunkJ: number, _z: number): Chunk {
  const cells = new Map2D<Cell>((i, j) => (
    { z: Math.random(), flatness: 0.5 }
  ), 0, CHUNK_SIZE - 1, 0, CHUNK_SIZE - 1);

  return {
    cells,
    textureUrl: 'assets/small-rocks.png',
    subObjs: [],
  }
}

// TODO:
// loadRealm
// exportRealm
// ...
