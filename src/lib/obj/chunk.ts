import * as THREE from 'three';
import Obj from './obj';
import { SubObj, addSubObj } from './subObj';
import Map2D from '../utils/map2d';
import {
  averagePresentNumbers, step, mod,
} from '../utils/utils';
import { CHUNK_SIZE, CELL_STEPS } from '../consts';

export interface Chunk {
  cells: Map2D<Cell>;
  textureUrl: string;
  subObjs: SubObj[];

  attributesGenerated?: boolean;
  mesh?: THREE.Mesh;
  line?: THREE.Line; // for dev
}

export interface Cell {
  z: number;
  flatness: number;
  //sharpness: number;
  //uv: [number, number];
}

const CELL_OFFSET = (CHUNK_SIZE / 2) % 1;

export function calcChunkMesh(chunk: Chunk, chunkI: number, chunkJ: number, chunks: Map2D<Chunk>, loader: THREE.TextureLoader): void {
  const attributeArrays = chunkAttributeArrays(chunkI, chunkJ, chunks);

  const geometry = new THREE.BufferGeometry();
  const material = new THREE.MeshBasicMaterial({
    map: loader.load(chunk.textureUrl, texture => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
    }),
  });

  {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array(attributeArrays.positions),
      3,
    ));

    const wireframe = new THREE.WireframeGeometry(geometry);

    if (chunk.line) {
      chunk.line.removeFromParent();
    }
    chunk.line = new THREE.LineSegments(wireframe);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(
    new Float32Array(attributeArrays.positions),
    3,
  ));
  geometry.setAttribute('uv', new THREE.BufferAttribute(
    new Float32Array(attributeArrays.uvs),
    2,
  ));

  if (chunk.mesh) {
    chunk.mesh.removeFromParent();
  }
  chunk.mesh = new THREE.Mesh(geometry, material);
  chunk.mesh.position.x = chunkI * CHUNK_SIZE;
  chunk.mesh.position.y = chunkJ * CHUNK_SIZE;
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

export function calcZAt(x: number, y: number, localed: Located, chunks: Map2D<Chunk>): number {
  const [cell, cellI, cellJ, _chunk, chunkI, chunkJ] = localed;

  const offsetI = Math.floor((x + CELL_OFFSET) * 2) - Math.floor(x + CELL_OFFSET - 1) * 2 - 2;
  const offsetJ = Math.floor((y + CELL_OFFSET) * 2) - Math.floor(y + CELL_OFFSET - 1) * 2 - 2;

  const cellZs = [
    getChunkCell(chunkI, chunkJ, cellI - 1 + offsetI, cellJ + 0 + offsetJ, chunks),
    getChunkCell(chunkI, chunkJ, cellI + 0 + offsetI, cellJ + 0 + offsetJ, chunks),
    getChunkCell(chunkI, chunkJ, cellI - 1 + offsetI, cellJ - 1 + offsetJ, chunks),
    getChunkCell(chunkI, chunkJ, cellI + 0 + offsetI, cellJ - 1 + offsetJ, chunks),
  ].map(c => c ?? cell).map(c => c.z);
  const progress = [mod(x + CELL_OFFSET + 0.5, 1), mod(y + CELL_OFFSET + 0.5, 1)];

  return (
    (cellZs[0] * (1 - progress[0]) + cellZs[1] * progress[0]) * progress[1] +
    (cellZs[2] * (1 - progress[0]) + cellZs[3] * progress[0]) * (1 - progress[1])
  );
}

export type Located = [cell: Cell, cellI: number, cellJ: number, chunk: Chunk, chunkI: number, chunkJ: number];
export function locateChunkCell(x: number, y: number, chunks: Map2D<Chunk>): Located {
  const chunkI = Math.floor((x + CHUNK_SIZE / 2) / CHUNK_SIZE);
  const chunkJ = Math.floor((y + CHUNK_SIZE / 2) / CHUNK_SIZE);
  const chunk = chunks.get(chunkI, chunkJ);
  if (!chunk) return null;

  const cellI = Math.floor(x + CHUNK_SIZE / 2 - chunkI * CHUNK_SIZE);
  const cellJ = Math.floor(y + CHUNK_SIZE / 2 - chunkJ * CHUNK_SIZE);

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

  const cornerZ = [
    averagePresentNumbers(
      neighbors[0]?.z, neighbors[1]?.z, neighbors[3]?.z, neighbors[4]?.z,
    ),
    averagePresentNumbers(
      neighbors[1]?.z, neighbors[2]?.z, neighbors[4]?.z, neighbors[5]?.z,
    ),
    averagePresentNumbers(
      neighbors[3]?.z, neighbors[4]?.z, neighbors[6]?.z, neighbors[7]?.z,
    ),
    averagePresentNumbers(
      neighbors[4]?.z, neighbors[5]?.z, neighbors[7]?.z, neighbors[8]?.z,
    ),
  ];

  const positionOffset = [-CHUNK_SIZE / 2 + 0.5, -CHUNK_SIZE / 2 + 0.5, 0];
  const uvOffset = [0.5, 0.5];
  const centerPosition = [i + positionOffset[0], j + positionOffset[1], cell.z + positionOffset[2]] as [number, number, number];
  const centerPoint: Point = {
    position: centerPosition,
    uv: [(centerPosition[0] + uvOffset[0]) / CHUNK_SIZE, (centerPosition[1] + uvOffset[1]) / CHUNK_SIZE]
  };
  const points: Point[][] = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map((signs, cornerI) => {
    const bezierPoints = [
      centerPoint.position,
      [
        i + cell.flatness * 0.5 * signs[0] + positionOffset[0],
        j + cell.flatness * 0.5 * signs[1] + positionOffset[1],
        cell.z + positionOffset[2],
      ],
      [
        i + 0.5 * signs[0] + positionOffset[0],
        j + 0.5 * signs[1] + positionOffset[1],
        cornerZ[cornerI] + positionOffset[2],
      ],
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
            (position[1] + uvOffset[1]) / CHUNK_SIZE,
          ],
        };
      }
    );
  });

  const positions = [[0, 1], [1, 3], [3, 2], [2, 0]].flatMap(cornerIs => ([
    centerPoint.position,
    points[cornerIs[1]][0].position,
    points[cornerIs[0]][0].position,
    ...Array(CELL_STEPS - 1).fill(null).map((_, i) => i + 1).flatMap(i => ([
      points[cornerIs[0]][i-1].position,
      points[cornerIs[1]][i-1].position,
      points[cornerIs[0]][i].position,

      points[cornerIs[0]][i].position,
      points[cornerIs[1]][i-1].position,
      points[cornerIs[1]][i].position,
    ]))
  ])).flat();

  const uvs = [[0, 1], [1, 3], [3, 2], [2, 0]].flatMap(cornerIs => ([
    centerPoint.uv,
    points[cornerIs[1]][0].uv,
    points[cornerIs[0]][0].uv,
    ...Array(CELL_STEPS - 1).fill(null).map((_, i) => i + 1).flatMap(i => ([
      points[cornerIs[0]][i-1].uv,
      points[cornerIs[1]][i-1].uv,
      points[cornerIs[0]][i].uv,

      points[cornerIs[0]][i].uv,
      points[cornerIs[1]][i-1].uv,
      points[cornerIs[1]][i].uv,
    ]))
  ])).flat();

  return { positions, uvs };
}
