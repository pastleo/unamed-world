import * as THREE from 'three';
import { SpriteSheetMaterial, createSprite } from './sprite';
import Map2D from './utils/map2d';
import { Vec2, Vec3, add, mod, sub, length } from './utils/utils';
import { CHUNK_SIZE, CELL_STEPS } from './consts';

export interface Obj {
  chunks: Map2D<Chunk>;
  spriteSheetMaterial: SpriteSheetMaterial;
  speed: number;
  climb: number;
  radius: number;
}

export interface Chunk {
  cells: Map2D<Cell>;
  textureUrl: string;
  subObjs: SubObj[];

  mesh?: THREE.Mesh;
  line?: THREE.Line; // for dev
}

export interface Cell {
  z: number;
  flatness: number;
  //sharpness: number;
  //uv: [number, number];
}

export type SubObjState = 'normal' | 'moving';
export const subObjState: Record<SubObjState, SubObjState> = {
  normal: 'normal',
  moving: 'moving',
}
export interface SubObj {
  obj: Obj;
  chunkI: number;
  chunkJ: number;
  position: Vec3;
  rotation: Vec3;
  state: SubObjState;

  sprite?: THREE.Sprite;
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

  chunk.mesh = new THREE.Mesh(geometry, material);
  chunk.mesh.position.x = chunkI * CHUNK_SIZE;
  chunk.mesh.position.y = chunkJ * CHUNK_SIZE;
}

export function calcChunkSubObjs(chunk: Chunk, chunks: Map2D<Chunk>, loader: THREE.TextureLoader): void {
  chunk.subObjs.forEach(subObj => {
    subObj.sprite = createSprite(subObj.obj, loader, subObj);
    const located = locateChunkCell(subObj.position[0], subObj.position[1], chunks);
    calcSubObjLocalPos(subObj, located, chunks);
  });
}

export function addSubObj(obj: Obj, realmObj: Obj, x: number, y: number, loader: THREE.TextureLoader): SubObj {
  const located = locateChunkCell(x, y, realmObj.chunks);
  const [_cell, _cellI, _cellJ, chunk, chunkI, chunkJ] = located;

  const subObj: SubObj = {
    obj,
    chunkI, chunkJ,
    position: [x, y, 0] as Vec3,
    rotation: [0, 0, 0] as Vec3,
    state: subObjState.normal,
  };
  subObj.sprite = createSprite(subObj.obj, loader, subObj);

  calcSubObjLocalPos(subObj, located, realmObj.chunks);
  chunk.subObjs.push(subObj);

  return subObj;
}

export function moveSubObj(
  subObj: SubObj, vec: Vec2, chunks: Map2D<Chunk>
): boolean {
  const newPosition = add(subObj.position, [...vec, 0]);
  const located = locateChunkCell(newPosition[0], newPosition[1], chunks);

  const [_cell, _cellI, _cellJ, chunk, chunkI, chunkJ] = located;

  subObj.position = newPosition;
  calcSubObjLocalPos(subObj, located, chunks);
  if (chunkI !== subObj.chunkI || chunkJ !== subObj.chunkJ) {
    const oriChunk = chunks.get(subObj.chunkI, subObj.chunkJ);
    const index = oriChunk.subObjs.indexOf(subObj);
    oriChunk.subObjs.splice(index, 1);
    chunk.subObjs.push(subObj);
    subObj.chunkI = chunkI;
    subObj.chunkJ = chunkJ;
  }

  return true;
}

export function calcSubObjLocalPos(subObj: SubObj, localed: Located, chunks: Map2D<Chunk>) {
  subObj.sprite.position.x = subObj.position[0];
  subObj.sprite.position.y = subObj.position[1];
  const z = calcZAt(subObj.position[0], subObj.position[1], localed, chunks) + 0.5;
  subObj.sprite.position.z = z;
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

interface AttributeArrays {
  positions: number[],
  uvs: number[],
}
interface Point {
  position: [number, number, number];
  uv: [number, number];
  //normal: [number, number, number];
}

function chunkAttributeArrays(chunkI: number, chunkJ: number, chunks: Map2D<Chunk>): AttributeArrays {
  const chunk = chunks.get(chunkI, chunkJ);
  return chunk.cells.entries().map(([[i, j], cell]) => (
    cellAttributeArrays(cell, chunkI, chunkJ, i, j, chunks)
  )).reduce((attributeArrays, cellAttributeArrays) => {
    return {
      positions: [...attributeArrays.positions, ...cellAttributeArrays.positions],
      uvs: [...attributeArrays.uvs, ...cellAttributeArrays.uvs],
    }
  }, { positions: [], uvs: [] });
}

function cellAttributeArrays(cell: Cell, chunkI: number, chunkJ: number, i: number, j: number, chunks: Map2D<Chunk>): AttributeArrays {
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

type Located = [cell: Cell, cellI: number, cellJ: number, chunk: Chunk, chunkI: number, chunkJ: number];
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

function getChunkCell(chunkI: number, chunkJ: number, cellI: number, cellJ: number, chunks: Map2D<Chunk>): Cell {
  const chunkOffsetI = Math.floor(cellI / CHUNK_SIZE);
  const chunkOffsetJ = Math.floor(cellJ / CHUNK_SIZE);
  const chunk = chunks.get(chunkI + chunkOffsetI, chunkJ + chunkOffsetJ);
  if (!chunk) return null;
  return chunk.cells.get(
    cellI - chunkOffsetI * CHUNK_SIZE,
    cellJ - chunkOffsetJ * CHUNK_SIZE,
  )
}

function averagePresentNumbers(...ns: number[]): number {
  const presentNumbers = ns.filter(n => n !== undefined && n !== null);
  return presentNumbers.reduce((p, c) => p + c, 0) / presentNumbers.length;
}
function averageVecs(dimensions: number, ...vs: number[][]): number[] {
  return Array(dimensions).fill(null).map((_, i) => (
    vs.reduce((p, v) => p + v[i], 0) / dimensions
  ));
}

function step(vecA: number[], vecB: number[], progress: number) {
  return vecA.map((va, i) => va * (1 - progress) + vecB[i] * progress);
}
