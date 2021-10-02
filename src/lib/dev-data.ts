import { Cell, Chunk, SubObj, Obj, subObjState } from './obj';
import Map2D from './utils/map2d';
import { CHUNK_SIZE } from './consts';
import { Vec3 } from './utils/utils';

const TEXTURE_URL_1 = 'assets/small-rocks.png';
const DEV_CHUNK_DATA_1 = [
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, .5, .5, 0, .2, .2,
  0, 0, 0, .5, .5, 0, .2, .2,
  0, 0, 0, .5, .5, 0, .2, .2,
  0, 0, 0, .5, .5, 0, .2, .2,
]
export function createDevChunk1(_chunkI: number, _chunkJ: number, _z: number, subObjs: SubObj[] = []): Chunk {
  const cells = new Map2D<Cell>((i, j) => (
    { z: DEV_CHUNK_DATA_1[j * CHUNK_SIZE + i] || 0, flatness: 0.5 }
  ), 0, CHUNK_SIZE - 1, 0, CHUNK_SIZE - 1);

  return {
    cells,
    textureUrl: TEXTURE_URL_1,
    subObjs,
  }
}

const hight = 1.5;
const DEV_CHUNK_DATA_2 = [
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, hight, hight, hight, hight, 0, 0,
  0, 0, hight, hight, hight, hight, 0, 0,
  0, 0, hight, hight, hight, hight, 0, 0,
  0, 0, hight, hight, hight, hight, 0, 0,
  0, 0, hight, hight, hight, hight, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
]
export function createDevChunk2(_chunkI: number, _chunkJ: number, _z: number, subObjs: SubObj[] = []): Chunk {
  const cells = new Map2D<Cell>((i, j) => (
    { z: DEV_CHUNK_DATA_2[j * CHUNK_SIZE + i] || 0, flatness: 0.5 }
  ), 0, CHUNK_SIZE - 1, 0, CHUNK_SIZE - 1);

  return {
    cells,
    textureUrl: TEXTURE_URL_1,
    subObjs,
  }
}

export function createRndChunk(_chunkI: number, _chunkJ: number, _z: number, subObjs: SubObj[] = []): Chunk {
  const cells = new Map2D<Cell>((i, j) => (
    { z: Math.random(), flatness: 0.5 }
  ), 0, CHUNK_SIZE - 1, 0, CHUNK_SIZE - 1);

  return {
    cells,
    textureUrl: TEXTURE_URL_1,
    subObjs,
  }
}

export function createDevSubObj(obj: Obj, chunkI: number, chunkJ: number): SubObj {
  return {
    obj,
    position: [chunkI * CHUNK_SIZE, chunkJ * CHUNK_SIZE, 0] as Vec3,
    rotation: [0, 0, 0] as Vec3,
    state: subObjState.normal,
  }
}

export const heroObj: Obj = {
  chunks: new Map2D(),
  spriteSheetMaterial: {
    url: 'assets/hero.png',
    colRow: [6, 5],
    eightBitStyle: true,
    normal: {
      animations: [[0, 1]],
      speed: 500,
    },
    moving: {
      animations: [[6, 11]],
      speed: 200,
    },
  },
  tall: 0.5,
  speed: 4,
  maxClimbRad: Math.PI * 0.3,
  radius: 0.5,
};
