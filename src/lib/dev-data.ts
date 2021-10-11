import Obj from './obj/obj';
import { Cell, Chunk } from './obj/chunk';
import { SubObj, subObjState } from './obj/subObj';
import { Realm } from './realm';
import Map2D from './utils/map2d';
import { CHUNK_SIZE } from './consts';
import { Vec3 } from './utils/utils';

const TEXTURE_URL_1 = 'assets/small-rocks.png';
const DEV_CHUNK_DATA_1 = [
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, .5, .5, 0, .2, 0, 0,
  0, 0, .5, .5, 0, .2, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
];

const Z_HIGH = 1.5;
const DEV_CHUNK_DATA_2 = [
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, Z_HIGH, Z_HIGH, Z_HIGH, Z_HIGH, 0, 0,
  0, 0, Z_HIGH, Z_HIGH, Z_HIGH, Z_HIGH, 0, 0,
  0, 0, Z_HIGH, Z_HIGH, Z_HIGH, Z_HIGH, 0, 0,
  0, 0, Z_HIGH, Z_HIGH, Z_HIGH, Z_HIGH, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
];
export function createDevRealm(): Realm {
  const chunks = new Map2D<Chunk>();

  chunks.put(-2, -3, createDevChunk(DEV_CHUNK_DATA_1, TEXTURE_URL_1, [], [false, true, true, false], Z_HIGH));
  chunks.put(-1, -3, createDevChunk(DEV_CHUNK_DATA_1, TEXTURE_URL_1, [], [false, true, false, false], Z_HIGH));
  chunks.put( 0, -3, createDevChunk(DEV_CHUNK_DATA_1, TEXTURE_URL_1, [], [false, true, false, false], Z_HIGH));
  chunks.put( 1, -3, createDevChunk(DEV_CHUNK_DATA_1, TEXTURE_URL_1, [], [false, true, false, false], Z_HIGH));
  chunks.put( 2, -3, createDevChunk(DEV_CHUNK_DATA_1, TEXTURE_URL_1, [], [false, true, false, true], Z_HIGH));

  chunks.put(-2, -2, createDevChunk(DEV_CHUNK_DATA_1, TEXTURE_URL_1, [], [false, false, true, false], Z_HIGH));
  chunks.put(-1, -2, createRndChunk(TEXTURE_URL_1));
  chunks.put( 0, -2, createRndChunk(TEXTURE_URL_1));
  chunks.put( 1, -2, createRndChunk(TEXTURE_URL_1));
  chunks.put( 2, -2, createDevChunk(DEV_CHUNK_DATA_1, TEXTURE_URL_1, [], [false, false, false, true], Z_HIGH));

  chunks.put(-2, -1, createDevChunk(DEV_CHUNK_DATA_1, TEXTURE_URL_1, [], [true, false, true, false], Z_HIGH));
  chunks.put(-1, -1, createDevChunk(DEV_CHUNK_DATA_2, TEXTURE_URL_1));
  chunks.put( 0, -1, createDevChunk(DEV_CHUNK_DATA_2, TEXTURE_URL_1));
  chunks.put( 1, -1, createDevChunk(DEV_CHUNK_DATA_2, TEXTURE_URL_1));
  chunks.put( 2, -1, createDevChunk(DEV_CHUNK_DATA_1, TEXTURE_URL_1, [], [true, false, false, true], Z_HIGH));

  chunks.put(-1, 0,  createDevChunk(DEV_CHUNK_DATA_1, TEXTURE_URL_1, [], [false, false, true, false], Z_HIGH));
  chunks.put( 0, 0,  createDevChunk(DEV_CHUNK_DATA_1, TEXTURE_URL_1));
  chunks.put( 1, 0,  createDevChunk(DEV_CHUNK_DATA_1, TEXTURE_URL_1, [createDevSubObj(heroObj, 1, 0)], [false, false, false, true], Z_HIGH));

  chunks.put(-1, 1,  createDevChunk(DEV_CHUNK_DATA_1, TEXTURE_URL_1, [], [true, false, true, false], Z_HIGH));
  chunks.put( 0, 1,  createDevChunk(DEV_CHUNK_DATA_1, TEXTURE_URL_1, [], [true, false, false, false], Z_HIGH));
  chunks.put( 1, 1,  createDevChunk(DEV_CHUNK_DATA_1, TEXTURE_URL_1, [createDevSubObj(heroObj, 1, 0)], [true, false, false, true], Z_HIGH));

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
      speed: 0,
      maxClimbRad: 0,
      radius: 1,
      tall: 0,
    },
    backgrounds: [
      'assets/skybox/pos-x.png',
      'assets/skybox/neg-x.png',
      'assets/skybox/pos-y.png',
      'assets/skybox/neg-y.png',
      'assets/skybox/pos-z.png',
      'assets/skybox/neg-z.png',
    ]
  }
}

type BorderOption = [up: boolean, down: boolean, left: boolean, right: boolean];
export function createDevChunk(cellData: number[], textureUrl: string, subObjs: SubObj[] = [], borderOption?: BorderOption, borderZ?: number): Chunk {
  const [up, down, left, right] = borderOption || [false, false, false, false];

  const cells = new Map2D<Cell>((i, j) => {
    let altitude = cellData[j * CHUNK_SIZE + i] || 0;
    if (
      (j === (CHUNK_SIZE - 1) && up) ||
      (j === 0 && down) ||
      (i === 0 && left) ||
      (i === (CHUNK_SIZE - 1) && right)
    ) {
      altitude = borderZ;
    }

    return (
      { altitude, flatness: 0.5 }
    )
  }, 0, CHUNK_SIZE - 1, 0, CHUNK_SIZE - 1);

  return {
    cells,
    textureUrl,
    subObjs,
  }
}

export function createRndChunk(textureUrl: string, subObjs: SubObj[] = []): Chunk {
  const cells = new Map2D<Cell>((_i, _j) => (
    { altitude: Math.random(), flatness: 0.5 }
  ), 0, CHUNK_SIZE - 1, 0, CHUNK_SIZE - 1);

  return {
    cells,
    textureUrl,
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
    walking: {
      animations: [[6, 11]],
      speed: 200,
    },
  },
  tall: 0.5,
  speed: 4,
  maxClimbRad: Math.PI * 0.3,
  radius: 0.5,
};
