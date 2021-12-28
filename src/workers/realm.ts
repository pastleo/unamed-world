import * as Comlink from 'comlink';
import localForage from 'localforage';
import debug from 'debug';

import { GameECS, init as initECS } from '../lib/gameECS';
import { PackedRealmJson, loadExportedRealm } from '../lib/storage';

import { ObjPath } from '../lib/obj/obj';
import { ObjRealmComponent, createBaseRealm } from '../lib/obj/realm';
import { Cell, ChunkComponent, getChunk, getChunkCell } from '../lib/chunk/chunk';
import { ChunkRenderAttributeComponent, AttributeArrays, chunkAttributeArrays } from '../lib/chunk/renderAttribute';

import { EntityRef } from '../lib/utils/ecs';
import { Vec2, rangeVec2s, add } from '../lib/utils/utils';
import SetVec2 from '../lib/utils/setVec2';
import Map2D from '../lib/utils/map2d';
import { createWorkerNextValueFn } from '../lib/utils/worker';

import { CHUNK_SIZE, REALM_CHUNK_AUTO_GENERATION_RANGE } from '../lib/consts';

const log = debug('worker/realm');

export interface ChunkGenerationResult {
  chunkIJ: Vec2;
  repeatable: boolean;
  cellEntries?: [[number, number], Cell][];
  textureUrl: string;
  attributeArrays: AttributeArrays;
}

export interface RealmRPCs {
  load: (id: string) => void;
  nextGeneratedChunk: () => Promise<ChunkGenerationResult>;
  triggerRealmGeneration: (centerChunkIJ: Vec2) => void;
  updateCells: (chunkIJ: Vec2, cellEntries: [[number, number], Cell][]) => void;
}

interface RealmWorker {
  ecs: GameECS;
  realmEntity: EntityRef;
  generatingChunkQueue: EntityRef[];
  notifyNewChunk: (value: ChunkGenerationResult) => void;
}

function startWorker() {
  const ecs = initECS();

  const [notifyNewChunk, nextGeneratedChunk] = createWorkerNextValueFn<ChunkGenerationResult>();

  const worker: RealmWorker = {
    ecs, realmEntity: createBaseRealm(ecs),
    generatingChunkQueue: [],
    notifyNewChunk,
  };

  const realmRPCs: RealmRPCs = {
    load: async (objRealmPath) => {
      await loadRealm(objRealmPath, worker);
    },
    nextGeneratedChunk,
    triggerRealmGeneration: (centerChunkIJ) => {
      generateRealmChunk(centerChunkIJ, REALM_CHUNK_AUTO_GENERATION_RANGE, worker);
    },
    updateCells: (chunkIJ, cellEntries) => {
      updateCells(chunkIJ, cellEntries, worker);
    },
  }
  Comlink.expose(realmRPCs);
}

startWorker();

async function loadRealm(objRealmPath: ObjPath, worker: RealmWorker) {
  if (!objRealmPath) return;

  const json = await localForage.getItem<PackedRealmJson>(objRealmPath);
  if (json) {
    const prevChunks = worker.ecs.getComponent(worker.realmEntity, 'obj/realm').chunks;
    prevChunks.entries().forEach(([_chunkIJ, chunkEntity]) => {
      worker.ecs.deallocate(chunkEntity);
    });

    worker.generatingChunkQueue = [];
    worker.realmEntity = loadExportedRealm(objRealmPath, json, worker.ecs);
  }
}

const CELL_MIDDLE_PERCENTAGE_OFFSET = 1 / (CHUNK_SIZE * 2);
function generateRealmChunk(centerChunkIJ: Vec2, range: number, worker: RealmWorker) {
  log(`generateRealmChunk start from ${centerChunkIJ.join(', ')}`);
  const realm = worker.ecs.getComponent(worker.realmEntity, 'obj/realm');
  rangeVec2s(centerChunkIJ, range).forEach(chunkIJ => {
    if (realm.chunks.get(...chunkIJ)) return;
    generateChunkEntity(chunkIJ, realm, worker);
  });

  const chunkIJsToGen: Vec2[] = [];
  rangeVec2s(centerChunkIJ, range).forEach(chunkIJ => {
    const chunkEntity = realm.chunks.get(...chunkIJ);
    const attrComponent = getRenderAttrComponent(chunkEntity, worker);
    if (attrComponent.attributesGenerated) return;
    attrComponent.attributesGenerated = true;

    chunkIJsToGen.push(chunkIJ);
  });

  if (chunkIJsToGen.length <= 0) return;
  startGenerateChunksAroundAttrs(chunkIJsToGen, worker);
}

