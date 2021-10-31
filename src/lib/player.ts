import { Game } from './game';
import { GameECS } from './gameECS';
import { EntityRef } from './utils/ecs';

import { getObjEntity } from './obj/obj';
import { createSubObj, destroySubObj } from './subObj/subObj';
import { locateOrCreateChunkCell } from './chunk/chunk';
import { setCameraPosition, setCameraPositionY } from './camera';
import { initSubObjWalking, setMoveTarget } from './subObj/walking';
import { triggerRealmGeneration } from './realm';

import { Vec2, Vec3, warnIfNotPresent } from './utils/utils';

import { moveCameraPosition } from './camera';

export interface Player {
  objEntity: EntityRef;
  subObjEntity: EntityRef;
  chunkIJ: Vec2;
}

export function create(ecs: GameECS): Player {
  const objEntity = getObjEntity('base', ecs);
  const subObjEntity = ecs.allocate();

  return {
    objEntity,
    subObjEntity, 
    chunkIJ: [0, 0],
  }
}

export function addToRealm(game: Game, initPosition: Vec3 = [0, 0, 0]) {
  const located = locateOrCreateChunkCell(initPosition, game);

  const subObj = createSubObj(game.player.objEntity, initPosition, game, located, game.player.subObjEntity);
  mountSubObj(subObj, game);
}

export function mountSubObj(subObjEntity: EntityRef, game: Game) {
  game.player.subObjEntity = subObjEntity;
  const subObj = game.ecs.getComponent(subObjEntity, 'subObj');
  game.player.objEntity = subObj.obj;

  game.player.chunkIJ = subObj.chunkIJ;
  const subObjRender = game.ecs.getComponent(game.player.subObjEntity, 'subObj/spriteRender');
  setCameraPosition(
    [subObj.position[0], subObjRender.sprite.position.y, subObj.position[2]],
    game.camera,
  );
  initSubObjWalking(game.player.subObjEntity, game);
}

export function jumpOnRealm(game: Game) {
  const oriSubObjComponents = game.ecs.getEntityComponents(game.player.subObjEntity);
  if (warnIfNotPresent(oriSubObjComponents)) return;

  game.player.subObjEntity = game.ecs.allocate();
  addToRealm(game, oriSubObjComponents.get('subObj').position);
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

  // TODO: other ways to trigger mountable mounting
  if (
    subObjWalking.collidedSubObjs.length >= 1 &&
    game.ecs.getUUID(player.objEntity) === 'base'
  ) {
    destroySubObj(player.subObjEntity, game);
    mountSubObj(subObjWalking.collidedSubObjs[0], game);
  }
}

export function movePlayer(dvec: Vec2, game: Game) {
  const moveTargetDiff = setMoveTarget(game.player.subObjEntity, dvec, game);
  moveCameraPosition(moveTargetDiff, game.camera);
}
