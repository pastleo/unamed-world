import { Required } from 'utility-types';

import { Game } from '../game';
import { GameECS, GameEntityComponents } from '../gameECS';

import { Vec2, Vec3, mod, warnIfNotPresent, add, sub, multiply } from '../utils/utils';
import { EntityRef, UUID, entityEqual } from '../utils/ecs';
import Map2D, { Map2DEntries } from '../utils/map2d';

import { CHUNK_SIZE } from '../consts';

export type ChunkEntityComponents = GameEntityComponents;

export interface ChunkComponent {
  chunkIJ: Vec2;
  cells: Map2D<Cell>;
  subObjs: EntityRef[];
  persistance: boolean;
  textureUrl: string;
}

export interface Cell {
  altitude: number;
  flatness: number;
  //sharpness: number;
  //uv: [number, number];
}

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
  const [cellI, cellJ] = located.cellIJ;
  const offsetI = Math.floor((position[0] + CELL_OFFSET) * 2) - Math.floor(position[0] + CELL_OFFSET - 1) * 2 - 2;
  const offsetJ = Math.floor((position[2] + CELL_OFFSET) * 2) - Math.floor(position[2] + CELL_OFFSET - 1) * 2 - 2;

  const cellZs = [
    getOrCreateChunkCell(located.chunkIJ, [cellI - 1 + offsetI, cellJ + 0 + offsetJ], game.realm.currentObj, game.ecs),
    getOrCreateChunkCell(located.chunkIJ, [cellI + 0 + offsetI, cellJ + 0 + offsetJ], game.realm.currentObj, game.ecs),
    getOrCreateChunkCell(located.chunkIJ, [cellI - 1 + offsetI, cellJ - 1 + offsetJ], game.realm.currentObj, game.ecs),
    getOrCreateChunkCell(located.chunkIJ, [cellI + 0 + offsetI, cellJ - 1 + offsetJ], game.realm.currentObj, game.ecs),
  ].map(c => c ?? located.cell).map(c => c.altitude);
  const progress = [mod(position[0] + CELL_OFFSET + 0.5, 1), mod(position[2] + CELL_OFFSET + 0.5, 1)];

  return (
    (cellZs[0] * (1 - progress[0]) + cellZs[1] * progress[0]) * progress[1] +
    (cellZs[2] * (1 - progress[0]) + cellZs[3] * progress[0]) * (1 - progress[1])
  );
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

export interface PackedChunkComponent {
  chunkIJ: Vec2;
  cellsEntries: Map2DEntries<Cell>;
  subObjs: UUID[];
  textureUrl: string;
}

export function pack(chunk: ChunkComponent, ecs: GameECS): PackedChunkComponent {
  const { chunkIJ, cells, subObjs, textureUrl } = chunk;
  return {
    chunkIJ,
    cellsEntries: cells.entries(),
    subObjs: subObjs.map(subObjEntity => ecs.getUUID(subObjEntity)),
    textureUrl,
  }
}

export function unpack(chunkEntity: EntityRef, packedChunk: PackedChunkComponent, ecs: GameECS) {
  const { chunkIJ, cellsEntries, subObjs, textureUrl } = packedChunk;
  ecs.setComponent(chunkEntity, 'chunk', {
    chunkIJ,
    cells: Map2D.fromEntries(cellsEntries),
    subObjs: subObjs.map(uuid => ecs.fromUUID(uuid)),
    textureUrl,
    persistance: true,
  });
}

function createTmpChunkComponent(chunkIJ: Vec2): ChunkComponent {
  return {
    cells: createTmpChunkCells(),
    chunkIJ,
    subObjs: [],
    persistance: false,
    textureUrl: '',
  }
}

function createTmpChunkCells(): Map2D<Cell> {
  return new Map2D<Cell>(() => (
    { altitude: 0, flatness: 0.5 }
  ), 0, CHUNK_SIZE - 1, 0, CHUNK_SIZE - 1);
}
