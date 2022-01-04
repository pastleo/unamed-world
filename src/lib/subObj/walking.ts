import { Game } from '../game';
import { GameEntityComponents } from '../gameECS';

import { SubObjEntityComponents } from '../subObj/subObj';
import { locateOrCreateChunkCell, getOrCreateChunkCell, calcAltitudeAt } from '../chunk/chunk';
import { moveSubObj, detectCollision } from './subObj';
import { ObjEntityComponents, getOrBaseObjEntityComponents } from '../obj/obj';

import { EntityRef } from '../utils/ecs';
import { Vec2, sub, add, length, multiply, vec3To2, clamp, assertPresentOrWarn } from '../utils/utils';

import { START_MOVING_DISTANCE, STOP_MOVING_DISTANCE } from '../consts';

export interface SubObjWalkingComponent {
  moving: boolean;
  moveRelative?: Vec2;
  moveRelativeDistance?: number;
  afterMovingTimeout?: ReturnType<typeof setTimeout>;
  collidedSubObjs: EntityRef[];
}

export function initSubObjWalking(subObjEntity: EntityRef, game: Game) {
  game.ecs.setComponent(subObjEntity, 'subObj/walking', {
    moving: false,
    collidedSubObjs: [],
  });
}

export function update(subObjEntity: EntityRef, tDiff: number, game: Game) {
  const subObj = game.ecs.getEntityComponents(subObjEntity);
  const subObjComponent = subObj.get('subObj');
  const subObjWalking = subObj.get('subObj/walking');

  if (subObjWalking?.moving) {
    const obj = getOrBaseObjEntityComponents(subObjComponent.obj, game.ecs);
    const movingRange = movableRange(subObj, obj, tDiff, game);

    if (movingRange > 0) {
      const progressGoingToMake = clamp(movingRange / subObjWalking.moveRelativeDistance, 0, 1);
      const movingVec = multiply(subObjWalking.moveRelative, progressGoingToMake);
      moveSubObj(subObjEntity, movingVec, game);

      multiply(subObjWalking.moveRelative, 1 - progressGoingToMake, subObjWalking.moveRelative);
      subObjWalking.moveRelativeDistance = length(subObjWalking.moveRelative);

      subObjComponent.rotation[1] = Math.atan2(movingVec[0], movingVec[1]) + Math.PI;
    }

    if (movingRange <= 0 || subObjWalking.moveRelativeDistance < STOP_MOVING_DISTANCE) {
      subObjWalking.moving = false;
      subObjWalking.afterMovingTimeout = setTimeout(() => {
        subObjComponent.state = 'normal';
      }, 50);
    }
  }
}

export function getMoveTarget(subObjComponents: GameEntityComponents): Vec2 {
  const playerSubObj = subObjComponents.get('subObj');
  const playerWalking = subObjComponents.get('subObj/walking');
  return add(playerWalking.moveRelative, vec3To2(playerSubObj.position))
}

export function setMoveTo(subObjEntity: EntityRef, target: Vec2, game: Game) {
  const subObj = game.ecs.getComponent(subObjEntity, 'subObj');

  setMoveRelative(
    subObjEntity,
    sub(target, vec3To2(subObj.position)),
    game
  );
}

export function setMoveRelative(subObjEntity: EntityRef, vec: Vec2, game: Game) {
  const subObj = game.ecs.getComponent(subObjEntity, 'subObj');
  const subObjWalking = game.ecs.getComponent(subObjEntity, 'subObj/walking');

  subObjWalking.moveRelative = [...vec];
  subObjWalking.moveRelativeDistance = length(subObjWalking.moveRelative);
  subObjWalking.moving ||= subObjWalking.moveRelativeDistance > START_MOVING_DISTANCE;

  if (subObjWalking.moving) {
    clearTimeout(subObjWalking.afterMovingTimeout);
    subObj.state = 'walking';
  }
}

function movableRange(
  subObj: SubObjEntityComponents,
  obj: ObjEntityComponents,
  tDiff: number, game: Game,
): number {
  const subObjComponent = subObj.get('subObj');
  const subObjWalking = subObj.get('subObj/walking');
  if (assertPresentOrWarn([subObjComponent, subObjWalking], 'subObj/walking.movableRange: subObj or walking components is not found')) return;
  const objWalkable = obj.get('obj/walkable');
  const objSprite = obj.get('obj/sprite');

  const objRange = objWalkable.speed * tDiff * 0.001;
  const sloppedRange = sloppedMovableRange(objRange, subObj, obj, game);

  if (sloppedRange <= 0) return 0;

  const movingVec = multiply(subObjWalking.moveRelative, sloppedRange / subObjWalking.moveRelativeDistance);

  const newPosition = add(subObjComponent.position, [movingVec[0], 0, movingVec[1]]);
  const located = locateOrCreateChunkCell(newPosition, game);

  if (objSprite.collision) {
    const collidedSubObjs = detectCollision(subObj.entity, located.chunkIJ, game, newPosition);
    subObjWalking.collidedSubObjs = collidedSubObjs;

    if (collidedSubObjs.length) return 0;
  }

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

  const movingVec = multiply(subObjWalking.moveRelative, objSprite.radius / subObjWalking.moveRelativeDistance);

  const newPosition = add(subObjComponent.position, [movingVec[0], 0, movingVec[1]]);
  const located = locateOrCreateChunkCell(newPosition, game);
  const { cellIJ , cell } = located;

  if (subObjComponent.cellIJ[0] !== cellIJ[0] || subObjComponent.cellIJ[1] !== cellIJ[1]) {
    const currentCell = getOrCreateChunkCell(subObjComponent.chunkIJ, subObjComponent.cellIJ, game.realm.currentObj, game.ecs);

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
