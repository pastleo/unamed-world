import * as THREE from 'three';
import Obj from './obj';
import { Chunk, locateChunkCell, calcAltitudeAt, Located } from './chunk';
import Map2D from '../utils/map2d';
import { Vec2, Vec3, add } from '../utils/utils';

export type SubObjState = 'normal' | 'walking';
export const subObjState: Record<SubObjState, SubObjState> = {
  normal: 'normal',
  walking: 'walking',
}
export interface SubObj {
  obj: Obj;
  position: Vec3;
  rotation: Vec3;
  state: SubObjState;

  cellI?: number;
  cellJ?: number;
  chunkI?: number;
  chunkJ?: number;
  sprite?: THREE.Sprite;

  moveTarget?: Vec2;
  moveTargetDistance?: number;
  afterMovingTimeout?: ReturnType<typeof setTimeout>;
}

export function addSubObj(obj: Obj, realmObj: Obj, x: number, z: number, locatedArg?: Located): SubObj {
  const located = locatedArg || locateChunkCell(x, z, realmObj.chunks);
  const [_cell, cellI, cellJ, chunk, chunkI, chunkJ] = located;

  const subObj: SubObj = {
    obj,
    cellI, cellJ,
    chunkI, chunkJ,
    position: [x, 0, z] as Vec3,
    rotation: [0, 0, 0] as Vec3,
    state: subObjState.normal,
  };
  chunk.subObjs.push(subObj);

  return subObj;
}

export function moveSubObj(
  subObj: SubObj, vec: Vec2, chunks: Map2D<Chunk>
) {
  const newPosition = add(subObj.position, [vec[0], 0, vec[1]]);
  const located = locateChunkCell(newPosition[0], newPosition[2], chunks);

  const [_cell, cellI, cellJ, chunk, chunkI, chunkJ] = located;

  subObj.position = newPosition;
  calcSubObjLocalPos(subObj, located, chunks);
  subObj.cellI = cellI;
  subObj.cellJ = cellJ;

  if (chunkI !== subObj.chunkI || chunkJ !== subObj.chunkJ) {
    const oriChunk = chunks.get(subObj.chunkI, subObj.chunkJ);
    const index = oriChunk.subObjs.indexOf(subObj);
    oriChunk.subObjs.splice(index, 1);
    chunk.subObjs.push(subObj);
    subObj.chunkI = chunkI;
    subObj.chunkJ = chunkJ;
  }
}

export function calcSubObjLocalPos(subObj: SubObj, localed: Located, chunks: Map2D<Chunk>) {
  subObj.sprite.position.x = subObj.position[0];
  subObj.sprite.position.y = calcAltitudeAt(subObj.position[0], subObj.position[2], localed, chunks) + subObj.obj.tall;
  subObj.sprite.position.z = subObj.position[2];
}
