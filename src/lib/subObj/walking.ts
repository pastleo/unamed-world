import { Game } from '../game';
import { ObjEntityComponents } from '../obj/obj';
import { SubObjEntityComponents } from '../subObj/subObj';
import { locateChunkCell, getChunkCell, calcAltitudeAt, getChunk } from '../chunk/chunk';
import { moveSubObj } from './subObj';

import { EntityRef, entityEqual } from '../utils/ecs';
import { Vec2, Vec3, sub, add, length, multiply, clamp } from '../utils/utils';

import { MAX_TARGET_DISTANCE, STOP_TARGET_DISTANCE } from '../consts';

export interface SubObjWalkingComponent {
  moveTarget?: Vec2;
  moveTargetDistance?: number;
  afterMovingTimeout?: ReturnType<typeof setTimeout>;
  collidedSubObjs: EntityRef[];
}

export function initSubObjWalking(subObjEntity: EntityRef, game: Game) {
  game.ecs.setComponent(subObjEntity, 'subObj/walking', {
    collidedSubObjs: [],
  });
}

export function update(subObjEntity: EntityRef, tDiff: number, game: Game) {
  const subObj = game.ecs.getEntityComponents(subObjEntity);

  const subObjComponent = subObj.get('subObj');
  const subObjWalking = subObj.get('subObj/walking');
  const obj = game.ecs.getEntityComponents(subObjComponent.obj);

  if (subObjWalking?.moveTarget) {
    const movingRange = movableRange(subObj, obj, tDiff, game);

    if (movingRange > 0) {
      const progressGoingToMake = clamp(movingRange / subObjWalking.moveTargetDistance, 0, 1);
      const movingVec = multiply(subObjWalking.moveTarget, progressGoingToMake);
      moveSubObj(subObjEntity, movingVec, game);

      multiply(subObjWalking.moveTarget, 1 - progressGoingToMake, subObjWalking.moveTarget);
      subObjWalking.moveTargetDistance = length(subObjWalking.moveTarget);

      subObjComponent.rotation[1] = Math.PI - Math.atan2(movingVec[0], movingVec[1]);
    }

    if (movingRange <= 0 || subObjWalking.moveTargetDistance < STOP_TARGET_DISTANCE) {
      subObjWalking.afterMovingTimeout = setTimeout(() => {
        subObjComponent.state = 'normal';
      }, 50);
      delete subObjWalking.moveTarget;
    }
  }
}

export function setMoveTarget(subObjEntity: EntityRef, dVec: Vec2, game: Game): Vec3 {
  const subObj = game.ecs.getComponent(subObjEntity, 'subObj');
  const subObjWalking = game.ecs.getComponent(subObjEntity, 'subObj/walking');
  if (!subObjWalking.moveTarget) {
    subObjWalking.moveTarget = sub(
      [game.camera.cameraBase.position.x, game.camera.cameraBase.position.z],
      [subObj.position[0], subObj.position[2]],
    );
  }
  const oriMoveTarget: Vec2 = [...subObjWalking.moveTarget];

  add(subObjWalking.moveTarget, [dVec[0], -dVec[1]], subObjWalking.moveTarget);

  const targetDistance = length(subObjWalking.moveTarget);
  if (targetDistance > MAX_TARGET_DISTANCE) {
    const moveTargetAdj = MAX_TARGET_DISTANCE / targetDistance;
    subObjWalking.moveTargetDistance = MAX_TARGET_DISTANCE;
    multiply(subObjWalking.moveTarget, moveTargetAdj, subObjWalking.moveTarget);
  } else {
    subObjWalking.moveTargetDistance = targetDistance;
  }
  clearTimeout(subObjWalking.afterMovingTimeout);
  subObj.state = 'walking';

  const dMoveTarget = sub(subObjWalking.moveTarget, oriMoveTarget);

  return [dMoveTarget[0], 0, dMoveTarget[1]];
}

function movableRange(
  subObj: SubObjEntityComponents,
  obj: ObjEntityComponents,
  tDiff: number, game: Game,
): number {
  const subObjComponent = subObj.get('subObj');
  const subObjWalking = subObj.get('subObj/walking');
  const objWalkable = obj.get('obj/walkable');
  const objSprite = obj.get('obj/sprite');

  const objRange = objWalkable.speed * tDiff * 0.001;
  const sloppedRange = sloppedMovableRange(objRange, subObj, obj, game);

  if (sloppedRange <= 0) return 0;

  const movingVec = multiply(subObjWalking.moveTarget, sloppedRange / subObjWalking.moveTargetDistance);

  const newPosition = add(subObjComponent.position, [movingVec[0], 0, movingVec[1]]);
  const located = locateChunkCell(newPosition, game);
  const [chunkI, chunkJ] = located.chunkIJ;

  const collidedSubObjs = [chunkI - 1, chunkI, chunkI + 1].flatMap(ci => (
    [chunkJ - 1, chunkJ, chunkJ + 1].flatMap(cj => (
      getChunk([ci, cj], game.realm.currentObj, game.ecs).subObjs
    ))
  )).filter(
    sObjEntity => !entityEqual(sObjEntity, subObj.entity)
  ).filter(
    sObjEntity => {
      const sObj = game.ecs.getComponent(sObjEntity, 'subObj');
      const sObjSprite = game.ecs.getComponent(sObj.obj, 'obj/sprite');
      return ((sObjSprite.radius || 0) + objSprite.radius) > length(sub(sObj.position, newPosition))
    }
  );
  subObjWalking.collidedSubObjs = collidedSubObjs;

  if (collidedSubObjs.length) return 0;

  return sloppedRange;
}

function sloppedMovableRange(
  objRange: number,
  subObj: SubObjEntityComponents,
  obj: ObjEntityComponents,
  game: Game,
): number {
  const subObjComponent = subObj.get('subObj');
  const subObjWalking = subObj.get('subObj/walking');
  const objWalkable = obj.get('obj/walkable');
  const objSprite = obj.get('obj/sprite');

  const movingVec = multiply(subObjWalking.moveTarget, objSprite.radius / subObjWalking.moveTargetDistance);

  const newPosition = add(subObjComponent.position, [movingVec[0], 0, movingVec[1]]);
  const located = locateChunkCell(newPosition, game);
  const { cellIJ , cell } = located;

  if (subObjComponent.cellIJ[0] !== cellIJ[0] || subObjComponent.cellIJ[1] !== cellIJ[1]) {
    const currentCell = getChunkCell(subObjComponent.chunkIJ, subObjComponent.cellIJ, game.realm.currentObj, game.ecs);
    const cellSlope = Math.PI * 0.5 - Math.atan2(1, cell.altitude - currentCell.altitude);
    if (cellSlope >= objWalkable.maxClimbRad) {
      return 0;
    }
  }

  const newAltitude = calcAltitudeAt(newPosition, located, game);
  const slope = Math.PI * 0.5 - Math.atan2(objSprite.radius, newAltitude - subObjComponent.groundAltitude);

  if (slope > 0) {
    const remainClimbRad = objWalkable.maxClimbRad - slope;
    if (remainClimbRad <= 0) return 0;
    return objRange * (remainClimbRad / objWalkable.maxClimbRad);
  }

  return objRange;
}
