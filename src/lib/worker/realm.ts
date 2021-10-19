import * as Comlink from 'comlink';

import { GameECS, init as initECS } from '../gameECS';
import { Cell, getChunk, getChunkCell } from '../chunk/chunk';
import { AttributeArrays } from '../chunk/renderAttribute';

import { EntityRef } from '../utils/ecs';
import { Vec2, Vec3, rangeVec2s, step, add, averagePresentNumbers } from '../utils/utils';
import SetVec2 from '../utils/setVec2';
import Map2D from '../utils/map2d';
import { createWorkerNextValueFn } from '../utils/worker';

import { CHUNK_SIZE, CELL_STEPS } from '../consts';
import { backgrounds, loadRealmComponents } from '../dev-data';

const AUTO_GENERATION_RANGE = 4;

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
  const realmEntity = ecs.allocate();

  ecs.setComponent(realmEntity, 'obj/realm', {
    chunks: new Map2D(),
    backgrounds,
  });

  const [notifyNewChunk, nextGeneratedChunk] = createWorkerNextValueFn<ChunkGenerationResult>();


  const worker: RealmWorkerGlobal = {
    ecs, realmEntity,
    generatingChunkQueue: [],
    notifyNewChunk,
  };

  return {
    create: () => {
      loadRealmComponents(realmEntity, ecs);
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
  rangeVec2s(centerChunkIJ, AUTO_GENERATION_RANGE).forEach(chunkIJ => {
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
        ([zSum, zDivideFactor], [cell, p]) => ([zSum + cell.altitude * p, zDivideFactor + p]),
        [0, 0],
      );

      return { altitude: zSum / zDivideFactor, flatness: 0.5 };
    }, 0, CHUNK_SIZE - 1, 0, CHUNK_SIZE - 1);

    const chunkEntity = worker.ecs.allocate();
    worker.ecs.setComponent(chunkEntity, 'chunk', {
      cells,
      chunkEntity,
      chunkIJ,
      subObjs: [], // not used
      persistance: false,
      textureUrl: (upChunk || bottomChunk || leftChunk || rightChunk).textureUrl || '',
    });

   realm.chunks.put(...chunkIJ, chunkEntity);
  });

  const newChunks: [chunkIJ: Vec2, chunkEntity: EntityRef][] = [];

  const newChunkIJs = new SetVec2();
  rangeVec2s(centerChunkIJ, AUTO_GENERATION_RANGE).forEach(chunkIJ => {
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

    const attributeArrays = chunkAttributeArrays(chunkEntity, worker);

    worker.notifyNewChunk(Comlink.transfer({
      chunkIJ: chunk.chunkIJ,
      cellEntries: chunk.cells.entries(),
      textureUrl: chunk.textureUrl,
      attributeArrays,
    }, [attributeArrays.positions, attributeArrays.uvs]));

    generateChunkAttrs(worker);
  });
}

interface Point {
  position: [number, number, number];
  uv: [number, number];
  //normal: [number, number, number];
}
export function chunkAttributeArrays(chunkEntity: EntityRef, worker: RealmWorkerGlobal): AttributeArrays {
  const chunk = worker.ecs.getComponent(chunkEntity, 'chunk');;
  const { chunkIJ } = chunk;
  const { positions, uvs } = chunk.cells.entries().map(([ij, cell]) => (
    cellAttributeArrays(cell, chunkIJ, ij, worker)
  )).reduce((attributeArrays, cellAttributeArrays) => {
    return {
      positions: [...attributeArrays.positions, ...cellAttributeArrays.positions],
      uvs: [...attributeArrays.uvs, ...cellAttributeArrays.uvs],
    }
  }, { positions: [], uvs: [] });

  return {
    positions: (new Float32Array(positions)).buffer,
    uvs: (new Float32Array(uvs)).buffer,
  };
}

