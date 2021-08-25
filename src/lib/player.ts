import * as THREE from 'three';
import Game from './game';
import Map2D from './utils/map2d';
import { Obj, SubObj, calcObjSprite, addSubObj, locateChunkCell, moveSubObj } from './obj';

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

const MOVE_SPEED = 0.001;
export function update(player: Player, tDiff: number, game: Game) {
  const moved = [0, 0];
  if (game.input.keyPressed.has('a')) {
    moved[0] -= MOVE_SPEED * tDiff;
  } else if (game.input.keyPressed.has('d')) {
    moved[0] += MOVE_SPEED * tDiff;
  }

  if (game.input.keyPressed.has('w')) {
    moved[1] += MOVE_SPEED * tDiff;
  } else if (game.input.keyPressed.has('s')) {
    moved[1] -= MOVE_SPEED * tDiff;
  }

  if (moved[0] !== 0 || moved[1] !== 0) {
    moveSubObj(
      player.mounting, moved[0], moved[1], game.realm.obj.chunks,
    );
    game.cameraBase.position.x += moved[0];
    game.cameraBase.position.y += moved[1];
  }
}