function generateChunkEntity(chunkIJ: Vec2, realm: ObjRealmComponent, worker: RealmWorker): EntityRef {
  log(`generateChunkEntity: ${chunkIJ.join(', ')}`);
  const upChunk = getChunk(add(chunkIJ, [0, 1]), worker.realmEntity, worker.ecs);
  const bottomChunk = getChunk(add(chunkIJ, [0, -1]), worker.realmEntity, worker.ecs);
  const leftChunk = getChunk(add(chunkIJ, [-1, 0]), worker.realmEntity, worker.ecs);
  const rightChunk = getChunk(add(chunkIJ, [1, 0]), worker.realmEntity, worker.ecs);

  const cells = new Map2D<Cell>((i, j) => {
    const upEdgeCell = upChunk?.cells.get(i, 0);
    const bottomEdgeCell = bottomChunk?.cells.get(i, CHUNK_SIZE - 1);
    const leftEdgeCell = leftChunk?.cells.get(CHUNK_SIZE - 1, j);
    const rightEdgeCell = rightChunk?.cells.get(0, j);

    const cellCoordPercentage = [i / CHUNK_SIZE, j / CHUNK_SIZE].map(p => p + CELL_MIDDLE_PERCENTAGE_OFFSET);
    const [altitudeSum, flatnessSum, divideFactor] = ([
      [upEdgeCell, 1 - cellCoordPercentage[1]],
      [bottomEdgeCell, cellCoordPercentage[1]],
      [leftEdgeCell, 1 - cellCoordPercentage[0]],
      [rightEdgeCell, cellCoordPercentage[0]],
    ] as [Cell, number][]).filter(
      ([cell]) => cell
    ).reduce<[number, number, number]>(
      ([altitudeSum, flatnessSum, divideFactor], [cell, p]) => {
        return [
          altitudeSum + cell.altitude * p,
          flatnessSum + cell.flatness * p,
          divideFactor + p,
        ]
      },
      [0, 0, 0],
    );

    const altitude = divideFactor <= 0 ? 0 : altitudeSum / divideFactor;
    const flatness = divideFactor <= 0 ? 0 : flatnessSum / divideFactor;
    return { altitude, flatness };
  }, 0, CHUNK_SIZE - 1, 0, CHUNK_SIZE - 1);

  let textureUrl = '';
  let repeatable = false;
  const repeatableChunk = [upChunk, bottomChunk, leftChunk, rightChunk].find(chunk => chunk?.repeatable);
  if (repeatableChunk) {
    textureUrl = repeatableChunk.textureUrl;
    repeatable = true;
  }

  const chunkEntity = worker.ecs.allocate();
  worker.ecs.setComponent(chunkEntity, 'chunk', {
    cells,
    chunkIJ,
    subObjs: [], // not used
    persistance: false,
    repeatable,
    textureUrl,
  });

  realm.chunks.put(...chunkIJ, chunkEntity);

  return chunkEntity;
}

function updateCells(chunkIJ: Vec2, cellEntries: [[number, number], Cell][], worker: RealmWorker) {
  log(`updateCells on ${chunkIJ.join(', ')}`);
  cellEntries.forEach(([cellIJ, cell]) => {
    const existingCell = getChunkCell(chunkIJ, cellIJ, worker.realmEntity, worker.ecs);
    (Object.keys(cell) as (keyof Cell)[]).forEach(key => {
      existingCell[key] = cell[key];
    });
  });

  startGenerateChunksAroundAttrs([chunkIJ], worker);
}

/**
 * @param chunkIJs - first in first out
 */
function startGenerateChunksAroundAttrs(chunkIJs: Vec2[], worker: RealmWorker) {
  const realm = worker.ecs.getComponent(worker.realmEntity, 'obj/realm');
  const chunkIJSet = new SetVec2();
  const aroundChunkIJs = new SetVec2();
  chunkIJs.forEach(chunkIJ => {
    chunkIJSet.add(chunkIJ);
  });

  chunkIJs.forEach(chunkIJ => {
    rangeVec2s(chunkIJ, 1).forEach(ij => {
      if (chunkIJSet.has(ij)) return;
      aroundChunkIJs.add(ij);
    });
  });

  const chunkEntities = [
    ...chunkIJs,
    ...aroundChunkIJs.values()
  ].map(chunkIJ => (
    realm.chunks.get(...chunkIJ)
  )).filter(
    chunkEntity => !!chunkEntity
  );

  log('startGenerateChunksAroundAttrs: starting generateChunksAttrs', { chunkEntities });
  generateChunksAttrs(chunkEntities, worker);
}

function generateChunksAttrs(queue: EntityRef[], worker: RealmWorker) {
  setTimeout(() => {
    if (queue.length <= 0) {
      return log('generateChunksAttrs: completed');
    }

    const chunkEntity = queue.shift();
    const chunk = worker.ecs.getComponent(chunkEntity, 'chunk');
    if (!chunk) {
      return log('generateChunksAttrs: chunk is null, which might be caused by changing realm, stopping...');
    }

    const attributeArrays = chunkAttributeArrays(chunkEntity, worker.realmEntity, worker.ecs);

    worker.notifyNewChunk(Comlink.transfer({
      chunkIJ: chunk.chunkIJ,
      repeatable: chunk.repeatable,
      textureUrl: chunk.textureUrl,
      attributeArrays,
      ...sendChunkCells(chunk, chunkEntity, worker),
    }, [attributeArrays.positions, attributeArrays.uvs]));

    generateChunksAttrs(queue, worker);
  });
}

function sendChunkCells(chunk: ChunkComponent, chunkEntity: EntityRef, worker: RealmWorker): Partial<Pick<ChunkGenerationResult, 'cellEntries'>> {
  const renderAttribute = getRenderAttrComponent(chunkEntity, worker);
  if (renderAttribute.cellSent) return {};
  renderAttribute.cellSent = true;

  return {
    cellEntries: chunk.cells.entries(),
  }
}

function getRenderAttrComponent(chunkEntity: EntityRef, worker: RealmWorker): ChunkRenderAttributeComponent {
  let component = worker.ecs.getComponent(chunkEntity, 'chunk/renderAttribute')
  if (component) return component;

  component = {
    cellSent: false,
    attributesGenerated: false,
  }
  worker.ecs.setComponent(chunkEntity, 'chunk/renderAttribute', component);

  return component;
}
