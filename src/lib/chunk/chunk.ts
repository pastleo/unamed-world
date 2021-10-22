import { Game } from '../game';
import { GameECS, GameEntityComponents } from '../gameECS';

import { Vec2, Vec3, mod, warnIfNotPresent } from '../utils/utils';
import { EntityRef } from '../utils/ecs';
import Map2D from '../utils/map2d';

import { CHUNK_SIZE } from '../consts';

export type ChunkEntityComponents = GameEntityComponents;

export interface ChunkComponent {
  cells: Map2D<Cell>;
  chunkIJ: Vec2;
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

export interface Located {
  cell: Cell;
  cellIJ: Vec2;
  chunk: ChunkComponent;
  chunkIJ: Vec2;
}
export function locateChunkCell(position: Vec3, game: Game): Located {
  const chunkIJ = [
    Math.floor((position[0] + CHUNK_SIZE / 2) / CHUNK_SIZE),
    Math.floor((position[2] + CHUNK_SIZE / 2) / CHUNK_SIZE),
  ] as Vec2;

  const chunk = getChunk(chunkIJ, game.realm.currentObj, game.ecs);
  
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

export function getChunkEntityComponents(chunkIJ: Vec2, realmEntity: EntityRef, ecs: GameECS, createChunkFn?: () => ChunkComponent): GameEntityComponents {
  const chunks = ecs.getComponent(realmEntity, 'obj/realm')?.chunks;
  if (warnIfNotPresent(chunks)) return null;

  let chunkEntity = chunks.get(chunkIJ[0], chunkIJ[1]);
  let chunkEntityComponents = ecs.getEntityComponents(chunkEntity);
  let chunk = chunkEntityComponents?.get('chunk');
  
  if (!chunk) {
    if (!createChunkFn) return null;

    chunkEntity = ecs.allocate();
    chunkEntityComponents = ecs.getEntityComponents(chunkEntity);
    chunk = createChunkFn();
    ecs.setComponent(chunkEntity, 'chunk', chunk);
    chunks.put(chunkIJ[0], chunkIJ[1], chunkEntity);
  };

  return chunkEntityComponents;
}

export function getChunk(chunkIJ: Vec2, realmEntity: EntityRef, ecs: GameECS, dontAutoCreate?: boolean): ChunkComponent {
  return getChunkEntityComponents(chunkIJ, realmEntity, ecs, dontAutoCreate ? null : () => ({
    cells: tmpChunkCells(),
    chunkIJ,
    subObjs: [],
    persistance: false,
    textureUrl: '',
  }))?.get('chunk');
}

export function createOrUpdateChunk(chunkSrc: ChunkComponent, chunkIJ: Vec2, realmEntity: EntityRef, ecs: GameECS): /* created: */ boolean {
  const chunks = ecs.getComponent(realmEntity, 'obj/realm')?.chunks;
  if (warnIfNotPresent(chunks)) return null;

  let chunkEntity = chunks.get(chunkIJ[0], chunkIJ[1]);

  if (ecs.getComponent(chunkEntity, 'chunk')) {
    ecs.setComponent(chunkEntity, 'chunk', chunkSrc);
    return false
  } else {
    chunkEntity = ecs.allocate();
    ecs.setComponent(chunkEntity, 'chunk', chunkSrc);
    chunks.put(chunkIJ[0], chunkIJ[1], chunkEntity);
    return true;
  };
}

export function getChunkCell(chunkIJ: Vec2, cellIJ: Vec2, realmEntity: EntityRef, ecs: GameECS, dontAutoCreate?: boolean): Cell {
  const chunkOffsetI = Math.floor(cellIJ[0] / CHUNK_SIZE);
  const chunkOffsetJ = Math.floor(cellIJ[1] / CHUNK_SIZE);

  const chunk = getChunk([chunkIJ[0] + chunkOffsetI, chunkIJ[1] + chunkOffsetJ], realmEntity, ecs, dontAutoCreate);

  if (!chunk) return null;

  return chunk.cells.get(
    cellIJ[0] - chunkOffsetI * CHUNK_SIZE,
    cellIJ[1] - chunkOffsetJ * CHUNK_SIZE,
  );
}

export function calcAltitudeAt(position: Vec3, located: Located, game: Game): number {
  const [cellI, cellJ] = located.cellIJ;
  const offsetI = Math.floor((position[0] + CELL_OFFSET) * 2) - Math.floor(position[0] + CELL_OFFSET - 1) * 2 - 2;
  const offsetJ = Math.floor((position[2] + CELL_OFFSET) * 2) - Math.floor(position[2] + CELL_OFFSET - 1) * 2 - 2;

  const cellZs = [
    getChunkCell(located.chunkIJ, [cellI - 1 + offsetI, cellJ + 0 + offsetJ], game.realm.currentObj, game.ecs),
    getChunkCell(located.chunkIJ, [cellI + 0 + offsetI, cellJ + 0 + offsetJ], game.realm.currentObj, game.ecs),
    getChunkCell(located.chunkIJ, [cellI - 1 + offsetI, cellJ - 1 + offsetJ], game.realm.currentObj, game.ecs),
    getChunkCell(located.chunkIJ, [cellI + 0 + offsetI, cellJ - 1 + offsetJ], game.realm.currentObj, game.ecs),
  ].map(c => c ?? located.cell).map(c => c.altitude);
  const progress = [mod(position[0] + CELL_OFFSET + 0.5, 1), mod(position[2] + CELL_OFFSET + 0.5, 1)];

  return (
    (cellZs[0] * (1 - progress[0]) + cellZs[1] * progress[0]) * progress[1] +
    (cellZs[2] * (1 - progress[0]) + cellZs[3] * progress[0]) * (1 - progress[1])
  );
}

function tmpChunkCells(): Map2D<Cell> {
  return new Map2D<Cell>(() => (
    { altitude: 0, flatness: 0.5 }
  ), 0, CHUNK_SIZE - 1, 0, CHUNK_SIZE - 1);
}
