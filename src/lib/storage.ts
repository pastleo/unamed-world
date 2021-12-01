import localForage from 'localforage';
import * as BufferUtils from 'uint8arrays';
import * as ss from 'superstruct';

import { Game } from './game';
import { GameECS } from './gameECS';
import { ensureIpfsUNetworkStarted } from './ipfs-unamed-network';

import { packedObjRealmComponentType, pack as packObjRealm, unpack as unpackObjRealm } from './obj/realm';
import { PackedChunkComponent, packedChunkComponentType, pack as packChunk, unpack as unpackChunk } from './chunk/chunk';
import { PackedSubObjComponent, packedSubObjComponentType, pack as packSubObj, unpack as unpackSubObj } from './subObj/subObj';
import { packedObjSpriteComponentType, pack as packObjSprite, unpack as unpackObjSprite } from './obj/sprite';
import { packedObjWalkableComponentType, pack as packObjWalkable, unpack as unpackObjWalkable } from './obj/walkable';

import { EntityRef, UUID, uuidType, entityEqual } from './utils/ecs';
import { Vec2, warnIfNotPresent, genUUID, createJsonBlob, downloadJson } from './utils/utils';

export const LATEST_STORAGE_VERSION = 2;

export function uuidEntryType<T>(t: ss.Struct<T>) {
  return ss.tuple([uuidType, t]);
}
export type UUIDEntry<T> = [UUID, T] & ss.Infer<ReturnType<typeof uuidEntryType>>;

export function uuidEntriesType<T>(t: ss.Struct<T>) {
  return ss.array(uuidEntryType(t));
}
export type UUIDEntries<T> = UUIDEntry<T>[] & ss.Infer<ReturnType<typeof uuidEntriesType>>;

const exportedRealmJsonType = ss.object({
  version: ss.number(),
  packedObjRealm: packedObjRealmComponentType,
  packedChunks: uuidEntriesType(packedChunkComponentType),
  packedSubObjs: uuidEntriesType(packedSubObjComponentType),
});
export type ExportedRealmJson = ss.Infer<typeof exportedRealmJsonType>;

