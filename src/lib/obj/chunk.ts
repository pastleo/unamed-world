import * as THREE from 'three';
import Obj from './obj';
import { SubObj, addSubObj } from './subObj';
import Map2D from '../utils/map2d';
import {
  Vec3, averagePresentNumbers, step, mod, add,
} from '../utils/utils';
import { CHUNK_SIZE, CELL_STEPS } from '../consts';

export interface Chunk {
  cells: Map2D<Cell>;
  textureUrl: string;
  subObjs: SubObj[];

  attributesGenerated?: boolean;
  mesh?: THREE.Mesh;
}

export interface Cell {
  altitude: number;
  flatness: number;
  //sharpness: number;
  //uv: [number, number];
}

const CELL_OFFSET = (CHUNK_SIZE / 2) % 1;

const chunkMaterialCache = new Map<string, THREE.MeshBasicMaterial>();

export function createChunkMesh(chunk: Chunk, chunkI: number, chunkJ: number, attributeArrays: AttributeArrays, loader: THREE.TextureLoader): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();

  let material: THREE.MeshBasicMaterial;
  const cachedMaterial = chunkMaterialCache.get(chunk.textureUrl);
  if (cachedMaterial) {
    material = cachedMaterial;
  } else {
    material = new THREE.MeshBasicMaterial({
      map: loader.load(chunk.textureUrl, texture => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
      }),
    });
    chunkMaterialCache.set(chunk.textureUrl, material);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(
    new Float32Array(attributeArrays.positions),
    3,
  ));
  geometry.setAttribute('uv', new THREE.BufferAttribute(
    new Float32Array(attributeArrays.uvs),
    2,
  ));

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.x = chunkI * CHUNK_SIZE;
  mesh.position.z = chunkJ * CHUNK_SIZE;
  return mesh;
}

export function reCalcChunkSubObjs(chunk: Chunk, realmObj: Obj, func: (subObj: SubObj, located: Located) => void): void {
  const subObjs = chunk.subObjs;
  chunk.subObjs = [];
  subObjs.forEach(({ obj, position }) => {
    const located = locateChunkCell(position[0], position[1], realmObj.chunks);
    const subObj = addSubObj(obj, realmObj, position[0], position[1], located);
    func(subObj, located);
  });
}

export function calcAltitudeAt(x: number, z: number, localed: Located, chunks: Map2D<Chunk>): number {
  const [cell, cellI, cellJ, _chunk, chunkI, chunkJ] = localed;

  const offsetI = Math.floor((x + CELL_OFFSET) * 2) - Math.floor(x + CELL_OFFSET - 1) * 2 - 2;
  const offsetJ = Math.floor((z + CELL_OFFSET) * 2) - Math.floor(z + CELL_OFFSET - 1) * 2 - 2;

  const cellZs = [
    getChunkCell(chunkI, chunkJ, cellI - 1 + offsetI, cellJ + 0 + offsetJ, chunks),
    getChunkCell(chunkI, chunkJ, cellI + 0 + offsetI, cellJ + 0 + offsetJ, chunks),
    getChunkCell(chunkI, chunkJ, cellI - 1 + offsetI, cellJ - 1 + offsetJ, chunks),
    getChunkCell(chunkI, chunkJ, cellI + 0 + offsetI, cellJ - 1 + offsetJ, chunks),
  ].map(c => c ?? cell).map(c => c.altitude);
  const progress = [mod(x + CELL_OFFSET + 0.5, 1), mod(z + CELL_OFFSET + 0.5, 1)];

  return (
    (cellZs[0] * (1 - progress[0]) + cellZs[1] * progress[0]) * progress[1] +
    (cellZs[2] * (1 - progress[0]) + cellZs[3] * progress[0]) * (1 - progress[1])
  );
}

export type Located = [cell: Cell, cellI: number, cellJ: number, chunk: Chunk, chunkI: number, chunkJ: number];
export function locateChunkCell(x: number, z: number, chunks: Map2D<Chunk>): Located {
  const chunkI = Math.floor((x + CHUNK_SIZE / 2) / CHUNK_SIZE);
  const chunkJ = Math.floor((z + CHUNK_SIZE / 2) / CHUNK_SIZE);
  const chunk = chunks.get(chunkI, chunkJ);
  if (!chunk) return null;

  const cellI = Math.floor(x + CHUNK_SIZE / 2 - chunkI * CHUNK_SIZE);
  const cellJ = Math.floor(z + CHUNK_SIZE / 2 - chunkJ * CHUNK_SIZE);

  return [
    chunk.cells.get(cellI, cellJ),
    cellI, cellJ,
    chunk,
    chunkI, chunkJ,
  ];
}

export function getChunkCell(chunkI: number, chunkJ: number, cellI: number, cellJ: number, chunks: Map2D<Chunk>): Cell {
  const chunkOffsetI = Math.floor(cellI / CHUNK_SIZE);
  const chunkOffsetJ = Math.floor(cellJ / CHUNK_SIZE);
  const chunk = chunks.get(chunkI + chunkOffsetI, chunkJ + chunkOffsetJ);
  if (!chunk) return null;
  return chunk.cells.get(
    cellI - chunkOffsetI * CHUNK_SIZE,
    cellJ - chunkOffsetJ * CHUNK_SIZE,
  );
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

export function chunkAttributeArrays(chunkI: number, chunkJ: number, chunks: Map2D<Chunk>): AttributeArrays {
  const chunk = chunks.get(chunkI, chunkJ);
  const { positions, uvs } = chunk.cells.entries().map(([[i, j], cell]) => (
    cellAttributeArrays(cell, chunkI, chunkJ, i, j, chunks)
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
function cellAttributeArrays(cell: Cell, chunkI: number, chunkJ: number, i: number, j: number, chunks: Map2D<Chunk>): CellAttributeArrays {
  const neighbors = [
    getChunkCell(chunkI, chunkJ, i - 1, j + 1, chunks), // left top
    getChunkCell(chunkI, chunkJ, i + 0, j + 1, chunks),
    getChunkCell(chunkI, chunkJ, i + 1, j + 1, chunks), // right top
    getChunkCell(chunkI, chunkJ, i - 1, j + 0, chunks),
    cell, // center
    getChunkCell(chunkI, chunkJ, i + 1, j + 0, chunks), 
    getChunkCell(chunkI, chunkJ, i - 1, j - 1, chunks), // left bottom
    getChunkCell(chunkI, chunkJ, i + 0, j - 1, chunks),
    getChunkCell(chunkI, chunkJ, i + 1, j - 1, chunks), // right bottom
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
  const centerPosition = add([i, cell.altitude, j] as Vec3, positionOffset);
  const centerPoint: Point = {
    position: centerPosition,
    uv: [(centerPosition[0] + uvOffset[0]) / CHUNK_SIZE, (centerPosition[2] + uvOffset[1]) / CHUNK_SIZE]
  };
  const points: Point[][] = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map((signs, cornerI) => {
    const bezierPoints = [
      centerPoint.position,
      add([
        i + cell.flatness * 0.5 * signs[0],
        cell.altitude,
        j + cell.flatness * 0.5 * signs[1],
      ], positionOffset),
      add([
        i + 0.5 * signs[0],
        cornerAltitude[cornerI],
        j + 0.5 * signs[1],
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
