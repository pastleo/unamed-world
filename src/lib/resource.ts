import localForage from 'localforage';

import * as ss from 'superstruct';

import type { Game } from './game';
import type { GameECS } from './gameECS';
import {
  PackedRealmJson, PackedSpriteJson,
  packedRealmJsonType, packedSpriteJsonType,
  packRealm, packSprite,
} from './resourcePacker';
import { loadPackedRealm, loadPackedSprite, isObjSpriteRequired } from './resourceLoader';
import { ensureIpfsStarted, calcJsonCid, fetchIpfsJson } from './ipfs';
import { migrateRealmJson, migrateSpriteJson } from './migration';
import { reqSprite } from './network';

import { ObjPath } from './obj/obj';
import { addSubObjToScene } from './subObj/subObj';

import { EntityRef, entityEqual } from './utils/ecs';
import { assertPresentOrWarn } from './utils/utils';
import { createJsonBlob, downloadJson } from './utils/web';

import { SAVED_OBJ_PATHS_STORAGE_NAME } from './consts';

export interface ResourceManager {
  fetchingForSubObjs: Map<ObjPath, EntityRef[]>;
  savedRealmObjPath?: ObjPath;
  savedObjRecords: SavedObjRecord[];
}
export interface SavedObjRecord {
  realmObjPath: ObjPath;
  spriteObjPath: ObjPath;
}

export function init(): ResourceManager {
  return {
    fetchingForSubObjs: new Map(),
    savedObjRecords: [],
  }
}

export async function start(game: Game): Promise<void> {
  game.resource.savedObjRecords = await localForage.getItem(SAVED_OBJ_PATHS_STORAGE_NAME) || [];
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
  game.ecs.addSid(game.realm.currentObj, realmObjPath, true);

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

  const objSpriteJson = packSprite(objSprite, game.ecs);
  const spriteObjPath = await exportObjJson(method, objSpriteJson, game);
  game.ecs.addSid(objSpriteComponents.entity, spriteObjPath, true);

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
    if (!response.ok) {
      console.warn(`resource.fetchObjJson: fetching '${devPath}' failed`, response);
      return null;
    }
    json = await response.json();
  }

  return json;
}

export async function requireSprite(objEntityOrPath: EntityRef | ObjPath, game: Game): Promise<EntityRef> {
  const [isRequired, objPath, objEntity] = isObjSpriteRequired(objEntityOrPath, game.ecs);
  if (isRequired) return objEntity;

  const loadedObjSprite = await fetchAndLoadSprite(objPath, game);
  if (!loadedObjSprite) return null;

  return loadedObjSprite;
}

export async function requireSpriteForSubObj(subObjEntityRequiring: EntityRef, objEntity: EntityRef, game: Game) {
  const [isRequired, objPath] = isObjSpriteRequired(objEntity, game.ecs);
  if (isRequired) return;

  let waitingSubObjs = game.resource.fetchingForSubObjs.get(objPath);
  if (!waitingSubObjs) {
    waitingSubObjs = [];
    game.resource.fetchingForSubObjs.set(objPath, waitingSubObjs);
  }
  if (waitingSubObjs.findIndex(subObj => entityEqual(subObj, subObjEntityRequiring)) === -1) {
    waitingSubObjs.push(subObjEntityRequiring);
  }

  const loadedObjSprite = await fetchAndLoadSprite(objPath, game);
  if (!loadedObjSprite) return;

  waitingSubObjs.forEach(subObj => {
    addSubObjToScene(subObj, game, true);
  });
  game.resource.fetchingForSubObjs.delete(objPath);
}

export async function fetchAndLoadSprite(objPath: ObjPath, game: Game): Promise<EntityRef> {
  let json = await fetchObjJson(objPath, game, '-sprite');

  if (!json && game.network.roomName) {
    json = await reqSprite(objPath, game);
  }
  if (assertPresentOrWarn([json], 'resource.requireForSubObj: json not fetched')) return null;
  const jsonValidated = await importSprite(objPath, json);

  return loadPackedSprite(objPath, jsonValidated, game.ecs);
}

type ExportObjMethod = 'local' | 'download' | 'ipfs';
async function exportObjJson(method: ExportObjMethod, json: any, game: Game): Promise<ObjPath> {
  let realmObjPath: ObjPath;
  switch (method) {
    case 'local':
      realmObjPath = await exportObjJsonLocally(json);
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

async function exportObjJsonLocally(json: any): Promise<ObjPath> {
  const realmObjPath = `/local/${await calcJsonCid(json)}`;
  await localForage.setItem(realmObjPath, json);
  return realmObjPath;
}

export async function switchRealmLocally(objRealmPath: ObjPath, prevRealmEntity: EntityRef, ecs: GameECS): Promise<EntityRef | null> {
  if (!objRealmPath) return null;

  const json = await localForage.getItem<PackedRealmJson>(objRealmPath);
  if (!json) return null;

  const prevChunks = ecs.getComponent(prevRealmEntity, 'obj/realm').chunks;
  prevChunks.entries().forEach(([_chunkIJ, chunkEntity]) => {
    ecs.deallocate(chunkEntity);
  });
  ecs.deallocate(prevRealmEntity);

  return loadPackedRealm(objRealmPath, json, ecs);
}

export async function exportSpriteLocally(objSprite: EntityRef, ecs: GameECS): Promise<ObjPath> {
  const objSpriteComponents = ecs.getEntityComponents(objSprite);

  const objSpriteJson = packSprite(objSprite, ecs);
  const spriteObjPath = await exportObjJsonLocally(objSpriteJson);
  ecs.addSid(objSpriteComponents.entity, spriteObjPath, true);

  return spriteObjPath;
}

export async function addSavedObj(realmObjPath: ObjPath, spriteObjPath: ObjPath, game: Game, recordIndexToOverwrite?: number) {
  let savedRecordIndex;
  if (typeof recordIndexToOverwrite === 'number') {
    game.resource.savedObjRecords[recordIndexToOverwrite] = {
      realmObjPath, spriteObjPath,
    };
    savedRecordIndex = recordIndexToOverwrite;
  } else {
    game.resource.savedObjRecords.push({
      realmObjPath, spriteObjPath,
    });
    savedRecordIndex = game.resource.savedObjRecords.length - 1;
  }

  await updateSavedRecords(game);
  game.ui.options.setSelectedSavedObjRecords(savedRecordIndex);
}

export async function rmSavedObj(recordIndex: number, game: Game) {
  game.resource.savedObjRecords.splice(recordIndex, 1);

  // TODO: garbage collect maybe?

  await updateSavedRecords(game);
}

async function updateSavedRecords(game: Game) {
  await localForage.setItem(SAVED_OBJ_PATHS_STORAGE_NAME, game.resource.savedObjRecords);
  game.ui.options.updateSavedObjRecords();
}
