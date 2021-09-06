import * as THREE from 'three';
import Game from './game';
import Map2D from './utils/map2d';
import { moveCameraPosition } from './camera';
import { Vec2, add, sub, multiply, lengthSq } from './utils/utils';
import { Obj, SubObj, calcObjSprite, addSubObj, moveSubObj } from './obj';

export interface Player {
  obj: Obj;

  mounting?: SubObj;
  moveTarget?: Vec2;
  moveTargetDistanceSq?: number;
}
const MOVE_SPEED = 0.05;
const MOVE_SPEED_SQ = MOVE_SPEED * MOVE_SPEED;
const MAX_TARGET_DISTANCE = 2;
const MAX_TARGET_DISTANCE_SQ = MAX_TARGET_DISTANCE * MAX_TARGET_DISTANCE;
const STOP_TARGET_DISTANCE = 0.1;
const STOP_TARGET_DISTANCE_SQ = STOP_TARGET_DISTANCE * STOP_TARGET_DISTANCE;

export function create(): Player {
  return {
    obj: {
      chunks: new Map2D(),
      textureUrl: 'assets/hero.png',
    }
  }
}

export function addToRealm(player: Player, loader: THREE.TextureLoader, game: Game) {
  calcObjSprite(player.obj, loader);
  player.mounting = addSubObj(player.obj, game.realm.obj, 0, 0);
}

export function update(player: Player, _tDiff: number, game: Game) {
  if (player.moveTarget) {
    let movingVec: Vec2;
    if (player.moveTargetDistanceSq > MOVE_SPEED_SQ) {
      movingVec = multiply(player.moveTarget, MOVE_SPEED / Math.sqrt(player.moveTargetDistanceSq));
    } else {
      movingVec = player.moveTarget;
    }
    moveSubObj(
      player.mounting, movingVec, game.realm.obj.chunks,
    );
    sub(player.moveTarget, movingVec, player.moveTarget);

    if (lengthSq(player.moveTarget) < STOP_TARGET_DISTANCE_SQ) {
      delete player.moveTarget;
    }
  }
}

export function movePlayer(player: Player, dvec: Vec2, game: Game) {
  if (!player.moveTarget) {
    player.moveTarget = [0, 0];
  }
  const oriMoveTarget: Vec2 = [...player.moveTarget];

  add(player.moveTarget, dvec, player.moveTarget);

  const targetDistanceSq = lengthSq(player.moveTarget);
  if (targetDistanceSq > MAX_TARGET_DISTANCE_SQ) {
    const moveTargetAdj = MAX_TARGET_DISTANCE / Math.sqrt(targetDistanceSq);
    player.moveTargetDistanceSq = MAX_TARGET_DISTANCE;
    multiply(player.moveTarget, moveTargetAdj, player.moveTarget);
  } else {
    player.moveTargetDistanceSq = targetDistanceSq;
  }
  moveCameraPosition(sub(player.moveTarget, oriMoveTarget), game.camera);
}
