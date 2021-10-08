import * as Comlink from 'comlink';

import { Realm } from '../realm';
import { Chunk, Cell, AttributeArrays, chunkAttributeArrays } from '../obj/chunk';
import { Vec2, rangeVec2s } from '../utils/utils';
import SetVec2 from '../utils/setVec2';
import Map2D from '../utils/map2d';
import { CHUNK_SIZE } from '../consts';
import { spawnService, createServiceNextValueFn, createListenToServiceFn } from '../utils/service';

import { createDevRealm } from '../dev-data';

const AUTO_GENERATION_RANGE = 4;

export interface ChunkGenerationResult {
  chunkI: number;
  chunkJ: number;
  cellEntries?: [[number, number], Cell][];
  textureUrl: string;
  attributeArrays: AttributeArrays;
}

interface RealmService {
  create: () => void;
  triggerRealmGeneration: (centerChunkIJ: Vec2) => void;
  nextGeneratedChunk: () => Promise<ChunkGenerationResult>;
}

function startService(): RealmService {
  let realm: Realm;
  const [notifyNewChunk, nextGeneratedChunk] = createServiceNextValueFn<ChunkGenerationResult>();

  return {
    create: () => {
      realm = createDevRealm();
      console.log('[realm service] realm created:', realm);
    },
    triggerRealmGeneration: (centerChunkIJ: Vec2) => {
      console.log('[realm service] triggerRealmGeneration', centerChunkIJ);
      generateRealmChunk(realm, centerChunkIJ, notifyNewChunk);
    },
    nextGeneratedChunk,
  }
}

export default startService;

// main thread API:
export const service = spawnService<RealmService>('realm');
export const listenToNextGeneratedChunk = createListenToServiceFn(service?.nextGeneratedChunk);
///////

const CELL_MIDDLE_PERCENTAGE_OFFSET = 1 / (CHUNK_SIZE * 2);
type GeneratedChunk = [chunkI: number, chunkJ: number, chunk: Chunk];
function generateRealmChunk(realm: Realm, centerChunkIJ: Vec2, notifyNewChunk: (value: ChunkGenerationResult) => void): GeneratedChunk[] {
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
  });

  const newChunks: GeneratedChunk[] = [];

  const newChunkIJs = new SetVec2();
  rangeVec2s(centerChunkIJ, AUTO_GENERATION_RANGE).forEach(([chunkI, chunkJ]) => {
    const chunk = realm.obj.chunks.get(chunkI, chunkJ);

    if (chunk.attributesGenerated) return;

    generateChunk(chunkI, chunkJ, chunk, realm, notifyNewChunk);
    newChunkIJs.add([chunkI, chunkJ]);
    newChunks.push([chunkI, chunkJ, chunk]);
  });

  if (newChunks.length <= 0) return;

  const reCalcChunkIJs = new SetVec2();
  newChunks.forEach(([chunkI, chunkJ]) => {
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

  reCalcChunkIJs.values().map(([chunkI, chunkJ]) => (
    [chunkI, chunkJ, realm.obj.chunks.get(chunkI, chunkJ)] as [number, number, Chunk]
  )).filter(
    ([_i, _j, chunk]) => chunk
  ).forEach(([chunkI, chunkJ, chunk]) => {
    generateChunk(chunkI, chunkJ, chunk, realm, notifyNewChunk);
  });
}

function generateChunk(chunkI: number, chunkJ: number, chunk: Chunk, realm: Realm, notifyNewChunk: (value: ChunkGenerationResult) => void) {
  const attributeArrays = chunkAttributeArrays(chunkI, chunkJ, realm.obj.chunks);
  chunk.attributesGenerated = true;

  notifyNewChunk(Comlink.transfer({
    chunkI, chunkJ,
    cellEntries: chunk.cells.entries(),
    textureUrl: chunk.textureUrl,
    attributeArrays,
  }, [attributeArrays.positions, attributeArrays.uvs]));
}
