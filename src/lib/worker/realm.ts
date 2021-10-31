import * as Comlink from 'comlink';
import localForage from 'localforage';

import { GameECS, init as initECS } from '../gameECS';
import { ExportedRealmJson, loadExportedRealm } from '../realm';
import { ObjRealmComponent, createBaseRealm } from '../obj/realm';
import { Cell, ChunkComponent, getChunk } from '../chunk/chunk';
import { AttributeArrays, chunkAttributeArrays } from '../chunk/renderAttribute';

import { EntityRef, UUID } from '../utils/ecs';
import { Vec2, rangeVec2s, add } from '../utils/utils';
import SetVec2 from '../utils/setVec2';
import Map2D from '../utils/map2d';
import { createWorkerNextValueFn } from '../utils/worker';

import { CHUNK_SIZE, REALM_CHUNK_AUTO_GENERATION_RANGE } from '../consts';

export interface ChunkGenerationResult {
  chunkIJ: Vec2;
  cellEntries?: [[number, number], Cell][];
  textureUrl: string;
  attributeArrays: AttributeArrays;
}

export interface RealmWorker {
  load: (id: string) => void;
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

  const [notifyNewChunk, nextGeneratedChunk] = createWorkerNextValueFn<ChunkGenerationResult>();

  const worker: RealmWorkerGlobal = {
    ecs, realmEntity: createBaseRealm(ecs),
    generatingChunkQueue: [],
    notifyNewChunk,
  };

  return {
    load: async (uuid: UUID) => {
      await loadRealm(uuid, worker);
    },
    triggerRealmGeneration: (centerChunkIJ: Vec2) => {
      generateRealmChunk(centerChunkIJ, worker);
    },
    nextGeneratedChunk,
  }
}

export default startWorker;

async function loadRealm(uuid: UUID, worker: RealmWorkerGlobal) {
  const json = await localForage.getItem<ExportedRealmJson>(`realm:${uuid}`);
  if (json) {
    worker.generatingChunkQueue = [];
    worker.realmEntity = loadExportedRealm(json, worker.ecs);

    const realm = worker.ecs.getComponent(worker.realmEntity, 'obj/realm');
    realm.chunks.entries().forEach(([_chunkIJ, chunkEntity]) => {
      worker.ecs.setComponent(chunkEntity, 'chunk/renderAttribute', {
        cellSent: false,
        attributesGenerated: false,
      });
    });
  }
}

const CELL_MIDDLE_PERCENTAGE_OFFSET = 1 / (CHUNK_SIZE * 2);
function generateRealmChunk(centerChunkIJ: Vec2, worker: RealmWorkerGlobal) {
  const realm = worker.ecs.getComponent(worker.realmEntity, 'obj/realm');
  rangeVec2s(centerChunkIJ, REALM_CHUNK_AUTO_GENERATION_RANGE).forEach(chunkIJ => {
    if (realm.chunks.get(...chunkIJ)) return;
    generateChunkEntity(chunkIJ, realm, worker);
  });

  const newChunks: [chunkIJ: Vec2, chunkEntity: EntityRef][] = [];

  const newChunkIJs = new SetVec2();
  rangeVec2s(centerChunkIJ, REALM_CHUNK_AUTO_GENERATION_RANGE).forEach(chunkIJ => {
    const chunkEntity = realm.chunks.get(...chunkIJ);

    if (worker.ecs.getComponent(chunkEntity, 'chunk/renderAttribute').attributesGenerated) return;

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

function generateChunkEntity(chunkIJ: Vec2, realm: ObjRealmComponent, worker: RealmWorkerGlobal): EntityRef {
  const upChunk = getChunk(add(chunkIJ, [0, 1]), worker.realmEntity, worker.ecs);
  const bottomChunk = getChunk(add(chunkIJ, [0, -1]), worker.realmEntity, worker.ecs);
  const leftChunk = getChunk(add(chunkIJ, [-1, 0]), worker.realmEntity, worker.ecs);
  const rightChunk = getChunk(add(chunkIJ, [1, 0]), worker.realmEntity, worker.ecs);
  let lastAltitude: number;

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

    const altitude = zDivideFactor <= 0 ? 0 : zSum / zDivideFactor;
    lastAltitude = altitude;
    return { altitude, flatness: 0.5 };
  }, 0, CHUNK_SIZE - 1, 0, CHUNK_SIZE - 1);

  const chunkEntity = worker.ecs.allocate();
  worker.ecs.setComponent(chunkEntity, 'chunk', {
    cells,
    chunkIJ,
    subObjs: [], // not used
    persistance: false,
    textureUrl: (upChunk || bottomChunk || leftChunk || rightChunk)?.textureUrl || '',
  });
  worker.ecs.setComponent(chunkEntity, 'chunk/renderAttribute', {
    cellSent: false,
    attributesGenerated: false,
  });

  realm.chunks.put(...chunkIJ, chunkEntity);

  return chunkEntity;
}

function queueGenerateChunkAttrs(chunkEntity: EntityRef, worker: RealmWorkerGlobal) {
  worker.ecs.getComponent(chunkEntity, 'chunk/renderAttribute').attributesGenerated = true;
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
      textureUrl: chunk.textureUrl,
      attributeArrays,
      ...sendChunkCells(chunk, chunkEntity, worker),
    }, [attributeArrays.positions, attributeArrays.uvs]));

    generateChunkAttrs(worker);
  });
}

function sendChunkCells(chunk: ChunkComponent, chunkEntity: EntityRef, worker: RealmWorkerGlobal): Partial<Pick<ChunkGenerationResult, 'cellEntries'>> {
  const renderAttribute = worker.ecs.getComponent(chunkEntity, 'chunk/renderAttribute');
  if (renderAttribute.cellSent) return {};
  renderAttribute.cellSent = true;
  return {
    cellEntries: chunk.cells.entries(),
  }
}
