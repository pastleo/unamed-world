import * as Comlink from 'comlink';

import { GameECS, init as initECS } from '../gameECS';
import { createBaseRealm } from '../obj/realm';
import { Cell, getChunk } from '../chunk/chunk';
import { AttributeArrays, chunkAttributeArrays } from '../chunk/renderAttribute';

import { EntityRef } from '../utils/ecs';
import { Vec2, rangeVec2s, add } from '../utils/utils';
import SetVec2 from '../utils/setVec2';
import Map2D from '../utils/map2d';
import { createWorkerNextValueFn } from '../utils/worker';

import { CHUNK_SIZE, REALM_CHUNK_AUTO_GENERATION_RANGE } from '../consts';
// import { loadRealmComponents } from '../dev-data';

export interface ChunkGenerationResult {
  chunkIJ: Vec2;
  cellEntries?: [[number, number], Cell][];
  textureUrl: string;
  attributeArrays: AttributeArrays;
}

export interface RealmWorker {
  create: () => void;
  triggerRealmGeneration: (centerChunkIJ: Vec2) => void;
  nextGeneratedChunk: () => Promise<ChunkGenerationResult>;
}

interface RealmWorkerGlobal {
  ecs: GameECS;
  realmEntity: EntityRef;
  generatingChunkQueue: EntityRef[];
  notifyNewChunk: (value: ChunkGenerationResult) => void;
}

function startWorker(): RealmWorker {
  const ecs = initECS();
  const realmEntity = createBaseRealm(ecs);

  const [notifyNewChunk, nextGeneratedChunk] = createWorkerNextValueFn<ChunkGenerationResult>();

  const worker: RealmWorkerGlobal = {
    ecs, realmEntity,
    generatingChunkQueue: [],
    notifyNewChunk,
  };

  return {
    create: () => {
      // loadRealmComponents(realmEntity, ecs);
    },
    triggerRealmGeneration: (centerChunkIJ: Vec2) => {
      generateRealmChunk(centerChunkIJ, worker);
    },
    nextGeneratedChunk,
  }
}

export default startWorker;

const CELL_MIDDLE_PERCENTAGE_OFFSET = 1 / (CHUNK_SIZE * 2);
function generateRealmChunk(centerChunkIJ: Vec2, worker: RealmWorkerGlobal) {
  const realm = worker.ecs.getComponent(worker.realmEntity, 'obj/realm');
  rangeVec2s(centerChunkIJ, REALM_CHUNK_AUTO_GENERATION_RANGE).forEach(chunkIJ => {
    if (realm.chunks.get(...chunkIJ)) return;
    const upChunk = getChunk(add(chunkIJ, [0, 1]), worker.realmEntity, worker.ecs, true);
    const bottomChunk = getChunk(add(chunkIJ, [0, -1]), worker.realmEntity, worker.ecs, true);
    const leftChunk = getChunk(add(chunkIJ, [-1, 0]), worker.realmEntity, worker.ecs, true);
    const rightChunk = getChunk(add(chunkIJ, [1, 0]), worker.realmEntity, worker.ecs, true);

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
        ([zSum, zDivideFactor], [cell, p]) => {
          return ([zSum + cell.altitude * p, zDivideFactor + p])
        },
        [0, 0],
      );

      return { altitude: zDivideFactor <= 0 ? 0 : zSum / zDivideFactor, flatness: 0.5 };
    }, 0, CHUNK_SIZE - 1, 0, CHUNK_SIZE - 1);

    const chunkEntity = worker.ecs.allocate();
    worker.ecs.setComponent(chunkEntity, 'chunk', {
      cells,
      chunkEntity,
      chunkIJ,
      subObjs: [], // not used
      persistance: false,
      textureUrl: (upChunk || bottomChunk || leftChunk || rightChunk)?.textureUrl || '',
    });

   realm.chunks.put(...chunkIJ, chunkEntity);
  });

  const newChunks: [chunkIJ: Vec2, chunkEntity: EntityRef][] = [];

  const newChunkIJs = new SetVec2();
  rangeVec2s(centerChunkIJ, REALM_CHUNK_AUTO_GENERATION_RANGE).forEach(chunkIJ => {
    const chunkEntity = realm.chunks.get(...chunkIJ);

    if (worker.ecs.getComponent(chunkEntity, 'chunk/renderAttribute')?.attributesGenerated) return;

    queueGenerateChunkAttrs(chunkEntity, worker);
    newChunkIJs.add(chunkIJ);
    newChunks.push([chunkIJ, chunkEntity]);
  });

  if (newChunks.length <= 0) return;

  const reCalcChunkIJs = new SetVec2();
  newChunks.forEach(([[chunkI, chunkJ]]) => {
    [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1],
    ].forEach(([dI, dJ]) => {
      const ij: Vec2 = [chunkI + dI, chunkJ + dJ];

      if (!newChunkIJs.has(ij)) {
        reCalcChunkIJs.add(ij);
      }
    });
  });

  reCalcChunkIJs.values().map(chunkIJ => (
    realm.chunks.get(...chunkIJ)
  )).filter(
    chunkEntity => !!chunkEntity
  ).forEach(chunkEntity => {
    queueGenerateChunkAttrs(chunkEntity, worker);
  });
}

function queueGenerateChunkAttrs(chunkEntity: EntityRef, worker: RealmWorkerGlobal) {
  worker.ecs.setComponent(chunkEntity, 'chunk/renderAttribute', {
    attributesGenerated: true,
  });
  worker.generatingChunkQueue.push(chunkEntity);

  if (worker.generatingChunkQueue.length > 1) return;
  generateChunkAttrs(worker);
}

function generateChunkAttrs(worker: RealmWorkerGlobal) {
  setTimeout(() => {
    if (worker.generatingChunkQueue.length <= 0) return;
    const chunkEntity = worker.generatingChunkQueue.shift();
    const chunk = worker.ecs.getComponent(chunkEntity, 'chunk');

    const attributeArrays = chunkAttributeArrays(chunkEntity, worker.realmEntity, worker.ecs);

    worker.notifyNewChunk(Comlink.transfer({
      chunkIJ: chunk.chunkIJ,
      cellEntries: chunk.cells.entries(),
      textureUrl: chunk.textureUrl,
      attributeArrays,
    }, [attributeArrays.positions, attributeArrays.uvs]));

    generateChunkAttrs(worker);
  });
}
