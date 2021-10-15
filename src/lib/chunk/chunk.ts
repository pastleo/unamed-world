import { Game } from '../game';

import { Vec2, Vec3, mod, warnIfNotPresent } from '../utils/utils';
import { EntityRef } from '../utils/ecs';
import Map2D from '../utils/map2d';

import { CHUNK_SIZE } from '../consts';

export interface ChunkComponent {
  cells: Map2D<Cell>;
  chunkEntity: EntityRef;
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
  chunkEntity: EntityRef;
  chunkIJ: Vec2;
}
export function locateChunkCell(position: Vec3, game: Game): Located {
  const chunkIJ = [
    Math.floor((position[0] + CHUNK_SIZE / 2) / CHUNK_SIZE),
    Math.floor((position[2] + CHUNK_SIZE / 2) / CHUNK_SIZE),
  ] as Vec2;

  const chunk = getChunk(chunkIJ, game);
  
  const cellIJ = [
    Math.floor(position[0] + CHUNK_SIZE / 2 - chunkIJ[0] * CHUNK_SIZE),
    Math.floor(position[2] + CHUNK_SIZE / 2 - chunkIJ[1] * CHUNK_SIZE),
  ] as Vec2;

  return {
    cell: chunk.cells.get(...cellIJ),
    cellIJ,
    chunkEntity: chunk.chunkEntity,
    chunk,
    chunkIJ,
  }
}

export function getChunk(chunkIJ: Vec2, game: Game): ChunkComponent {
  const chunks = game.ecs.getComponent(game.realm.currentObj, 'obj/realm')?.chunks;
  if (warnIfNotPresent(chunks)) return null;

  let chunkEntity = chunks.get(chunkIJ[0], chunkIJ[1]);
  let chunk = game.ecs.getComponent(chunkEntity, 'chunk');
  
  if (!chunk) {
    chunkEntity = game.ecs.allocate();
    chunk = {
      cells: tmpChunkCells(),
      chunkEntity,
      chunkIJ,
      subObjs: [],
      persistance: false,
      textureUrl: '',
    }
    game.ecs.setComponent(chunkEntity, 'chunk', chunk);
    chunks.put(chunkIJ[0], chunkIJ[1], chunkEntity);
    return chunk;
  };
  return chunk;
}

export function getChunkCell(chunkIJ: Vec2, cellIJ: Vec2, game: Game): Cell {
  const chunkOffsetI = Math.floor(cellIJ[0] / CHUNK_SIZE);
  const chunkOffsetJ = Math.floor(cellIJ[1] / CHUNK_SIZE);

  const chunk = getChunk([chunkIJ[0] + chunkOffsetI, chunkIJ[1] + chunkOffsetJ], game);

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
    getChunkCell(located.chunkIJ, [cellI - 1 + offsetI, cellJ + 0 + offsetJ], game),
    getChunkCell(located.chunkIJ, [cellI + 0 + offsetI, cellJ + 0 + offsetJ], game),
    getChunkCell(located.chunkIJ, [cellI - 1 + offsetI, cellJ - 1 + offsetJ], game),
    getChunkCell(located.chunkIJ, [cellI + 0 + offsetI, cellJ - 1 + offsetJ], game),
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
