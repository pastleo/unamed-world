import * as THREE from 'three';
import Game from './game';
import { moveCameraPosition } from './camera';
import { Vec2, add, sub, multiply, length } from './utils/utils';
import { Obj, SubObj, addSubObj, moveSubObj, subObjState } from './obj';
import { moveLength } from './movable';

import { heroObj } from './dev-data';

export interface Player {
  obj: Obj;

  mounting?: SubObj;
  moveTarget?: Vec2;
  moveTargetDistance?: number;
  afterMovingTimeout?: ReturnType<typeof setTimeout>;
}
const MAX_TARGET_DISTANCE = 2;
const STOP_TARGET_DISTANCE = 0.1;

export function create(): Player {
  return {
    obj: heroObj,
  }
}

export function addToRealm(player: Player, loader: THREE.TextureLoader, game: Game) {
  player.mounting = addSubObj(player.obj, game.realm.obj, 0, 0, loader);
  game.scene.add(player.mounting.sprite);
}

export function update(player: Player, tDiff: number, game: Game) {
  if (player.moveTarget) {
    const movingLength = moveLength(player.mounting, player.moveTarget, game.realm.obj.chunks, tDiff);

    if (movingLength > 0) {
      const movingVec = multiply(player.moveTarget, movingLength / player.moveTargetDistance);
      moveSubObj(
        player.mounting, movingVec, game.realm.obj.chunks,
      );

      game.camera.cameraBase.position.z = player.mounting.sprite.position.z;
      sub(player.moveTarget, movingVec, player.moveTarget);
      player.moveTargetDistance = length(player.moveTarget);
    }

    if (movingLength <= 0 || player.moveTargetDistance < STOP_TARGET_DISTANCE) {
      player.afterMovingTimeout = setTimeout(() => {
        player.mounting.state = subObjState.normal;
      }, 50);
      delete player.moveTarget;
    }
  }
}

export function movePlayer(player: Player, dvec: Vec2, game: Game) {
  if (!player.moveTarget) {
    player.moveTarget = sub(
      [game.camera.cameraBase.position.x, game.camera.cameraBase.position.y],
      [player.mounting.position[0], player.mounting.position[1]],
    );
  }
  const oriMoveTarget: Vec2 = [...player.moveTarget];

  add(player.moveTarget, dvec, player.moveTarget);

  const targetDistance = length(player.moveTarget);
  if (targetDistance > MAX_TARGET_DISTANCE) {
    const moveTargetAdj = MAX_TARGET_DISTANCE / targetDistance;
    player.moveTargetDistance = MAX_TARGET_DISTANCE;
    multiply(player.moveTarget, moveTargetAdj, player.moveTarget);
  } else {
    player.moveTargetDistance = targetDistance;
  }
  moveCameraPosition(sub(player.moveTarget, oriMoveTarget), game.camera);
  clearTimeout(player.afterMovingTimeout);
  player.mounting.state = subObjState.moving;
  player.mounting.rotation[2] = Math.atan2(player.moveTarget[1], player.moveTarget[0]);
}
