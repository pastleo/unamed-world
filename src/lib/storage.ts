import localForage from 'localforage';
import { create as createIpfs, IPFS } from 'ipfs-core-min';
import * as uint8ArrUtils from 'uint8arrays';
import { CID } from 'multiformats/cid';
import * as ss from 'superstruct';

import { Game } from './game';
import { GameECS } from './gameECS';

import { packedObjRealmComponentType, pack as packObjRealm, unpack as unpackObjRealm } from './obj/realm';
import { PackedChunkComponent, packedChunkComponentType, pack as packChunk, unpack as unpackChunk } from './chunk/chunk';
import { PackedSubObjComponent, packedSubObjComponentType, pack as packSubObj, unpack as unpackSubObj } from './subObj/subObj';
import { packedObjSpriteComponentType, pack as packObjSprite, unpack as unpackObjSprite } from './obj/sprite';
import { packedObjWalkableComponentType, pack as packObjWalkable, unpack as unpackObjWalkable } from './obj/walkable';

import { EntityRef, UUID, uuidType, entityEqual } from './utils/ecs';
import { Vec2, warnIfNotPresent, downloadJson } from './utils/utils';

export const LATEST_STORAGE_VERSION = 1;

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
  realmUUID: uuidType,
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
  ipfsNode: IPFS;
}

export function init(): StorageManager {
  return {
    ipfsNode: null as unknown as IPFS,
    //ipfsNode: createIpfs() as unknown as IPFS,
  }
}

export async function untilStorageReady(game: Game): Promise<void> {
  //game.storage.ipfsNode = await (game.storage.ipfsNode as unknown as Promise<IPFS>);
  //console.log('ipfs ready');
}

export async function fetchRealm(realmObjUUID: UUID, game: Game): Promise<ExportedRealmJson> {
  return;
  let json;
  if (realmObjUUID.startsWith('k51')) {
    const path = await game.storage.ipfsNode.resolve('/ipns/' + realmObjUUID);
    console.log({ path });
  } else if (realmObjUUID.startsWith('Qm')) { // EXP
    json = await fetchIpfsJson(realmObjUUID, game);
    // cheat a bit:
    json.realmUUID = realmObjUUID;
  } else {
    const response = await fetch(`dev-objs/${realmObjUUID}-realm.json`);
    if (warnIfNotPresent(response.ok)) return;
    json = await response.json();
  }

  migrateRealmJson(json) // alter json in-place
  const [err, jsonValidated] = ss.validate(json, exportedRealmJsonType);

  if (err) {
    console.warn(err);
    return;
  }
  if (realmObjUUID !== jsonValidated.realmUUID) {
    console.warn('UUID in json not equal');
    return;
  }

  await localForage.setItem(`realm:${realmObjUUID}`, jsonValidated);
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
    console.log('migrated realmJson:', json.realmUUID);
  }
}

export function loadExportedRealm(json: ExportedRealmJson, ecs: GameECS): EntityRef {
  const newRealmEntity = ecs.fromUUID(json.realmUUID);
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

export function exportRealm(game: Game) {
  const realmObjEntityComponents = game.ecs.getEntityComponents(game.realm.currentObj);

  const realmUUID = game.ecs.getUUID(game.realm.currentObj);
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
    realmUUID,
    packedObjRealm,
    packedChunks,
    packedSubObjs,
  };
  downloadJson(objRealmJson, `${realmUUID}-realm.json`);
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

async function fetchIpfsJson(cidStr: string, game: Game) {
  const cid = CID.parse(cidStr);

  // result:
  const chunks = [];
  console.log('ipfs.cat() starts...');

  for await (const chunk of game.storage.ipfsNode.cat(cid)) {
    console.log('chunk get');
    chunks.push(chunk);
  }
  const data = uint8ArrUtils.concat(chunks);
  console.log('file cid:', cid.toString());
  const json = JSON.parse(uint8ArrUtils.toString(data));
  console.log('file contents:', json);
  return json;
}
