import localForage from 'localforage';

import * as ss from 'superstruct';

import type { Game } from './game';
import {
  PackedRealmJson, PackedSpriteJson,
  packedRealmJsonType, packedSpriteJsonType,
  packRealm, packSprite,
} from './resourcePacker';
import { loadPackedSprite } from './resourceLoader';
import { ensureIpfsStarted, calcJsonCid, fetchIpfsJson } from './ipfs';
import { migrateRealmJson, migrateSpriteJson } from './migration';
import { reqSprite } from './network';

import { ObjPath } from './obj/obj';
import { addSubObjToScene } from './subObj/subObj';

import { EntityRef, entityEqual } from './utils/ecs';
import { warnIfNotPresent } from './utils/utils';
import { createJsonBlob, downloadJson } from './utils/web';

export interface ResourceManager {
  fetchingForSubObjs: Map<ObjPath, EntityRef[]>;
  savedRealmObjPath?: ObjPath;
}

export function init(): ResourceManager {
  return {
    fetchingForSubObjs: new Map(),
  }
}

export async function start(_game: Game): Promise<void> {
}

export async function importRealm(realmObjPath: ObjPath, json: any): Promise<PackedRealmJson> {
  migrateRealmJson(json) // alter json in-place
  const [err, jsonValidated] = ss.validate(json, packedRealmJsonType);

  if (err) {
    console.warn('importRealm: realmJson did not pass the validation:', err);
    return;
  };

  await localForage.setItem(realmObjPath, jsonValidated);
  return jsonValidated;
}


export async function exportRealm(method: ExportObjMethod, game: Game): Promise<ObjPath> {
  const objRealmJson = packRealm(game);
  const realmObjPath = await exportObjJson(method, objRealmJson, game);
  game.ecs.setSid(game.realm.currentObj, realmObjPath);

  return realmObjPath;
}

export async function importSprite(realmObjPath: ObjPath, json: any): Promise<PackedSpriteJson> {
  migrateSpriteJson(json);
  const [err, jsonValidated] = ss.validate(json, packedSpriteJsonType);

  if (err) {
    console.warn(err);
    return;
  }

  await localForage.setItem(realmObjPath, jsonValidated);
  return jsonValidated;
}

export async function exportSprite(method: ExportObjMethod, objSprite: EntityRef, game: Game): Promise<ObjPath> {
  const objSpriteComponents = game.ecs.getEntityComponents(objSprite);

  const objSpriteJson = packSprite(objSprite, game);
  const spriteObjPath = await exportObjJson(method, objSpriteJson, game);
  game.ecs.setSid(objSpriteComponents.entity, spriteObjPath);

  return spriteObjPath;
}

export async function fetchObjJson(objPath: ObjPath, game: Game, devObjPostfix: string): Promise<any> {
  let json;
  if (objPath.startsWith('/local/')) {
    json = await localForage.getItem(objPath);
  } else if (objPath.startsWith('/ipfs/')) {
    await ensureIpfsStarted(game);
    json = await fetchIpfsJson(objPath, game);
  } else {
    const devPath = `dev-objs/${objPath.replace(/^\//, '')}${devObjPostfix}.json`;
    const response = await fetch(devPath);
    if (warnIfNotPresent(response.ok)) return;
    json = await response.json();
  }

  return json;
}

export async function requireForSubObj(subObjEntityRequiring: EntityRef, objEntity: EntityRef, game: Game) {
  const objPath = game.ecs.getSid(objEntity);
  const obj = game.ecs.getComponent(objEntity, 'obj');
  if (obj) return; // already required

  let waitingSubObjs = game.resource.fetchingForSubObjs.get(objPath);
  if (!waitingSubObjs) {
    waitingSubObjs = [];
    game.resource.fetchingForSubObjs.set(objPath, waitingSubObjs);
  }
  if (waitingSubObjs.findIndex(subObj => entityEqual(subObj, subObjEntityRequiring)) === -1) {
    waitingSubObjs.push(subObjEntityRequiring);
  }

  let json = await fetchObjJson(objPath, game, '-sprite');

  if (!json && game.network.roomName) {
    json = await reqSprite(objPath, game);
  }
  if (warnIfNotPresent(json)) return;
  const jsonValidated = await importSprite(objPath, json);

  loadPackedSprite(objPath, jsonValidated, game.ecs);
  waitingSubObjs.forEach(subObj => {
    addSubObjToScene(subObj, game, true);
  });
  game.resource.fetchingForSubObjs.delete(objPath);
}

type ExportObjMethod = 'local' | 'download' | 'ipfs';
async function exportObjJson(method: ExportObjMethod, json: any, game: Game): Promise<ObjPath> {
  let realmObjPath: ObjPath;
  switch (method) {
    case 'local':
      realmObjPath = `/local/${await calcJsonCid(json)}`;

      await localForage.setItem(realmObjPath, json);
      break;
    case 'ipfs':
      await ensureIpfsStarted(game);
      const { path } = await game.ipfs.add(createJsonBlob(json));
      realmObjPath = `/ipfs/${path}`;
      break;
    case 'download':
      downloadJson(json, `realm-${await calcJsonCid(json)}.json`);
      break;
  }

  return realmObjPath;
}
