import localForage from 'localforage';
import * as T from 'typed';

import { Game } from './game';
import { GameECS } from './gameECS';

import { packedObjRealmComponentType, pack as packObjRealm, unpack as unpackObjRealm } from './obj/realm';
import { PackedChunkComponent, packedChunkComponentType, pack as packChunk, unpack as unpackChunk } from './chunk/chunk';
import { PackedSubObjComponent, packedSubObjComponentType, pack as packSubObj, unpack as unpackSubObj } from './subObj/subObj';
import { packedObjSpriteComponentType, pack as packObjSprite, unpack as unpackObjSprite } from './obj/sprite';
import { packedObjWalkableComponentType, pack as packObjWalkable, unpack as unpackObjWalkable } from './obj/walkable';

import { EntityRef, UUID, uuidType, entityEqual } from './utils/ecs';
import { Vec2, warnIfNotPresent, downloadJson } from './utils/utils';

import { CURRENT_STORAGE_VERSION } from './consts';

const UUID = T.string;

export function uuidEntryType<U>(u: T.Typed<U>) {
  return T.tuple(uuidType, u);
}

export type UUIDEntry<T> = [UUID, T];
export function uuidEntriesType<U>(u: T.Typed<U>) {
  return T.array(uuidEntryType(u));
}
export type UUIDEntries<T> = UUIDEntry<T>[];

const exportedRealmJsonType = T.object({
  version: T.number,
  realmUUID: UUID,
  packedObjRealm: packedObjRealmComponentType,
  packedChunks: uuidEntriesType(packedChunkComponentType),
  packedSubObjs: uuidEntriesType(packedSubObjComponentType),
});
export type ExportedRealmJson = T.Infer<typeof exportedRealmJsonType>;

export const exportedSpriteJsonType = T.object({
  version: T.number,
  objUUID: uuidType,
  packedObjSprite: packedObjSpriteComponentType,
  packedObjWalkable: packedObjWalkableComponentType,
});
export type ExportedSpriteJson = T.Infer<typeof exportedSpriteJsonType>;

export async function fetchRealm(realmObjUUID: UUID): Promise<ExportedRealmJson> {
  const response = await fetch(`dev-objs/${realmObjUUID}-realm.json`);
  if (warnIfNotPresent(response.ok)) return;
  const json = await response.json()
  if (realmObjUUID !== json.realmUUID) {
    console.warn('UUID in json not equal');
    return;
  }
  migrateRealmJson(json) // alter json in-place
  const jsonValidated = exportedRealmJsonType(json);

  if (jsonValidated.success) {
    await localForage.setItem(`realm:${realmObjUUID}`, jsonValidated.value);
    return json;
  } else {
    console.warn((jsonValidated as T.Failure).errors);
    return;
  }
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
    version: CURRENT_STORAGE_VERSION,
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
      version: CURRENT_STORAGE_VERSION,
      objUUID,
      packedObjSprite,
      packedObjWalkable,
    };
    downloadJson(objSpriteJson, `${objUUID}-sprite.json`);
  });
}

