import { GameECS } from '../gameECS';
import { Cell, getChunkCell } from './chunk';

import { EntityRef } from '../utils/ecs';
import { Vec2, Vec3, step, add, averagePresentNumbers } from '../utils/utils';

import { CHUNK_SIZE, CELL_STEPS } from '../consts';

export interface ChunkRenderAttributeComponent {
  attributesGenerated: boolean;
}

export interface AttributeArrays {
  positions: ArrayBuffer,
  uvs: ArrayBuffer,
}

interface Point {
  position: [number, number, number];
  uv: [number, number];
  //normal: [number, number, number];
}

export function chunkAttributeArrays(chunkEntity: EntityRef, realmEntity: EntityRef, ecs: GameECS): AttributeArrays {
  const chunk = ecs.getComponent(chunkEntity, 'chunk');;
  const { chunkIJ } = chunk;
  const { positions, uvs } = chunk.cells.entries().map(([ij, cell]) => (
    cellAttributeArrays(cell, chunkIJ, ij, realmEntity, ecs)
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
function cellAttributeArrays(cell: Cell, chunkIJ: Vec2, ij: Vec2, realmEntity: EntityRef, ecs: GameECS): CellAttributeArrays {
  const neighbors = [
    getChunkCell(chunkIJ, add(ij, [-1, 1]), realmEntity, ecs, true), // left top
    getChunkCell(chunkIJ, add(ij, [0, 1]), realmEntity, ecs, true),
    getChunkCell(chunkIJ, add(ij, [1, 1]), realmEntity, ecs, true), // right top
    getChunkCell(chunkIJ, add(ij, [-1, 0]), realmEntity, ecs, true),
    cell, // center
    getChunkCell(chunkIJ, add(ij, [1, 0]), realmEntity, ecs, true), 
    getChunkCell(chunkIJ, add(ij, [-1, -1]), realmEntity, ecs, true), // left bottom
    getChunkCell(chunkIJ, add(ij, [0, -1]), realmEntity, ecs, true),
    getChunkCell(chunkIJ, add(ij, [1, -1]), realmEntity, ecs, true), // right bottom
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
