import localForage from 'localforage';

import * as ss from 'superstruct';

import { Game } from './game';
import { GameECS } from './gameECS';
import { ensureIpfsStarted, calcJsonCid, fetchIpfsJson } from './ipfs';
import { migrateRealmJson, migrateSpriteJson } from './migration';

import { packedObjRealmComponentType, pack as packObjRealm, unpack as unpackObjRealm } from './obj/realm';
import { PackedChunkComponent, packedChunkComponentType, pack as packChunk, unpack as unpackChunk } from './chunk/chunk';
import { updateChunkTextureUrl } from './chunk/render';
import { PackedSubObjComponent, packedSubObjComponentType, pack as packSubObj, unpack as unpackSubObj } from './subObj/subObj';
import { packedObjSpriteComponentType, pack as packObjSprite, unpack as unpackObjSprite } from './obj/sprite';
import { packedObjWalkableComponentType, pack as packObjWalkable, unpack as unpackObjWalkable } from './obj/walkable';

import { EntityRef, Sid, sidType, entityEqual } from './utils/ecs';
import { warnIfNotPresent } from './utils/utils';
import { createJsonBlob, downloadJson } from './utils/web';

import { LATEST_STORAGE_VERSION } from './consts';

import { DBG_MODE } from './dbg';

export function sidEntryType<T>(t: ss.Struct<T>) {
  return ss.tuple([sidType, t]);
}
export type SidEntry<T> = [Sid, T] & ss.Infer<ReturnType<typeof sidEntryType>>;

export function sidEntriesType<T>(t: ss.Struct<T>) {
  return ss.array(sidEntryType(t));
}
export type SidEntries<T> = SidEntry<T>[] & ss.Infer<ReturnType<typeof sidEntryType>>;

const exportedRealmJsonType = ss.object({
  version: ss.number(),
  packedObjRealm: packedObjRealmComponentType,
  packedChunks: sidEntriesType(packedChunkComponentType),
  packedSubObjs: sidEntriesType(packedSubObjComponentType),
});
export type ExportedRealmJson = ss.Infer<typeof exportedRealmJsonType>;

export const exportedSpriteJsonType = ss.object({
  version: ss.number(),
  // realmCid: ss.string(),
  packedObjSprite: packedObjSpriteComponentType,
  packedObjWalkable: packedObjWalkableComponentType,
});
export type ExportedSpriteJson = ss.Infer<typeof exportedSpriteJsonType>;

export interface StorageManager {
}

export function init(): StorageManager {
  return {}
}

export async function start(game: Game): Promise<void> {
  if (DBG_MODE) {
    (window as any).exportRealm = async (method: ExportRealmMethod) => {
      const exportedIpfsPath = await exportRealm(method, game);
      console.log({ exportedIpfsPath });
    };
    (window as any).exportSprite = () => {
      exportSprite(game);
    }
  }
}

export async function fetchRealm(realmObjPath: string, game: Game): Promise<ExportedRealmJson> {
  let json;
  if (realmObjPath.startsWith('/local/')) {
    json = await localForage.getItem(realmObjPath);
  } else if (realmObjPath.startsWith('/ipfs/')) {
    await ensureIpfsStarted(game);
    json = await fetchIpfsJson(realmObjPath, game);
  } else {
    const devPath = `dev-objs/${realmObjPath.replace(/^\//, '')}-realm.json`;
    const response = await fetch(devPath);
    if (warnIfNotPresent(response.ok)) return;
    json = await response.json();
  }

  if (json) {
    return importRealm(realmObjPath, json);
  }
}

export async function importRealm(realmObjPath: string, json: any): Promise<ExportedRealmJson> {
  migrateRealmJson(json) // alter json in-place
  const [err, jsonValidated] = ss.validate(json, exportedRealmJsonType);

  if (err) {
    console.warn('importRealm: realmJson did not pass the validation:', err);
    return;
  };

  await localForage.setItem(realmObjPath, jsonValidated);
  return jsonValidated;
}