export interface CellAttributeArrays {
  positions: number[],
  uvs: number[],
}
function cellAttributeArrays(cell: Cell, chunkIJ: Vec2, ij: Vec2, worker: RealmWorkerGlobal): CellAttributeArrays {
  const neighbors = [
    getChunkCell(chunkIJ, add(ij, [-1, 1]), worker.realmEntity, worker.ecs, true), // left top
    getChunkCell(chunkIJ, add(ij, [0, 1]), worker.realmEntity, worker.ecs, true),
    getChunkCell(chunkIJ, add(ij, [1, 1]), worker.realmEntity, worker.ecs, true), // right top
    getChunkCell(chunkIJ, add(ij, [-1, 0]), worker.realmEntity, worker.ecs, true),
    cell, // center
    getChunkCell(chunkIJ, add(ij, [1, 0]), worker.realmEntity, worker.ecs, true), 
    getChunkCell(chunkIJ, add(ij, [-1, -1]), worker.realmEntity, worker.ecs, true), // left bottom
    getChunkCell(chunkIJ, add(ij, [0, -1]), worker.realmEntity, worker.ecs, true),
    getChunkCell(chunkIJ, add(ij, [1, -1]), worker.realmEntity, worker.ecs, true), // right bottom
  ];

  const cornerAltitude = [
    averagePresentNumbers(
      neighbors[0]?.altitude, neighbors[1]?.altitude, neighbors[3]?.altitude, neighbors[4]?.altitude,
    ),
    averagePresentNumbers(
      neighbors[1]?.altitude, neighbors[2]?.altitude, neighbors[4]?.altitude, neighbors[5]?.altitude,
    ),
    averagePresentNumbers(
      neighbors[3]?.altitude, neighbors[4]?.altitude, neighbors[6]?.altitude, neighbors[7]?.altitude,
    ),
    averagePresentNumbers(
      neighbors[4]?.altitude, neighbors[5]?.altitude, neighbors[7]?.altitude, neighbors[8]?.altitude,
    ),
  ];

  const positionOffset = [-CHUNK_SIZE / 2 + 0.5, 0, -CHUNK_SIZE / 2 + 0.5] as Vec3;
  const uvOffset = [0.5, 0.5];
  const centerPosition = add([ij[0], cell.altitude, ij[1]] as Vec3, positionOffset);
  const centerPoint: Point = {
    position: centerPosition,
    uv: [(centerPosition[0] + uvOffset[0]) / CHUNK_SIZE, (centerPosition[2] + uvOffset[1]) / CHUNK_SIZE]
  };
  const points: Point[][] = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map((signs, cornerI) => {
    const bezierPoints = [
      centerPoint.position,
      add([
        ij[0] + cell.flatness * 0.5 * signs[0],
        cell.altitude,
        ij[1] + cell.flatness * 0.5 * signs[1],
      ], positionOffset),
      add([
        ij[0] + 0.5 * signs[0],
        cornerAltitude[cornerI],
        ij[1] + 0.5 * signs[1],
      ], positionOffset),
    ];

    return Array(CELL_STEPS).fill(null).map(
      (_, stepI) => (stepI + 1) / CELL_STEPS
    ).map(
      progress => {
        const position = step(
          step(bezierPoints[0], bezierPoints[1], progress),
          step(bezierPoints[1], bezierPoints[2], progress),
          progress,
        ) as [number, number, number];

        return {
          position,
          uv: [
            (position[0] + uvOffset[0]) / CHUNK_SIZE,
            (position[2] + uvOffset[1]) / CHUNK_SIZE,
          ],
        };
      }
    );
  });

  const positions = [[0, 1], [1, 3], [3, 2], [2, 0]].flatMap(cornerIs => ([
    centerPoint.position,
    points[cornerIs[0]][0].position,
    points[cornerIs[1]][0].position,
    ...Array(CELL_STEPS - 1).fill(null).map((_, i) => i + 1).flatMap(i => ([
      points[cornerIs[0]][i-1].position,
      points[cornerIs[0]][i].position,
      points[cornerIs[1]][i-1].position,

      points[cornerIs[0]][i].position,
      points[cornerIs[1]][i].position,
      points[cornerIs[1]][i-1].position,
    ]))
  ])).flat();

  const uvs = [[0, 1], [1, 3], [3, 2], [2, 0]].flatMap(cornerIs => ([
    centerPoint.uv,
    points[cornerIs[0]][0].uv,
    points[cornerIs[1]][0].uv,
    ...Array(CELL_STEPS - 1).fill(null).map((_, i) => i + 1).flatMap(i => ([
      points[cornerIs[0]][i-1].uv,
      points[cornerIs[0]][i].uv,
      points[cornerIs[1]][i-1].uv,

      points[cornerIs[0]][i].uv,
      points[cornerIs[1]][i].uv,
      points[cornerIs[1]][i-1].uv,
    ]))
  ])).flat();

  return { positions, uvs };
}
