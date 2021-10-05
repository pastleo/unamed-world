import * as THREE from 'three';
import Game from './game';
import { Chunk, Cell, Obj, calcChunkMesh, calcChunkSubObjs } from './obj';
import Map2D from './utils/map2d';
import { Vec2, rangeVec2s } from './utils/utils';
import SetVec2 from './utils/setVec2';

import { CHUNK_SIZE } from './consts';

import { createDevRealm } from './dev-data';

export interface Realm {
  obj: Obj;
  backgrounds: [
    urlPosX: string, urlNegX: string,
    urlPosY: string, urlNegY: string,
    urlPosZ: string, urlPosZ: string
  ];
}

const AUTO_GENERATION_RANGE = 4;

export function create(): Realm {
  const realm = createDevRealm();
  generateRealmChunk(realm, [0, 0]);

  return realm;
}

const CELL_MIDDLE_PERCENTAGE_OFFSET = 1 / (CHUNK_SIZE * 2);
type GeneratedChunk = [chunkI: number, chunkJ: number, chunk: Chunk];
function generateRealmChunk(realm: Realm, centerChunkIJ: Vec2): GeneratedChunk[] {
  const newChunks: GeneratedChunk[] = [];
  rangeVec2s(centerChunkIJ, AUTO_GENERATION_RANGE).forEach(([chunkI, chunkJ]) => {
    const chunk = realm.obj.chunks.get(chunkI, chunkJ);
    if (chunk) return;
    const upChunk = realm.obj.chunks.get(chunkI, chunkJ + 1)
    const bottomChunk = realm.obj.chunks.get(chunkI, chunkJ - 1)
    const leftChunk = realm.obj.chunks.get(chunkI - 1, chunkJ)
    const rightChunk = realm.obj.chunks.get(chunkI + 1, chunkJ)

    const cells = new Map2D<Cell>((i, j) => {
      const upEdgeCell = upChunk?.cells.get(i, 0);
      const bottomEdgeCell = bottomChunk?.cells.get(i, CHUNK_SIZE - 1);
      const leftEdgeCell = leftChunk?.cells.get(CHUNK_SIZE - 1, j);
      const rightEdgeCell = rightChunk?.cells.get(0, j);

      const cellCoordPercentage = [i / CHUNK_SIZE, j / CHUNK_SIZE].map(p => p + CELL_MIDDLE_PERCENTAGE_OFFSET);
      const [zSum, zDivideFactor] = ([
        [upEdgeCell, 1 - cellCoordPercentage[1]],
        [bottomEdgeCell, cellCoordPercentage[1]],
        [leftEdgeCell, 1 - cellCoordPercentage[0]],
        [rightEdgeCell, cellCoordPercentage[0]],
      ] as [Cell, number][]).filter(
        ([cell]) => cell
      ).reduce<[number, number]>(
        ([zSum, zDivideFactor], [cell, p]) => ([zSum + cell.z * p, zDivideFactor + p]),
        [0, 0],
      );

      return { z: zSum / zDivideFactor, flatness: 0.5 };
    }, 0, CHUNK_SIZE - 1, 0, CHUNK_SIZE - 1);

    const newChunk: Chunk = {
      cells,
      textureUrl: (upChunk || bottomChunk || leftChunk || rightChunk).textureUrl,
      subObjs: [],
    }

    realm.obj.chunks.put(chunkI, chunkJ, newChunk);
    newChunks.push([chunkI, chunkJ, newChunk]);
  });

  return newChunks;
}

export function addToScene(realm: Realm, loader: THREE.TextureLoader, game: Game) {
  realm.obj.chunks.entries().forEach(([[i, j], chunk]) => {
    addChunkToScene(i, j, chunk, realm, loader, game);
  });

  const backgroundLoader = new THREE.CubeTextureLoader();
  const texture = backgroundLoader.load(realm.backgrounds);
  game.scene.background = texture;
  game.scene.rotation.x = -Math.PI / 2; // because our z is normal coord system's y
}

function addChunkToScene(chunkI: number, chunkJ: number, chunk: Chunk, realm: Realm, loader: THREE.TextureLoader, game: Game) {
  calcChunkMesh(chunk, chunkI, chunkJ, realm.obj.chunks, loader);
  calcChunkSubObjs(chunk, realm.obj, loader);
  //game.scene.add(chunk.line);
  game.scene.add(chunk.mesh);
  chunk.subObjs.forEach(subObj => {
    game.scene.add(subObj.sprite);
  });
}

export function triggerRealmGeneration(realm: Realm, centerChunkIJ: Vec2, game: Game) {
  const newChunks = generateRealmChunk(realm, centerChunkIJ);
  if (newChunks.length <= 0) return;

  const newChunkIJs = new SetVec2();

  const loader = new THREE.TextureLoader();
  newChunks.forEach(([i, j, chunk]) => {
    addChunkToScene(i, j, chunk, realm, loader, game);

    newChunkIJs.add([i, j]);
  });

  const reCalcChunkIJs = new SetVec2();
  newChunks.forEach(([chunkI, chunkJ]) => {
    [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1], [1, 0], [1, 1],
    ].forEach(([dI, dJ]) => {
      const ij: Vec2 = [chunkI + dI, chunkJ + dJ];

      if (!newChunkIJs.has(ij)) {
        reCalcChunkIJs.add(ij);
      }
    });
  });

  reCalcChunkIJs.values().map(([chunkI, chunkJ]) => (
    [chunkI, chunkJ, realm.obj.chunks.get(chunkI, chunkJ)] as [number, number, Chunk]
  )).filter(
    ([_i, _j, chunk]) => chunk
  ).forEach(([chunkI, chunkJ, chunk]) => {
    calcChunkMesh(chunk, chunkI, chunkJ, realm.obj.chunks, loader);
    game.scene.add(chunk.mesh);
  });
}

// TODO:
// loadRealm
// exportRealm
// ...
