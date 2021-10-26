import { Game } from './game';
import { GameECS } from './gameECS';
import { EntityRef } from './utils/ecs';

import { createObjEntity, getObjEntity } from './obj/obj';
import { addSubObj, removeSubObj } from './subObj/subObj';
import { locateChunkCell } from './chunk/chunk';
import { setCameraPosition, setCameraPositionY } from './camera';
import { initSubObjWalking, setMoveTarget } from './subObj/walking';
import { triggerRealmGeneration } from './realm';

import { Vec2, Vec3 } from './utils/utils';

import { moveCameraPosition } from './camera';

export interface Player {
  objEntity: EntityRef;
  subObjEntity: EntityRef;
  chunkIJ: Vec2;
}

export function create(ecs: GameECS): Player {
  createBaseSubObj(ecs);

  const objEntity = getObjEntity('base', ecs);
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

  const subObj = addSubObj(game.player.objEntity, initPosition, game, located, game.player.subObjEntity);
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
    removeSubObj(player.subObjEntity, game);
    mountSubObj(subObjWalking.collidedSubObjs[0], game);
  }
}

export function movePlayer(dvec: Vec2, game: Game) {
  const moveTargetDiff = setMoveTarget(game.player.subObjEntity, dvec, game);
  moveCameraPosition(moveTargetDiff, game.camera);
}

export function createBaseSubObj(ecs: GameECS) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, '#FFFFFFFF')
  gradient.addColorStop(1, '#FFFFFF00')

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const objEntity = createObjEntity(ecs, 'base');
  ecs.setComponent(objEntity, 'obj/sprite', {
    spritesheet: canvas.toDataURL('image/png'), // use 'image/webp' when Safari finally support webp
    eightBitStyle: true,
    colRow: [1, 1],
    stateAnimations: {
      normal: {
        animations: [[0, 0]],
        speed: 0,
      },
    },
    tall: 1,
    radius: 0.5,
  });
  ecs.setComponent(objEntity, 'obj/walkable', {
    speed: 4,
    maxClimbRad: Math.PI * 0.3,
  });
}
