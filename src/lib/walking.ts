import { Game } from './game';
import { SubObj, moveSubObj, subObjState } from './obj/subObj';
import { Chunk, locateChunkCell, calcAltitudeAt, getChunkCell } from './obj/chunk';
import Map2D from './utils/map2d';
import { Vec2, Vec3, add, sub, length, multiply, clamp } from './utils/utils';

const MAX_TARGET_DISTANCE = 2;
const STOP_TARGET_DISTANCE = 0.5;

export function update(subObj: SubObj, tDiff: number, game: Game) {
  if (subObj.moveTarget) {
    const movingRange = movableRange(subObj, game.realm.obj.chunks, tDiff);

    if (movingRange > 0) {
      const progressGoingToMake = clamp(movingRange / subObj.moveTargetDistance, 0, 1);
      const movingVec = multiply(subObj.moveTarget, progressGoingToMake);
      moveSubObj(
        subObj, movingVec, game.realm.obj.chunks,
      );

      multiply(subObj.moveTarget, 1 - progressGoingToMake, subObj.moveTarget);
      subObj.moveTargetDistance = length(subObj.moveTarget);

      subObj.rotation[1] = Math.PI - Math.atan2(movingVec[0], movingVec[1]);
    }

    if (movingRange <= 0 || subObj.moveTargetDistance < STOP_TARGET_DISTANCE) {
      subObj.afterMovingTimeout = setTimeout(() => {
        subObj.state = subObjState.normal;
      }, 50);
      delete subObj.moveTarget;
    }
  }
}

export function setMoveTarget(subObj: SubObj, dVec: Vec2, game: Game): Vec3 {
  if (!subObj.moveTarget) {
    subObj.moveTarget = sub(
      [game.camera.cameraBase.position.x, game.camera.cameraBase.position.z],
      [subObj.position[0], subObj.position[2]],
    );
  }
  const oriMoveTarget: Vec2 = [...subObj.moveTarget];

  add(subObj.moveTarget, [dVec[0], -dVec[1]], subObj.moveTarget);

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

  const dMoveTarget = sub(subObj.moveTarget, oriMoveTarget);

  return [dMoveTarget[0], 0, dMoveTarget[1]];
}

function movableRange(
  subObj: SubObj, chunks: Map2D<Chunk>, tDiff: number
): number {
  const objRange = subObj.obj.speed * tDiff * 0.001;
  const sloppedRange = sloppedMovableRange(objRange, subObj, subObj.moveTarget, chunks);

  if (sloppedRange <= 0) return 0;

  const movingVec = multiply(subObj.moveTarget, sloppedRange / subObj.moveTargetDistance);

  const newPosition = add(subObj.position, [movingVec[0], 0, movingVec[1]]);
  const located = locateChunkCell(newPosition[0], newPosition[2], chunks);
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

  return sloppedRange;
}

function sloppedMovableRange(
  objRange: number,
  subObj: SubObj, moveTarget: Vec2, chunks: Map2D<Chunk>
): number {
  const movingVec = multiply(moveTarget, subObj.obj.radius / subObj.moveTargetDistance);

  const newPosition = add(subObj.position, [movingVec[0], 0, movingVec[1]]);
  const located = locateChunkCell(newPosition[0], newPosition[2], chunks);
  const [cell, cellI, cellJ] = located;

  if (subObj.cellI !== cellI || subObj.cellJ !== cellJ) {
    const currentCell = getChunkCell(subObj.chunkI, subObj.chunkJ, subObj.cellI, subObj.cellJ, chunks);
    const cellSlope = Math.PI * 0.5 - Math.atan2(1, cell.altitude - currentCell.altitude);
    if (cellSlope >= subObj.obj.maxClimbRad) {
      return 0;
    }
  }

  const newAltitude = calcAltitudeAt(newPosition[0], newPosition[2], located, chunks);
  const slope = Math.PI * 0.5 - Math.atan2(subObj.obj.radius, newAltitude + subObj.obj.tall - subObj.sprite.position.y);

  if (slope > 0) {
    const remainClimbRad = subObj.obj.maxClimbRad - slope;
    if (remainClimbRad <= 0) return 0;
    return objRange * (remainClimbRad / subObj.obj.maxClimbRad);
  }

  return objRange;
}
