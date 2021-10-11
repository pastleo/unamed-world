import * as THREE from 'three';
import { Game } from './game';
import Obj from './obj/obj';
import { SubObj } from './obj/subObj';
import { createSubObjSprite } from './sprite';
import { setMoveTarget } from './walking';
import { moveCameraPosition } from './camera';
import { Vec2 } from './utils/utils';
import { triggerRealmGeneration } from './realm';

import { heroObj } from './dev-data';

export interface Player {
  obj: Obj;

  mounting?: SubObj;
  chunkI?: number;
  chunkJ?: number;
}

export function create(): Player {
  return {
    obj: heroObj,
  }
}

export function addToRealm(player: Player, loader: THREE.TextureLoader, game: Game) {
  player.mounting = createSubObjSprite(player.obj, game.realm.obj, 0, 0, loader);
  player.chunkI = player.mounting.chunkI;
  player.chunkJ = player.mounting.chunkJ;
  game.scene.add(player.mounting.sprite);
}

export function update(player: Player, _tDiff: number, game: Game) {
  if (player.mounting.moveTarget) {
    game.camera.cameraBase.position.y = player.mounting.sprite.position.y;
  }
  if (player.chunkI !== player.mounting.chunkI || player.chunkJ !== player.mounting.chunkJ) {
    player.chunkI = player.mounting.chunkI;
    player.chunkJ = player.mounting.chunkJ;
    triggerRealmGeneration(game.realm, [player.mounting.chunkI, player.mounting.chunkJ], game);
  }
}

export function movePlayer(player: Player, dvec: Vec2, game: Game) {
  const moveTargetDiff = setMoveTarget(player.mounting, dvec, game);
  moveCameraPosition(moveTargetDiff, game.camera);
}
