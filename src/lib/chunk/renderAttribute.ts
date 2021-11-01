import * as THREE from 'three';
import Delatin from 'delatin';

import { GameECS } from '../gameECS';
import { Cell, getChunkCell, calcAltitudeInChunk } from './chunk';

import { EntityRef } from '../utils/ecs';
import {
  Vec2, Vec3,
  stepVec, add, averagePresentNumbers,
  sub, cross, normalize,
} from '../utils/utils';

import { CHUNK_SIZE, CELL_STEPS, CHUNK_CELL_RESOLUTION, CHUNK_GEOMETRY_DELATIN_MAX_ERROR } from '../consts';

export interface ChunkRenderAttributeComponent {
  cellSent: boolean;
  attributesGenerated: boolean;
}

export interface AttributeArrays {
  positions: ArrayBuffer,
  uvs: ArrayBuffer,
  normals: ArrayBuffer;
  indices: ArrayBuffer;
}

interface CellAttributeArrays {
  positions: number[],
  uvs: number[],
  normals: number[];
}

interface Point {
  position: Vec3;
  uv: Vec2;
}

const CHUNK_RESOLUTION = CHUNK_CELL_RESOLUTION * CHUNK_SIZE + 1;
const CHUNK_POS_MULT = 1 / CHUNK_CELL_RESOLUTION;
const CHUNK_UV_MULT = 1 / CHUNK_RESOLUTION;
const CHUNK_XZ_POSITION_OFFSET = CHUNK_SIZE * -0.5;

export function chunkAttributeArrays(chunkEntity: EntityRef, realmEntity: EntityRef, ecs: GameECS): AttributeArrays {
  const chunk = ecs.getComponent(chunkEntity, 'chunk');
  const { chunkIJ } = chunk;

  const data = Array(CHUNK_RESOLUTION).fill(null).flatMap((_, j) => (
    Array(CHUNK_RESOLUTION).fill(null).map((_, i) => {
      const localPos: Vec2 = [i * CHUNK_POS_MULT, j * CHUNK_POS_MULT];
      const cellIJ = localPos.map(Math.floor) as Vec2;
      const cell = chunk.cells.get(...cellIJ);

      return calcAltitudeInChunk(localPos, {
        cellIJ, cell, chunkIJ, chunk,
      }, realmEntity, ecs);
    })
  ));

  const delatin = new Delatin(data, CHUNK_RESOLUTION, CHUNK_RESOLUTION);
  delatin.run(CHUNK_GEOMETRY_DELATIN_MAX_ERROR);

  const positionsData: number[] = [];
  const uvsData: number[] = [];
  Array(delatin.coords.length >> 1).fill(null).forEach((_, index) => {
    const i = delatin.coords[index * 2];
    const j = delatin.coords[index * 2 + 1];
    positionsData.push(
      i * CHUNK_POS_MULT + CHUNK_XZ_POSITION_OFFSET,
      delatin.heightAt(i, j),
      j * CHUNK_POS_MULT + CHUNK_XZ_POSITION_OFFSET,
    );
    uvsData.push(
      i * CHUNK_UV_MULT,
      j * CHUNK_UV_MULT,
    );
  });

  const positionsArray = new Float32Array(positionsData);
  const uvsArray = new Float32Array(uvsData);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(
    positionsArray, 3,
  ));
  geometry.setAttribute('uv', new THREE.BufferAttribute(
    uvsArray, 2,
  ));
  geometry.setIndex(delatin.triangles);
  geometry.computeVertexNormals();

  const normalArray = geometry.getAttribute('normal').array as Float32Array;
  const indicesArray = geometry.index.array as Uint16Array;

  return {
    positions: positionsArray.buffer,
    uvs: uvsArray.buffer,
    normals: normalArray.buffer,
    indices: indicesArray.buffer,
  }
}

