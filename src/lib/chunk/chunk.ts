import * as ss from 'superstruct';
import { Required } from 'utility-types';

import { Game } from '../game';
import { GameECS, GameEntityComponents } from '../gameECS';

import {
  Vec2, Vec3,
  vec2Type, mod, warnIfNotPresent, add,
  sub, multiply, clamp, step, smooth,
} from '../utils/utils';
import { EntityRef, sidType, entityEqual } from '../utils/ecs';
import Map2D, { map2DEntriesType } from '../utils/map2d';

import { CHUNK_SIZE } from '../consts';

export type ChunkEntityComponents = GameEntityComponents;

export interface ChunkComponent {
  chunkIJ: Vec2;
  cells: Map2D<Cell>;
  subObjs: EntityRef[];
  persistance: boolean;
  repeatable: boolean;
  textureUrl: string;
}

export const cellType = ss.object({
  altitude: ss.number(),
  flatness: ss.number(),
});
export type Cell = ss.Infer<typeof cellType>;

const CELL_OFFSET = (CHUNK_SIZE / 2) % 1;
type CreateChunkFn = (chunkIJ: Vec2) => ChunkComponent;

export function createChunk(chunk: ChunkComponent, realmEntity: EntityRef, ecs: GameECS): EntityRef {
  const chunks = ecs.getComponent(realmEntity, 'obj/realm')?.chunks;
  if (warnIfNotPresent(chunks)) return null;

  const chunkEntity = ecs.allocate();
  ecs.setComponent(chunkEntity, 'chunk', chunk);
  chunks.put(...chunk.chunkIJ, chunkEntity);

  return chunkEntity;
}

export interface Located {
  cell: Cell;
  cellIJ: Vec2;
  chunk: ChunkComponent;
  chunkIJ: Vec2;
}
export function locateOrCreateChunkCell(
  position: Vec3, game: Game,
  createChunkFn: CreateChunkFn = createTmpChunkComponent,
): Located {
  if (Number.isNaN(position[0]) || Number.isNaN(position[2])) {
    console.warn('locateOrCreateChunkCell: position has NaN:', position);
    return null;
  }
  const chunkIJ = [
    Math.floor((position[0] + CHUNK_SIZE / 2) / CHUNK_SIZE),
    Math.floor((position[2] + CHUNK_SIZE / 2) / CHUNK_SIZE),
  ] as Vec2;

  const chunk = getOrCreateChunk(chunkIJ, game.realm.currentObj, game.ecs, createChunkFn);
  
  const cellIJ = [
    Math.floor(position[0] + CHUNK_SIZE / 2 - chunkIJ[0] * CHUNK_SIZE),
    Math.floor(position[2] + CHUNK_SIZE / 2 - chunkIJ[1] * CHUNK_SIZE),
  ] as Vec2;

  return {
    cell: chunk.cells.get(...cellIJ),
    cellIJ,
    chunk,
    chunkIJ,
  }
}

export function getChunkEntityComponents(chunkIJ: Vec2, realmEntity: EntityRef, ecs: GameECS): GameEntityComponents {
  const chunks = ecs.getComponent(realmEntity, 'obj/realm')?.chunks;
  if (warnIfNotPresent(chunks)) return null;

  let chunkEntity = chunks.get(chunkIJ[0], chunkIJ[1]);
  return ecs.getEntityComponents(chunkEntity);
}

export function getChunk(chunkIJ: Vec2, realmEntity: EntityRef, ecs: GameECS): ChunkComponent {
  const chunkComponents = getChunkEntityComponents(chunkIJ, realmEntity, ecs);
  return chunkComponents ? chunkComponents.get('chunk') : null;
}

export function getOrCreateChunk(
  chunkIJ: Vec2, realmEntity: EntityRef, ecs: GameECS,
  createChunkFn: CreateChunkFn = createTmpChunkComponent,
): ChunkComponent {
  let chunk = getChunk(chunkIJ, realmEntity, ecs);
  if (!chunk) {
    chunk = createChunkFn(chunkIJ);
    createChunk(chunk, realmEntity, ecs);
  }
  return chunk
}

export function getChunkCell(chunkIJSrc: Vec2, cellIJSrc: Vec2, realmEntity: EntityRef, ecs: GameECS): Cell {
  const [chunkIJ, cellIJ] = correctChunkCellIJ(chunkIJSrc, cellIJSrc);

  const chunk = getChunk(chunkIJ, realmEntity, ecs);
  if (!chunk) return null;

  return chunk.cells.get(...cellIJ);
}

export function getOrCreateChunkCell(
  chunkIJSrc: Vec2, cellIJSrc: Vec2, realmEntity: EntityRef, ecs: GameECS,
  createChunkFn: CreateChunkFn = createTmpChunkComponent,
): Cell {
  const [chunkIJ, cellIJ] = correctChunkCellIJ(chunkIJSrc, cellIJSrc);

  const chunk = getOrCreateChunk(chunkIJ, realmEntity, ecs, createChunkFn);
  if (warnIfNotPresent(chunk)) return null;

  return chunk.cells.get(...cellIJ);
}

function correctChunkCellIJ(chunkIJ: Vec2, cellIJ: Vec2): [chunkIJ: Vec2, cellIJ: Vec2] {
  const chunkOffsetIJ: Vec2 = [
    Math.floor(cellIJ[0] / CHUNK_SIZE),
    Math.floor(cellIJ[1] / CHUNK_SIZE),
  ];

  return [
    add(chunkIJ, chunkOffsetIJ),
    sub(cellIJ, multiply(chunkOffsetIJ, CHUNK_SIZE)),
  ];
}