export const exportedSpriteJsonType = ss.object({
  version: ss.number(),
  objUUID: uuidType,
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
  { // development
    (window as any).exportRealm = async () => {
      const exportedIpfsPath = await exportRealm(game);
      console.log({ exportedIpfsPath });
    };
    (window as any).exportSprite = () => {
      exportSprite(game);
    }
  }
}

export async function fetchRealm(realmObjPath: UUID, game: Game): Promise<ExportedRealmJson> {
  let json;
  if (realmObjPath.startsWith('/ipfs/')) {
    await ensureIpfsUNetworkStarted(game);
    json = await fetchIpfsJson(`${realmObjPath}/realm.json`, game);
  } else {
    const devPath = `dev-objs/${realmObjPath.replace(/^\//, '')}-realm.json`;
    const response = await fetch(devPath);
    if (warnIfNotPresent(response.ok)) return;
    json = await response.json();
  }

  migrateRealmJson(json) // alter json in-place
  const [err, jsonValidated] = ss.validate(json, exportedRealmJsonType);

  if (err) throw err;

  await localForage.setItem(`realm:${realmObjPath}`, jsonValidated);
  return jsonValidated;
}

function migrateRealmJson(json: any) {
  if (!json.version) { // version null
    json.packedChunks.forEach(([_, chunk]: [string, {cellsEntries: any}]) => {
      chunk.cellsEntries.forEach(([_, cell]: [Vec2, {flatness: number}]) => {
        cell.flatness *= 10;
      });
    });
    json.version = 1;
    console.log('migrated realmJson to v1:', json);
  }

  if (json.version === 1) {
    delete json.realmUUID;
    json.version = 2;
    console.log('migrated realmJson to v2:', json);
  }
}

export function loadExportedRealm(objUUID: string, json: ExportedRealmJson, ecs: GameECS): EntityRef {
  const newRealmEntity = ecs.fromUUID(objUUID);
  unpackObjRealm(newRealmEntity, json.packedObjRealm, ecs);
  json.packedChunks.forEach(([UUID, packedChunk]) => {
    unpackChunk(
      ecs.fromUUID(UUID),
      packedChunk,
      ecs,
    )
  });
  json.packedSubObjs.forEach(([UUID, packedSubObjs]) => {
    unpackSubObj(
      ecs.fromUUID(UUID),
      packedSubObjs,
      ecs,
    );
  });

  return newRealmEntity;
}

export async function exportRealm(game: Game): Promise<string> {
  await ensureIpfsUNetworkStarted(game);

  const realmObjEntityComponents = game.ecs.getEntityComponents(game.realm.currentObj);

  const tmpUUID = genUUID();
  const objTmpPath = `/tmp/${tmpUUID}`;
  await game.ipfs.files.mkdir(objTmpPath, { parents: true });

  //const realmUUID = game.ecs.getUUID(game.realm.currentObj, true);
  const subObjUUIDs: UUID[] = [];

  const packedObjRealm = packObjRealm(realmObjEntityComponents.get('obj/realm'), game.ecs);
  const packedChunks = packedObjRealm.chunkEntries.map(([_chunkIJ, uuid]) => {
    const chunk = game.ecs.getComponent(game.ecs.fromUUID(uuid), 'chunk');
    const packedChunk = packChunk({
      ...chunk,
      subObjs: chunk.subObjs.filter(subObjEntity => !entityEqual(subObjEntity, game.player.subObjEntity))
    }, game.ecs);
    subObjUUIDs.push(...packedChunk.subObjs);

    return [uuid, packedChunk] as UUIDEntry<PackedChunkComponent>;
  });
  const packedSubObjs = subObjUUIDs.map(uuid => ([
    uuid,
    packSubObj(
      game.ecs.getComponent(
        game.ecs.fromUUID(uuid),
        'subObj',
      ),
      game.ecs,
    )
  ] as UUIDEntry<PackedSubObjComponent>));
  
  const objRealmJson: ExportedRealmJson = {
    version: LATEST_STORAGE_VERSION,
    packedObjRealm,
    packedChunks,
    packedSubObjs,
  };

  //downloadJson(objRealmJson, `${realmUUID}-realm.json`);

  await game.ipfs.files.write(`${objTmpPath}/realm.json`, createJsonBlob(objRealmJson), { create: true });

  // TODO: generate ExportedSpriteJson on `${objTmpPath}/sprite.json`

  const objPath = `/ipfs/${(await game.ipfs.files.stat(objTmpPath)).cid}`;
  //const addOptions = {
    //pin: true,
    //wrapWithDirectory: true,
    //timeout: 10000
  //};
  //for await (const uploadedFile of game.ipfs.addAll(globSource(objPath, '**/*'), addOptions)) {
    //console.log({ uploadedFile })
  //}
  return objPath;
}

export async function fetchObjSprite(spriteObjUUID: UUID): Promise<ExportedSpriteJson> {
  const response = await fetch(`dev-objs/${spriteObjUUID}-sprite.json`);
  if (warnIfNotPresent(response.ok)) return;
  const json = await response.json();

  migrateSpriteJson(json);
  const [err, jsonValidated] = ss.validate(json, exportedSpriteJsonType);

  if (err) {
    console.warn(err);
    return;
  }
  if (spriteObjUUID !== jsonValidated.objUUID) {
    console.warn('UUID in json not equal');
    return;
  }

  await localForage.setItem(`sprite:${spriteObjUUID}`, jsonValidated);
  return jsonValidated;
}

function migrateSpriteJson(json: any) {
  if (!json.version) { // version null
    json.version = 1;
    console.log('migrated SpriteJson:', json.objUUID);
  }
}

export function loadExportedSprite(json: ExportedSpriteJson, ecs: GameECS): EntityRef {
  const objEntity = ecs.fromUUID(json.objUUID);
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
    const objUUID = game.ecs.getUUID(objEntity);
    const packedObjSprite = packObjSprite(objEntityComponents.get('obj/sprite'));
    const packedObjWalkable = packObjWalkable(objEntityComponents.get('obj/walkable'));

    const objSpriteJson: ExportedSpriteJson = {
      version: LATEST_STORAGE_VERSION,
      objUUID,
      packedObjSprite,
      packedObjWalkable,
    };
    downloadJson(objSpriteJson, `${objUUID}-sprite.json`);
  });
}

async function fetchIpfsJson(ipfsPath: string, game: Game) {
  const chunks = [];
  console.log(`ipfs.files.read('${ipfsPath}') starts...`);

  for await (const chunk of game.ipfs.files.read(ipfsPath)) {
    chunks.push(chunk);
  }
  const data = BufferUtils.concat(chunks);
  const json = JSON.parse(BufferUtils.toString(data));
  console.log('fetchIpfsJson done', { ipfsPath, json });
  return json;
}
