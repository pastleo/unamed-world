import { GameECS } from './gameECS';

import { createObj } from './obj/obj';

import { EntityRef } from './utils/ecs';
import { ObjRealmComponent } from './obj/realm';
import { Cell } from './chunk/chunk';

import Map2D from './utils/map2d';
import { CHUNK_SIZE } from './consts';
import { Vec2 } from './utils/utils';

const TEXTURE_URL_1 = 'assets/ground.png';
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

export const backgrounds = [
  'assets/skybox/pos-x.png',
  'assets/skybox/neg-x.png',
  'assets/skybox/pos-y.png',
  'assets/skybox/neg-y.png',
  'assets/skybox/pos-z.png',
  'assets/skybox/neg-z.png',
] as [string, string, string, string, string, string];

const flyingBitchObjSpriteComponents = [
  'flying-bitch-1',
  ['obj/sprite', {
    spritesheet: 'assets/flying-bitch.png',
    eightBitStyle: true,
    colRow: [7, 1],
    stateAnimations: {
      normal: {
        animations: [[0, 6]],
        speed: 500,
      },
      walking: {
        animations: [[0, 6]],
        speed: 200,
      },
    },
    tall: 1.4390243902439024,
    radius: 0.5,
  }],
  ['obj/walkable', {
    speed: 4,
    maxClimbRad: Math.PI * 0.3,
  }],
];

const heroObjSpriteComponents = [
  'hero-1',
  ['obj/sprite', {
    spritesheet: 'assets/hero.png',
    eightBitStyle: true,
    colRow: [6, 5],
    stateAnimations: {
      normal: {
        animations: [[0, 1]],
        speed: 500,
      },
      walking: {
        animations: [[6, 11]],
        speed: 200,
      },
    },
    tall: 1,
    radius: 0.5,
  }],
  ['obj/walkable', {
    speed: 4,
    maxClimbRad: Math.PI * 0.3,
  }],
];

const giraffeObjSpriteComponents = [
  'giraffe-1',
  ['obj/sprite', {
    spritesheet: 'assets/giraffe.png',
    eightBitStyle: true,
    colRow: [3, 1],
    stateAnimations: {
      normal: {
        animations: [[0, 0]],
        speed: 500,
      },
      walking: {
        animations: [[0, 2]],
        speed: 200,
      },
    },
    tall: 2,
    radius: 0.5,
  }],
  ['obj/walkable', {
    speed: 4,
    maxClimbRad: Math.PI * 0.3,
  }],
];

export function loadObjSprites(ecs: GameECS) {
  [
    flyingBitchObjSpriteComponents,
    heroObjSpriteComponents,
    giraffeObjSpriteComponents,
  ].forEach(([id, ...components]) => {
    const objEntity = createObj(id as string, ecs);
    components.forEach(([ componentName, component ]) => {
      ecs.setComponent(objEntity, componentName as any, component as any);
      // TODO: when implementing restore feature, validation is required
    });
  });
}

export function loadPlayerObjSpriteComponents(ecs: GameECS): EntityRef {
  const objEntity = ecs.allocate();
  flyingBitchObjSpriteComponents.forEach(([ componentName, component ]) => {
    ecs.setComponent(objEntity, componentName as any, component as any);
    // TODO: when implementing restore feature, validation is required
  });

  return objEntity
}