export function calcAltitudeAt(position: Vec3, located: Located, game: Game): number {
  return calcAltitudeInChunk([position[0] + CELL_OFFSET, position[2] + CELL_OFFSET], located, game.realm.currentObj, game.ecs);
}

export function calcAltitudeInChunk(localPos: Vec2, located: Located, realmEntity: EntityRef, ecs: GameECS): number {
  const [cellI, cellJ] = located.cellIJ;
  const offsetI = Math.floor(localPos[0] * 2) - Math.floor(localPos[0] - 1) * 2 - 2;
  const offsetJ = Math.floor(localPos[1] * 2) - Math.floor(localPos[1] - 1) * 2 - 2;
  const ratios = [mod(localPos[0] + 0.5, 1), mod(localPos[1] + 0.5, 1)];

  const cells = [
    getOrCreateChunkCell(located.chunkIJ, [cellI - 1 + offsetI, cellJ - 1 + offsetJ], realmEntity, ecs),
    getOrCreateChunkCell(located.chunkIJ, [cellI + 0 + offsetI, cellJ - 1 + offsetJ], realmEntity, ecs),
    getOrCreateChunkCell(located.chunkIJ, [cellI - 1 + offsetI, cellJ + 0 + offsetJ], realmEntity, ecs),
    getOrCreateChunkCell(located.chunkIJ, [cellI + 0 + offsetI, cellJ + 0 + offsetJ], realmEntity, ecs),
  ].map(c => c ?? located.cell);
  const [flatnessXA, flatnessXB] = (ratios[1] > 0.5 ? [cells[2], cells[3]] : [cells[0], cells[1]]).map(c => clamp(c.flatness, 0.25, 50));
  const [flatnessZA, flatnessZB] = (ratios[0] > 0.5 ? [cells[1], cells[3]] : [cells[0], cells[2]]).map(c => clamp(c.flatness, 0.25, 50));
  const smoothRatio = [
    smooth(ratios[0], flatnessXA, flatnessXB),
    smooth(ratios[1], flatnessZA, flatnessZB),
  ];

  return (
    step(
      step(cells[0].altitude, cells[1].altitude, smoothRatio[0]),
      step(cells[2].altitude, cells[3].altitude, smoothRatio[0]),
      smoothRatio[1],
    )
  );
}

export function calcCellLocation(located: Located): Vec2 {
  return [
    (located.chunkIJ[0] - 0.5) * CHUNK_SIZE + located.cellIJ[0] + 0.5,
    (located.chunkIJ[1] - 0.5) * CHUNK_SIZE + located.cellIJ[1] + 0.5,
  ]
}

export function mergeChunk(chunkSrc: Required<Partial<ChunkComponent>, 'chunkIJ'>, game: Game) {
  const chunkEntityComponents = getChunkEntityComponents(chunkSrc.chunkIJ, game.realm.currentObj, game.ecs);
  if (warnIfNotPresent(chunkEntityComponents)) return;
  const chunk = chunkEntityComponents.get('chunk');
  chunkEntityComponents.set('chunk', {
    ...chunk,
    ...chunkSrc,
    persistance: chunkSrc.persistance || chunk.persistance,
    subObjs: [
      ...chunk.subObjs,
      ...chunkSrc.subObjs.filter(
        srcSobj => chunk.subObjs.findIndex(
          existingSobj => entityEqual(srcSobj, existingSobj)
        ) === -1
      )
    ],
  });
}

export function destroy(chunkEntityComponents: GameEntityComponents, ecs: GameECS) {
  ecs.deallocate(chunkEntityComponents.entity);
}

export const packedChunkComponentType = ss.object({
  chunkIJ: vec2Type,
  cellsEntries: map2DEntriesType(cellType),
  subObjs: ss.array(sidType),
  repeatable: ss.boolean(),
  textureUrl: ss.string(),
});
export type PackedChunkComponent = ss.Infer<typeof packedChunkComponentType>;

export function pack(chunk: ChunkComponent, ecs: GameECS): PackedChunkComponent {
  const { chunkIJ, cells, subObjs, textureUrl, repeatable } = chunk;
  return {
    chunkIJ,
    cellsEntries: cells.entries(),
    subObjs: subObjs.map(subObjEntity => ecs.getSid(subObjEntity)),
    textureUrl,
    repeatable,
  }
}

export function unpack(chunkEntity: EntityRef, packedChunk: PackedChunkComponent, ecs: GameECS) {
  const { chunkIJ, cellsEntries, subObjs, textureUrl, repeatable } = packedChunk;
  ecs.setComponent(chunkEntity, 'chunk', {
    chunkIJ,
    cells: Map2D.fromEntries(cellsEntries),
    subObjs: subObjs.map(sid => ecs.fromSid(sid)),
    textureUrl,
    persistance: true,
    repeatable,
  });
}

function createTmpChunkComponent(chunkIJ: Vec2): ChunkComponent {
  return {
    cells: createTmpChunkCells(),
    chunkIJ,
    subObjs: [],
    persistance: false,
    repeatable: false,
    textureUrl: '',
  }
}

function createTmpChunkCells(): Map2D<Cell> {
  return new Map2D<Cell>(() => (
    { altitude: 0, flatness: 4 }
  ), 0, CHUNK_SIZE - 1, 0, CHUNK_SIZE - 1);
}
