import localForage from 'localforage';

import * as ss from 'superstruct';

import { Game } from './game';
import { GameECS } from './gameECS';
import { ensureIpfsStarted, calcJsonCid, fetchIpfsJson } from './ipfs';
import { migrateRealmJson, migrateSpriteJson } from './migration';

import { ObjPath } from './obj/obj';
import { packedObjRealmComponentType, pack as packObjRealm, unpack as unpackObjRealm } from './obj/realm';
import { PackedChunkComponent, packedChunkComponentType, pack as packChunk, unpack as unpackChunk } from './chunk/chunk';
import { updateChunkTextureUrl } from './chunk/render';
import { PackedSubObjComponent, packedSubObjComponentType, pack as packSubObj, unpack as unpackSubObj } from './subObj/subObj';
import { packedObjSpriteComponentType, pack as packObjSprite, unpack as unpackObjSprite } from './obj/sprite';
import { packedObjWalkableComponentType, pack as packObjWalkable, unpack as unpackObjWalkable } from './obj/walkable';

import { EntityRef, Sid, sidType } from './utils/ecs';
import { warnIfNotPresent } from './utils/utils';
import { createJsonBlob, downloadJson } from './utils/web';

import { LATEST_STORAGE_VERSION } from './consts';

export function sidEntryType<T>(t: ss.Struct<T>) {
  return ss.tuple([sidType, t]);
}
export type SidEntry<T> = [Sid, T] & ss.Infer<ReturnType<typeof sidEntryType>>;

export function sidEntriesType<T>(t: ss.Struct<T>) {
  return ss.array(sidEntryType(t));
}
export type SidEntries<T> = SidEntry<T>[] & ss.Infer<ReturnType<typeof sidEntryType>>;

const packedRealmJsonType = ss.object({
  version: ss.number(),
  packedObjRealm: packedObjRealmComponentType,
  packedChunks: sidEntriesType(packedChunkComponentType),
  packedSubObjs: sidEntriesType(packedSubObjComponentType),
});
export type PackedRealmJson = ss.Infer<typeof packedRealmJsonType>;

export const packedSpriteJsonType = ss.object({
  version: ss.number(),
  packedObjSprite: packedObjSpriteComponentType,
  packedObjWalkable: packedObjWalkableComponentType,
});
export type PackedSpriteJson = ss.Infer<typeof packedSpriteJsonType>;

export interface StorageManager {
  savedRealmObjPath?: ObjPath;
}

export function init(): StorageManager {
  return {}
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

export function loadExportedRealm(realmObjPath: ObjPath, json: PackedRealmJson, ecs: GameECS): EntityRef {
  const newRealmEntity = ecs.fromSid(realmObjPath);
  unpackObjRealm(newRealmEntity, json.packedObjRealm, ecs);
  json.packedChunks.forEach(([sid, packedChunk]) => {
    unpackChunk(
      ecs.fromSid(sid),
      packedChunk,
      ecs,
    )
  });
  json.packedSubObjs.forEach(([sid, packedSubObjs]) => {
    unpackSubObj(
      ecs.fromSid(sid),
      packedSubObjs,
      ecs,
    );
  });

  return newRealmEntity;
}

export function packRealm(game: Game): PackedRealmJson {
  const realmObjEntityComponents = game.ecs.getEntityComponents(game.realm.currentObj);
  const subObjSids: Sid[] = [];

  const packedObjRealm = packObjRealm(realmObjEntityComponents.get('obj/realm'), game.ecs);
  const packedChunks = packedObjRealm.chunkEntries.map(([_chunkIJ, sid]) => {
    const chunkEntityComponents = game.ecs.getEntityComponents(game.ecs.fromSid(sid));

    updateChunkTextureUrl(chunkEntityComponents);
    const packedChunk = packChunk(chunkEntityComponents.get('chunk'), game.ecs);
    subObjSids.push(...packedChunk.subObjs);

    return [sid, packedChunk] as SidEntry<PackedChunkComponent>;
  });
  const packedSubObjs = subObjSids.map(sid => ([
    sid,
    packSubObj(
      game.ecs.getComponent(
        game.ecs.fromSid(sid),
        'subObj',
      ),
      game.ecs,
    )
  ] as SidEntry<PackedSubObjComponent>));
  
  return {
    version: LATEST_STORAGE_VERSION,
    packedObjRealm,
    packedChunks,
    packedSubObjs,
  };
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

export function loadExportedSprite(objSpritePath: ObjPath, json: PackedSpriteJson, ecs: GameECS): EntityRef {
  const objEntity = ecs.fromSid(objSpritePath);
  unpackObjSprite(objEntity, json.packedObjSprite, ecs);
  unpackObjWalkable(objEntity, json.packedObjWalkable, ecs);

  return objEntity;
}

export function packSprite(objSprite: EntityRef, game: Game): PackedSpriteJson {
  const objSpriteComponents = game.ecs.getEntityComponents(objSprite);
  const packedObjSprite = packObjSprite(objSpriteComponents.get('obj/sprite'));
  const packedObjWalkable = packObjWalkable(objSpriteComponents.get('obj/walkable'));

  return {
    version: LATEST_STORAGE_VERSION,
    packedObjSprite,
    packedObjWalkable,
  }
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
