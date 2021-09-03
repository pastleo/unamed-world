import * as THREE from 'three';
import Game from './game';
import Map2D from './utils/map2d';
import { moveCameraPosition } from './camera';
import { Vec2 } from './utils/utils';
import { Obj, SubObj, calcObjSprite, addSubObj, moveSubObj } from './obj';

export interface Player {
  obj: Obj;

  mounting?: SubObj;
  state?: number;
}

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

export function update(_player: Player, _tDiff: number, _game: Game) {
}

const MOVE_SPEED = 0.001;
export function movePlayer(player: Player, dvec: Vec2, game: Game) {
  const movedVec = [dvec[0] * MOVE_SPEED, dvec[1] * MOVE_SPEED] as Vec2;
  moveSubObj(
    player.mounting, movedVec[0], movedVec[1], game.realm.obj.chunks,
  );
  moveCameraPosition(movedVec, game.camera)
}
