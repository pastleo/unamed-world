import { Game } from './game';
import { GameECS } from './gameECS';
import { EntityRef } from './utils/ecs';

import { addSubObj } from './subObj/subObj';
import { locateChunkCell } from './chunk/chunk';
import { setCameraPosition, setCameraPositionY } from './camera';
import { initSubObjWalking, setMoveTarget } from './subObj/walking';
import { triggerRealmGeneration } from './realm';

import { Vec2, Vec3 } from './utils/utils';

import { loadPlayerObjSpriteComponents } from './dev-data';

import { moveCameraPosition } from './camera';

export interface Player {
  objEntity: EntityRef;
  subObjEntity: EntityRef;
  chunkIJ: Vec2;
}

export function create(ecs: GameECS): Player {
  const objEntity = loadPlayerObjSpriteComponents(ecs);
  const subObjEntity = ecs.allocate();

  return {
    objEntity,
    subObjEntity, 
    chunkIJ: [0, 0],
  }
}

export function addToRealm(game: Game) {
  const initPosition = [0, 0, 0] as Vec3;
  const located = locateChunkCell(initPosition, game);

  addSubObj(game.player.objEntity, initPosition, game, located, game.player.subObjEntity);
  game.player.chunkIJ = located.chunkIJ;

  const subObjRender = game.ecs.getComponent(game.player.subObjEntity, 'subObj/spriteRender');
  setCameraPosition(
    [initPosition[0], subObjRender.sprite.position.y, initPosition[2]],
    game.camera,
  );
  initSubObjWalking(game.player.subObjEntity, game);
}

export function update(_tDiff: number, game: Game) {
  const { player } = game;
  const subObj = game.ecs.getComponent(player.subObjEntity, 'subObj');
  const subObjSpriteRender = game.ecs.getComponent(player.subObjEntity, 'subObj/spriteRender');
  const subObjWalking = game.ecs.getComponent(player.subObjEntity, 'subObj/walking');

  if (subObjWalking.moveTarget) {
    setCameraPositionY(subObjSpriteRender.sprite.position.y, game.camera);
  }
  if (subObj.chunkIJ[0] !== player.chunkIJ[0] || subObj.chunkIJ[1] !== player.chunkIJ[1]) {
    player.chunkIJ = subObj.chunkIJ;
    triggerRealmGeneration(player.chunkIJ, game);
  }
}

export function movePlayer(dvec: Vec2, game: Game) {
  const moveTargetDiff = setMoveTarget(game.player.subObjEntity, dvec, game);
  moveCameraPosition(moveTargetDiff, game.camera);
}
