import { Game } from './game';
import { GameECS } from './gameECS';
import { EntityRef } from './utils/ecs';

import { getObjEntity } from './obj/obj';
import { createSubObj, destroySubObj } from './subObj/subObj';
import { locateOrCreateChunkCell } from './chunk/chunk';
import { initSubObjWalking, setMoveTo, setMoveRelative } from './subObj/walking';

import { setCameraPosition, setCameraLocation, setCameraY } from './camera';
import { triggerRealmGeneration } from './realm';
import { broadcastMyself } from './network';

import { Vec2, Vec3, add, multiply, length, vec3To2, warnIfNotPresent } from './utils/utils';

import { MAX_DISTANCE_BETWEEN_PLAYER } from './consts';

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
    game
  );
  initSubObjWalking(game.player.subObjEntity, game);
}

export function jumpOnRealm(game: Game) {
  game.player.subObjEntity = game.ecs.allocate();
  addToRealm(game, [0, 0, 0]);
}

export function jumpOffRealm(game: Game) {
  const oriSubObjComponents = game.ecs.getEntityComponents(game.player.subObjEntity);
  if (warnIfNotPresent(oriSubObjComponents)) return;

  destroySubObj(oriSubObjComponents.entity, game);
}

export function update(_tDiff: number, game: Game) {
  const { player } = game;
  const subObj = game.ecs.getComponent(player.subObjEntity, 'subObj');
  const subObjSpriteRender = game.ecs.getComponent(player.subObjEntity, 'subObj/spriteRender');
  const subObjWalking = game.ecs.getComponent(player.subObjEntity, 'subObj/walking');

  if (subObjWalking.moving) {
    updateCameraLocation(game);
    setCameraY(subObjSpriteRender.sprite.position.y, game);
  }
  if (subObj.chunkIJ[0] !== player.chunkIJ[0] || subObj.chunkIJ[1] !== player.chunkIJ[1]) {
    player.chunkIJ = subObj.chunkIJ;
    triggerRealmGeneration(player.chunkIJ, game);
  }
}

export function movePlayerTo(target: Vec2, game: Game) {
  setMoveTo(game.player.subObjEntity, target, game);
  updateCameraLocation(game);
  broadcastMyself(game);
}

export function movePlayerAddRelative(dVec: Vec2, game: Game) {
  const subObjEntity = game.player.subObjEntity;
  const subObjWalking = game.ecs.getComponent(subObjEntity, 'subObj/walking');

  const vec = maxDistanceBetweenPlayer(
    add(subObjWalking.moveRelative || [0, 0], dVec)
  );
  setMoveRelative(subObjEntity, vec, game);
  updateCameraLocation(game);
  broadcastMyself(game);
}

function maxDistanceBetweenPlayer(vec: Vec2 | null): Vec2 {
  const distance = length(vec || [0, 0]);
  if (distance > MAX_DISTANCE_BETWEEN_PLAYER) {
    return multiply(vec, MAX_DISTANCE_BETWEEN_PLAYER / distance);
  }
  return vec
}

function updateCameraLocation(game: Game) {
  const subObjEntity = game.player.subObjEntity;
  const subObj = game.ecs.getComponent(subObjEntity, 'subObj');
  const subObjWalking = game.ecs.getComponent(subObjEntity, 'subObj/walking');

  setCameraLocation(
    add(
      vec3To2(subObj.position),
      maxDistanceBetweenPlayer(subObjWalking.moveRelative),
    ),
    game,
  );
}
