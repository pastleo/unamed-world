import { Game } from './game';
import { GameECS, GameEntityComponents } from './gameECS';
import { fetchObjSprite, loadExportedSprite } from './storage';

import { ObjPath, createObjEntity } from './obj/obj';
import { getChunkEntityComponents } from './chunk/chunk';
import { addOrRefreshSubObjToScene } from './subObj/subObj';

import { EntityRef, entityEqual } from './utils/ecs';
import { warnIfNotPresent } from './utils/utils';
import { createCanvas2d } from './utils/web';

export interface SpriteManager {
  fetchingObjs: Map<ObjPath, EntityRef[]>;
}

export function init(): SpriteManager {
  return {
    fetchingObjs: new Map(),
  }
}

export function getObjOrBaseComponents(objEntity: EntityRef, ecs: GameECS): GameEntityComponents {
  const objSprite = ecs.getComponent(objEntity, 'obj/sprite');
  if (objSprite) return ecs.getEntityComponents(objEntity);

  return ecs.getEntityComponents(ecs.fromSid('base'));
}

export async function requireObjSprite(subObjEntityRequiring: EntityRef, objEntity: EntityRef, game: Game) {
  const objSprite = game.ecs.getComponent(objEntity, 'obj/sprite');
  if (objSprite) return; // already required

  const spriteObjPath: ObjPath = game.ecs.getSid(objEntity);
  let waitingSubObjs = game.spriteManager.fetchingObjs.get(spriteObjPath);
  if (!waitingSubObjs) {
    waitingSubObjs = []
    game.spriteManager.fetchingObjs.set(spriteObjPath, waitingSubObjs);
  }
  if (waitingSubObjs.findIndex(subObj => entityEqual(subObj, subObjEntityRequiring)) === -1) {
    waitingSubObjs.push(subObjEntityRequiring);
  }

  const json = await fetchObjSprite(spriteObjPath, game);
  if (warnIfNotPresent(json)) return;

  loadExportedSprite(spriteObjPath, json, game.ecs);
  waitingSubObjs.forEach(subObj => {
    addOrRefreshSubObjToScene(subObj, game);
  });
  game.spriteManager.fetchingObjs.delete(spriteObjPath);
}

export function buildSpriteFromCurrentRealm(game: Game): EntityRef {
  const chunkEntityComponents = getChunkEntityComponents([0, 0], game.realm.currentObj, game.ecs);

  const newObjSprite = game.ecs.allocate();
  const newObjSpriteComponents = game.ecs.getEntityComponents(newObjSprite);

  newObjSpriteComponents.set('obj/sprite', {
    spritesheet: chunkEntityComponents.get('chunk').textureUrl, // TODO
    colRow: [1, 1],
    stateAnimations: {
      normal: {
        animations: [[0, 0]],
        speed: 0,
      },
    },
    tall: 1,
    radius: 0.5,
    srcRealmObjPath: game.ecs.getSid(game.realm.currentObj),
  });
  newObjSpriteComponents.set('obj/walkable', {
    speed: 4,
    maxClimbRad: Math.PI * 0.3,
  });

  return newObjSpriteComponents.entity;
}


export function createBaseSpriteObj(ecs: GameECS) {
  const ctx = createCanvas2d(256, 256);

  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, '#FFFFFFFF')
  gradient.addColorStop(1, '#FFFFFF00')

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const objEntity = createObjEntity(ecs, 'base');
  ecs.setComponent(objEntity, 'obj/sprite', {
    spritesheet: ctx.canvas.toDataURL('image/png'), // use 'image/webp' when Safari finally support webp
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
    collision: false,
  });
  ecs.setComponent(objEntity, 'obj/walkable', {
    speed: 4,
    maxClimbRad: Math.PI * 0.3,
  });
}
