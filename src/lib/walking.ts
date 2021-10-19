import { Game } from './game';
import { SubObj, moveSubObj, subObjState } from './obj/subObj';
import { Chunk, locateChunkCell, calcZAt, getChunkCell } from './obj/chunk';
import Map2D from './utils/map2d';
import { Vec2, add, sub, length, multiply } from './utils/utils';

const MAX_TARGET_DISTANCE = 2;
const STOP_TARGET_DISTANCE = 0.1;

export function update(subObj: SubObj, tDiff: number, game: Game) {
  if (subObj.moveTarget) {
    const movingLength = moveLength(subObj, subObj.moveTarget, game.realm.obj.chunks, tDiff);

    if (movingLength > 0) {
      const movingVec = multiply(subObj.moveTarget, movingLength / subObj.moveTargetDistance);
      moveSubObj(
        subObj, movingVec, game.realm.obj.chunks,
      );

      sub(subObj.moveTarget, movingVec, subObj.moveTarget);
      subObj.moveTargetDistance = length(subObj.moveTarget);
    }

    if (movingLength <= 0 || subObj.moveTargetDistance < STOP_TARGET_DISTANCE) {
      subObj.afterMovingTimeout = setTimeout(() => {
        subObj.state = subObjState.normal;
      }, 50);
      delete subObj.moveTarget;
    }
  }
}

export function setMoveTarget(subObj: SubObj, dvec: Vec2, game: Game): Vec2 {
  if (!subObj.moveTarget) {
    subObj.moveTarget = sub(
      [game.camera.cameraBase.position.x, game.camera.cameraBase.position.y],
      [subObj.position[0], subObj.position[1]],
    );
  }
  const oriMoveTarget: Vec2 = [...subObj.moveTarget];

  add(subObj.moveTarget, dvec, subObj.moveTarget);

  const targetDistance = length(subObj.moveTarget);
  if (targetDistance > MAX_TARGET_DISTANCE) {
    const moveTargetAdj = MAX_TARGET_DISTANCE / targetDistance;
    subObj.moveTargetDistance = MAX_TARGET_DISTANCE;
    multiply(subObj.moveTarget, moveTargetAdj, subObj.moveTarget);
  } else {
    subObj.moveTargetDistance = targetDistance;
  }
  clearTimeout(subObj.afterMovingTimeout);
  subObj.state = subObjState.walking;
  subObj.rotation[2] = Math.atan2(subObj.moveTarget[1], subObj.moveTarget[0]);

  return sub(subObj.moveTarget, oriMoveTarget)
}

function moveLength(
  subObj: SubObj, moveTarget: Vec2, chunks: Map2D<Chunk>, tDiff: number
): number {
  const maxMoveLength = subObj.obj.speed * tDiff * 0.001;
  const movingLength = sloppedMoveLength(maxMoveLength, subObj, moveTarget, chunks);

  if (movingLength <= 0) return 0;

  const moveTargetDistance = length(moveTarget);
  const movingVec = multiply(moveTarget, movingLength / moveTargetDistance);

  const newPosition = add(subObj.position, [...movingVec, 0]);
  const located = locateChunkCell(newPosition[0], newPosition[1], chunks);
  const [_cell, _cellI, _cellJ, _chunk, chunkI, chunkJ] = located;

  const collidedSubObjs = [chunkI - 1, chunkI, chunkI + 1].flatMap(ci => (
    [chunkJ - 1, chunkJ, chunkJ + 1].flatMap(cj => (
      chunks.get(ci, cj)?.subObjs || []
    ))
  )).filter(
    sObj => sObj !== subObj
  ).filter(
    sObj => (sObj.obj.radius + subObj.obj.radius) > length(sub(sObj.position, newPosition))
  );

  if (collidedSubObjs.length) return 0;

  return movingLength;
}

function sloppedMoveLength(
  maxMoveLength: number,
  subObj: SubObj, moveTarget: Vec2, chunks: Map2D<Chunk>
): number {
  const moveTargetDistance = length(moveTarget);
  const movingVec = multiply(moveTarget, subObj.obj.radius / moveTargetDistance);

  const newPosition = add(subObj.position, [...movingVec, 0]);
  const located = locateChunkCell(newPosition[0], newPosition[1], chunks);
  const [cell, cellI, cellJ] = located;

  if (subObj.cellI !== cellI || subObj.cellJ !== cellJ) {
    const currentCell = getChunkCell(subObj.chunkI, subObj.chunkJ, subObj.cellI, subObj.cellJ, chunks);
    const cellSlope = Math.PI * 0.5 - Math.atan2(1, cell.z - currentCell.z);
    if (cellSlope >= subObj.obj.maxClimbRad) {
      return 0;
    }
  }

  const newZ = calcZAt(newPosition[0], newPosition[1], located, chunks);
  const slope = Math.PI * 0.5 - Math.atan2(subObj.obj.radius, newZ + subObj.obj.tall - subObj.sprite.position.z);

  if (slope > 0) {
    const remainClimbRad = subObj.obj.maxClimbRad - slope;
    if (remainClimbRad <= 0) return 0;
    return maxMoveLength * (remainClimbRad / subObj.obj.maxClimbRad);
  }

  return maxMoveLength
}
