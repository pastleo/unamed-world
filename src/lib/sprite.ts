import localForage from 'localforage';

import { Game } from './game';
import { GameECS, GameEntityComponents } from './gameECS';

import { getObjEntity, createObjEntity } from './obj/obj';
import { addOrRefreshSubObjToScene } from './subObj/subObj';
import { PackedObjSpriteComponent, pack as packObjSprite, unpack as unpackObjSprite } from './obj/sprite';
import { PackedObjWalkableComponent, pack as packObjWalkable, unpack as unpackObjWalkable } from './obj/walkable';

import { EntityRef, UUID, entityEqual } from './utils/ecs';
import { warnIfNotPresent, downloadJson } from './utils/utils';

export interface SpriteManager {
  fetchingObjs: Map<UUID, EntityRef[]>;
}

export interface ExportedSpriteJson {
  objUUID: UUID;
  packedObjSprite: PackedObjSpriteComponent;
  packedObjWalkable: PackedObjWalkableComponent;
}

export function init(): SpriteManager {
  return {
    fetchingObjs: new Map(),
  }
}

export function getObjOrBaseComponents(objEntity: EntityRef, ecs: GameECS): GameEntityComponents {
  const objSprite = ecs.getComponent(objEntity, 'obj/sprite');
  if (objSprite) return ecs.getEntityComponents(objEntity);

  return ecs.getEntityComponents(ecs.fromUUID('base'));
}

export async function requireObjSprite(subObjEntityRequiring: EntityRef, objEntity: EntityRef, game: Game) {
  const objSprite = game.ecs.getComponent(objEntity, 'obj/sprite');
  if (objSprite) return; // already required

  const spriteObjUUID = game.ecs.getUUID(objEntity);
  let waitingSubObjs = game.spriteManager.fetchingObjs.get(spriteObjUUID);
  if (!waitingSubObjs) {
    waitingSubObjs = []
    game.spriteManager.fetchingObjs.set(spriteObjUUID, waitingSubObjs);
  }
  if (waitingSubObjs.findIndex(subObj => entityEqual(subObj, subObjEntityRequiring)) === -1) {
    waitingSubObjs.push(subObjEntityRequiring);
  }

  const json = await fetchObjSprite(spriteObjUUID);
  if (warnIfNotPresent(json)) return;

  loadExportedSprite(json, game.ecs);
  waitingSubObjs.forEach(subObj => {
    addOrRefreshSubObjToScene(subObj, game);
  });
  game.spriteManager.fetchingObjs.delete(spriteObjUUID);
}

async function fetchObjSprite(spriteObjUUID: UUID): Promise<ExportedSpriteJson> {
  const response = await fetch(`dev-objs/${spriteObjUUID}-sprite.json`);
  if (warnIfNotPresent(response.ok)) return;
  const json = await response.json() as ExportedSpriteJson; // TODO: might need to be verified
  if (spriteObjUUID !== json.objUUID) {
    console.warn('UUID in json not equal');
    return;
  }

  await localForage.setItem(`sprite:${spriteObjUUID}`, json);
  return json;
}

export function loadExportedSprite(json: ExportedSpriteJson, ecs: GameECS): EntityRef {
  const objEntity = ecs.fromUUID(json.objUUID);
  unpackObjSprite(objEntity, json.packedObjSprite, ecs);
  unpackObjWalkable(objEntity, json.packedObjWalkable, ecs);

  return objEntity;
}

export function exportSprite(game: Game) {
  const objEntities: EntityRef[] = [];
  game.ecs.getComponentEntities('subObj').forEach(([_subObjEntity, subObj]) => {
    if (objEntities.findIndex(oEntity => entityEqual(oEntity, subObj.obj)) === -1) {
      objEntities.push(subObj.obj);
    }
  });

  objEntities.forEach(objEntity => {
    const objEntityComponents = game.ecs.getEntityComponents(objEntity);
    const objUUID = game.ecs.getUUID(objEntity);
    const packedObjSprite = packObjSprite(objEntityComponents.get('obj/sprite'));
    const packedObjWalkable = packObjWalkable(objEntityComponents.get('obj/walkable'));

    const objSpriteJson: ExportedSpriteJson = {
      objUUID,
      packedObjSprite,
      packedObjWalkable,
    };
    downloadJson(objSpriteJson, `${objUUID}-sprite.json`);
  });
}

export function generateRealmSprite() {
  // TODO
}

export function createBaseSpriteObj(ecs: GameECS) {
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