export function loadExportedRealm(json: ExportedRealmJson, ecs: GameECS): EntityRef {
  const newRealmEntity = ecs.allocate();
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

type ExportRealmMethod = 'local' | 'download' | 'ipfs';
/**
 * @returns Promise<realmObjPath>
 */
export async function exportRealm(method: ExportRealmMethod, game: Game): Promise<string> {
  const realmObjEntityComponents = game.ecs.getEntityComponents(game.realm.currentObj);

  const subObjSids: Sid[] = [];

  const packedObjRealm = packObjRealm(realmObjEntityComponents.get('obj/realm'), game.ecs);
  const packedChunks = packedObjRealm.chunkEntries.map(([_chunkIJ, sid]) => {
    const chunkEntityComponents = game.ecs.getEntityComponents(game.ecs.fromSid(sid));
    const chunk = chunkEntityComponents.get('chunk');

    updateChunkTextureUrl(chunkEntityComponents);

    const packedChunk = packChunk({
      ...chunk,
      subObjs: chunk.subObjs.filter(subObjEntity => !entityEqual(subObjEntity, game.player.subObjEntity))
    }, game.ecs);
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
  
  const objRealmJson: ExportedRealmJson = {
    version: LATEST_STORAGE_VERSION,
    packedObjRealm,
    packedChunks,
    packedSubObjs,
  };
  let realmObjPath;

  switch (method) {
    case 'local':
      realmObjPath = `/local/${await calcJsonCid(objRealmJson)}`;

      await localForage.setItem(realmObjPath, objRealmJson);
      break;
    case 'ipfs':
      await ensureIpfsStarted(game);
      const { path } = await game.ipfs.add(createJsonBlob(objRealmJson));
      realmObjPath = `/ipfs/${path}`;
      break;
    case 'download':
      downloadJson(objRealmJson, `realm-${await calcJsonCid(objRealmJson)}.json`);
      break;
  }

  return realmObjPath;
}

export async function fetchObjSprite(spriteCid: /* TODO */ Sid): Promise<ExportedSpriteJson> {
  const response = await fetch(`dev-objs/${spriteCid}-sprite.json`);
  if (warnIfNotPresent(response.ok)) return;
  const json = await response.json();

  migrateSpriteJson(json);
  const [err, jsonValidated] = ss.validate(json, exportedSpriteJsonType);

  if (err) {
    console.warn(err);
    return;
  }

  await localForage.setItem(`sprite:${spriteCid}`, jsonValidated);
  return jsonValidated;
}

export function loadExportedSprite(spriteCid: /* TODO */ Sid, json: ExportedSpriteJson, ecs: GameECS): EntityRef {
  const objEntity = ecs.fromSid(spriteCid);
  unpackObjSprite(objEntity, json.packedObjSprite, ecs);
  unpackObjWalkable(objEntity, json.packedObjWalkable, ecs);

  return objEntity;
}

// just for dev obj
export function exportSprite(game: Game) {
  const objEntities: EntityRef[] = [];
  game.ecs.getComponentEntities('subObj').forEach(([_subObjEntity, subObj]) => {
    if (objEntities.findIndex(oEntity => entityEqual(oEntity, subObj.obj)) === -1) {
      objEntities.push(subObj.obj);
    }
  });

  objEntities.forEach(objEntity => {
    const objEntityComponents = game.ecs.getEntityComponents(objEntity);
    const objSid = game.ecs.getSid(objEntity); // should be hash-of-obj-realm
    const packedObjSprite = packObjSprite(objEntityComponents.get('obj/sprite'));
    const packedObjWalkable = packObjWalkable(objEntityComponents.get('obj/walkable'));

    const objSpriteJson: ExportedSpriteJson = {
      version: LATEST_STORAGE_VERSION,
      packedObjSprite,
      packedObjWalkable,
    };
    downloadJson(objSpriteJson, `${objSid}-sprite.json`);
  });
}
