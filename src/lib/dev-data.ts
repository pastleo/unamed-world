import { GameECS } from './gameECS';

import { EntityRef } from './utils/ecs';
import { ObjRealmComponent } from './obj/realm';
import { Cell } from './chunk/chunk';

import Map2D from './utils/map2d';
import { CHUNK_SIZE } from './consts';
import { Vec2 } from './utils/utils';

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

export const backgrounds = [
  'assets/skybox/pos-x.png',
  'assets/skybox/neg-x.png',
  'assets/skybox/pos-y.png',
  'assets/skybox/neg-y.png',
  'assets/skybox/pos-z.png',
  'assets/skybox/neg-z.png',
] as [string, string, string, string, string, string];

export const heroObjSpriteComponents = [
  ['obj', { id: 'hero-1' }],
  ['obj/sprite', {
    url: 'assets/hero.png',
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
  }],
  ['obj/walkable', {
    radius: 0.5,
    speed: 4,
    maxClimbRad: Math.PI * 0.3,
  }],
];

export function loadPlayerObjSpriteComponents(ecs: GameECS): EntityRef {
  const objEntity = ecs.allocate();
  heroObjSpriteComponents.forEach(([ componentName, component ]) => {
    ecs.setComponent(objEntity, componentName as any, component as any);
    // TODO: when implementing restore feature, validation is required
  });

  return objEntity
}

export function loadRealmComponents(realmObjEntity: EntityRef, ecs: GameECS) {
  const realm = ecs.getComponent(realmObjEntity, 'obj/realm');
  loadRealm1(realm, ecs);
}

function loadRealm1(realm: ObjRealmComponent, ecs: GameECS) {
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
    chunkEntity,
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
