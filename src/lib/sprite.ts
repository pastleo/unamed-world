import { Game } from './game';
import { GameECS, GameEntityComponents } from './gameECS';
import { fetchObjSprite, loadExportedSprite } from './storage';

import { createObjEntity } from './obj/obj';
import { addOrRefreshSubObjToScene } from './subObj/subObj';

import { EntityRef, Sid, entityEqual } from './utils/ecs';
import { warnIfNotPresent } from './utils/utils';
import { createCanvas2d } from './utils/web';

export interface SpriteManager {
  fetchingObjs: Map<Sid, EntityRef[]>;
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

  const objCid = game.ecs.getSid(objEntity); // TODO
  let waitingSubObjs = game.spriteManager.fetchingObjs.get(objCid);
  if (!waitingSubObjs) {
    waitingSubObjs = []
    game.spriteManager.fetchingObjs.set(objCid, waitingSubObjs);
  }
  if (waitingSubObjs.findIndex(subObj => entityEqual(subObj, subObjEntityRequiring)) === -1) {
    waitingSubObjs.push(subObjEntityRequiring);
  }

  const json = await fetchObjSprite(objCid);
  if (warnIfNotPresent(json)) return;

  loadExportedSprite(objCid, json, game.ecs);
  waitingSubObjs.forEach(subObj => {
    addOrRefreshSubObjToScene(subObj, game);
  });
  game.spriteManager.fetchingObjs.delete(objCid);
}

export function generateRealmSprite() {
  // TODO
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