export function loadRealm1(ecs: GameECS) {
  const realmObjEntity = createObj('realm-1', ecs);
  const realm: ObjRealmComponent = {
    chunks: new Map2D(),
    backgrounds,
  };
  ecs.setComponent(realmObjEntity, 'obj/realm', realm);

  loadChunkComponent(
    TEXTURE_URL_1, devCells(DEV_CHUNK_DATA_1, [false, true, true, false], Z_HIGH),
    [-2, -3], [], realm.chunks, ecs
  );
  loadChunkComponent(
    TEXTURE_URL_1, devCells(DEV_CHUNK_DATA_1, [false, true, false, false], Z_HIGH),
    [-1, -3], [], realm.chunks, ecs
  );
  loadChunkComponent(
    TEXTURE_URL_1, devCells(DEV_CHUNK_DATA_1, [false, true, false, false], Z_HIGH),
    [0, -3], [], realm.chunks, ecs
  );
  loadChunkComponent(
    TEXTURE_URL_1, devCells(DEV_CHUNK_DATA_1, [false, true, false, false], Z_HIGH),
    [1, -3], [], realm.chunks, ecs
  );
  loadChunkComponent(
    TEXTURE_URL_1, devCells(DEV_CHUNK_DATA_1, [false, true, false, true], Z_HIGH),
    [2, -3], [], realm.chunks, ecs
  );

  loadChunkComponent(
    TEXTURE_URL_1, devCells(DEV_CHUNK_DATA_1, [false, false, true, false], Z_HIGH),
    [-2, -2], [], realm.chunks, ecs
  );
  loadChunkComponent(
    TEXTURE_URL_1, rndCells(),
    [-1, -2], [], realm.chunks, ecs
  );
  loadChunkComponent(
    TEXTURE_URL_1, rndCells(),
    [0, -2], [], realm.chunks, ecs
  );
  loadChunkComponent(
    TEXTURE_URL_1, rndCells(),
    [1, -2], [], realm.chunks, ecs
  );
  loadChunkComponent(
    TEXTURE_URL_1, devCells(DEV_CHUNK_DATA_1, [false, false, false, true], Z_HIGH),
    [2, -2], [], realm.chunks, ecs
  );

  loadChunkComponent(
    TEXTURE_URL_1, devCells(DEV_CHUNK_DATA_1, [true, false, true, false], Z_HIGH),
    [-2, -1], [], realm.chunks, ecs
  );
  loadChunkComponent(
    TEXTURE_URL_1, devCells(DEV_CHUNK_DATA_2),
    [-1, -1], [], realm.chunks, ecs
  );
  loadChunkComponent(
    TEXTURE_URL_1, devCells(DEV_CHUNK_DATA_2),
    [0, -1], [], realm.chunks, ecs
  );
  loadChunkComponent(
    TEXTURE_URL_1, devCells(DEV_CHUNK_DATA_2),
    [1, -1], [], realm.chunks, ecs
  );
  loadChunkComponent(
    TEXTURE_URL_1, devCells(DEV_CHUNK_DATA_1, [true, false, false, true], Z_HIGH),
    [2, -1], [], realm.chunks, ecs
  );

  loadChunkComponent(
    TEXTURE_URL_1, devCells(DEV_CHUNK_DATA_1, [false, false, true, false], Z_HIGH),
    [-1, 0], [], realm.chunks, ecs
  );
  loadChunkComponent(
    TEXTURE_URL_1, devCells(DEV_CHUNK_DATA_1),
    [0, 0], [], realm.chunks, ecs
  );
  loadChunkComponent(
    TEXTURE_URL_1, devCells(DEV_CHUNK_DATA_1, [false, false, false, true], Z_HIGH),
    [1, 0], [], realm.chunks, ecs
  );

  loadChunkComponent(
    TEXTURE_URL_1, devCells(DEV_CHUNK_DATA_1, [true, false, true, false], Z_HIGH),
    [-1, 1], [], realm.chunks, ecs
  );
  loadChunkComponent(
    TEXTURE_URL_1, devCells(DEV_CHUNK_DATA_1, [true, false, false, false], Z_HIGH),
    [0, 1], [], realm.chunks, ecs
  );
  loadChunkComponent(
    TEXTURE_URL_1, devCells(DEV_CHUNK_DATA_1, [true, false, false, true], Z_HIGH),
    [1, 1], [], realm.chunks, ecs
  );
}

function loadChunkComponent(textureUrl: string, cellFn: (i: number, j: number) => Cell, chunkIJ: Vec2, subObjs: EntityRef[], chunks: Map2D<EntityRef>, ecs: GameECS) {
  const chunkEntity = ecs.allocate();
  ecs.setComponent(chunkEntity, 'chunk', {
    cells: new Map2D(cellFn, 0, CHUNK_SIZE - 1, 0, CHUNK_SIZE - 1),
    chunkIJ,
    subObjs,
    textureUrl,
    persistance: true,
  });
  chunks.put(chunkIJ[0], chunkIJ[1], chunkEntity);
}

type BorderOption = [up: boolean, down: boolean, left: boolean, right: boolean];
function devCells(cellData: number[], borderOption?: BorderOption, borderZ?: number): (i: number, j: number) => Cell {
  const [up, down, left, right] = borderOption || [false, false, false, false];

  return (i, j) => {
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
  };
}
function rndCells(): (i: number, j: number) => Cell {
  return () => (
    { altitude: Math.random(), flatness: 0.5 }
  )
}