export function chunkAttributeArraysBak(chunkEntity: EntityRef, realmEntity: EntityRef, ecs: GameECS): AttributeArrays {
  const chunk = ecs.getComponent(chunkEntity, 'chunk');;
  const { chunkIJ } = chunk;
  const { positions, uvs, normals } = chunk.cells.entries().map(([ij, cell]) => (
    cellAttributeArrays(cell, chunkIJ, ij, realmEntity, ecs)
  )).reduce((attributeArrays, cellAttributeArrays) => {
    return {
      positions: [...attributeArrays.positions, ...cellAttributeArrays.positions],
      uvs: [...attributeArrays.uvs, ...cellAttributeArrays.uvs],
      normals: [...attributeArrays.normals, ...cellAttributeArrays.normals],
    }
  }, { positions: [], uvs: [], normals: [] });

  return {
    positions: (new Float32Array(positions)).buffer,
    uvs: (new Float32Array(uvs)).buffer,
    normals: (new Float32Array(normals)).buffer,
    indices: (new Uint16Array()).buffer,
  };
}

function cellAttributeArrays(cell: Cell, chunkIJ: Vec2, ij: Vec2, realmEntity: EntityRef, ecs: GameECS): CellAttributeArrays {
  const neighbors = [
    getChunkCell(chunkIJ, add(ij, [-1, 1]), realmEntity, ecs), // left top
    getChunkCell(chunkIJ, add(ij, [0, 1]), realmEntity, ecs),
    getChunkCell(chunkIJ, add(ij, [1, 1]), realmEntity, ecs), // right top
    getChunkCell(chunkIJ, add(ij, [-1, 0]), realmEntity, ecs),
    cell, // center
    getChunkCell(chunkIJ, add(ij, [1, 0]), realmEntity, ecs),
    getChunkCell(chunkIJ, add(ij, [-1, -1]), realmEntity, ecs), // left bottom
    getChunkCell(chunkIJ, add(ij, [0, -1]), realmEntity, ecs),
    getChunkCell(chunkIJ, add(ij, [1, -1]), realmEntity, ecs), // right bottom
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
    uv: [centerPosition[0] / CHUNK_SIZE + uvOffset[0], centerPosition[2] / CHUNK_SIZE + uvOffset[1]],
  };
  const points: Point[][] = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map((signs, cornerI) => {
    const bezierPoints = [
      centerPoint.position,
      add([
        ij[0] + cell.flatness * 0.05 * signs[0],
        cell.altitude,
        ij[1] + cell.flatness * 0.05 * signs[1],
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
        const position = stepVec(
          stepVec(bezierPoints[0], bezierPoints[1], progress),
          stepVec(bezierPoints[1], bezierPoints[2], progress),
          progress,
        );

        return {
          position,
          uv: [
            position[0] / CHUNK_SIZE + uvOffset[0],
            position[2] / CHUNK_SIZE + uvOffset[1],
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

  const normals = [[0, 1], [1, 3], [3, 2], [2, 0]].flatMap(cornerIs => ([
    ...calcTriangleNormal(
      centerPoint.position,
      points[cornerIs[0]][0].position,
      points[cornerIs[1]][0].position,
    ),
    ...Array(CELL_STEPS - 1).fill(null).map((_, i) => i + 1).flatMap(i => ([
      ...calcTriangleNormal(
        points[cornerIs[0]][i-1].position,
        points[cornerIs[0]][i].position,
        points[cornerIs[1]][i-1].position,
      ),

      ...calcTriangleNormal(
        points[cornerIs[0]][i].position,
        points[cornerIs[1]][i].position,
        points[cornerIs[1]][i-1].position,
      ),
    ]))
  ])).flat();

  return { positions, uvs, normals };
}

function calcTriangleNormal(p1: Vec3, p2: Vec3, p3: Vec3): Vec3[] {
  const normal = calcNormal(p1, p2, p3);
  return [normal, normal, normal];
}

function calcNormal(p1: Vec3, p2: Vec3, p3: Vec3): Vec3 {
  const v1 = normalize(sub(p2, p1));
  const v2 = normalize(sub(p3, p1));
  return normalize(cross(v1, v2));
}
