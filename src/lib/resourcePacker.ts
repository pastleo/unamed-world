import * as ss from 'superstruct';

import type { Game } from './game';
import type { GameECS } from './gameECS';
import {
  LATEST_REALM_JSON_VERSION, LATEST_SPRITE_JSON_VERSION,
} from './migration';

import { packedObjComponentType, pack as packObj } from './obj/obj';
import { packedObjRealmComponentType, pack as packObjRealm } from './obj/realm';
import { PackedChunkComponent, packedChunkComponentType, pack as packChunk } from './chunk/chunk';
import { updateChunkTextureUrl } from './chunk/render';
import { PackedSubObjComponent, pack as packSubObj } from './subObj/subObj';
import { packedObjSpriteComponentType, pack as packObjSprite } from './obj/sprite';
import { packedObjWalkableComponentType, pack as packObjWalkable } from './obj/walkable';

import { EntityRef, Sid, sidType } from './utils/ecs';
import { packedSubObjComponentType } from './utils/superstructTypes';

export function sidEntryType<T>(t: ss.Struct<T>) {
  return ss.tuple([sidType, t]);
}
export type SidEntry<T> = [Sid, T] & ss.Infer<ReturnType<typeof sidEntryType>>;

export function sidEntriesType<T>(t: ss.Struct<T>) {
  return ss.array(sidEntryType(t));
}
export type SidEntries<T> = SidEntry<T>[] & ss.Infer<ReturnType<typeof sidEntryType>>;

export const packedRealmJsonType = ss.object({
  version: ss.number(),
  packedObjRealm: packedObjRealmComponentType,
  packedChunks: sidEntriesType(packedChunkComponentType),
  packedSubObjs: sidEntriesType(packedSubObjComponentType),
});
export type PackedRealmJson = ss.Infer<typeof packedRealmJsonType>;

export function packRealm(game: Game, realmObj: EntityRef = game.realm.currentObj): PackedRealmJson {
  const realmObjEntityComponents = game.ecs.getEntityComponents(realmObj);
  const subObjSids: Sid[] = [];

  const packedObjRealm = packObjRealm(realmObjEntityComponents.get('obj/realm'), game.ecs);
  const packedChunks = packedObjRealm.chunkEntries.map(([_chunkIJ, sid]) => {
    const chunkEntityComponents = game.ecs.getEntityComponents(game.ecs.fromSid(sid));

    updateChunkTextureUrl(chunkEntityComponents, game.realm.rmEditingWhileUpdateChunkTexture);
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
    version: LATEST_REALM_JSON_VERSION,
    packedObjRealm,
    packedChunks,
    packedSubObjs,
  };
}

export const packedSpriteJsonType = ss.object({
  version: ss.number(),
  packedObj: packedObjComponentType,
  packedObjSprite: packedObjSpriteComponentType,
  packedObjWalkable: packedObjWalkableComponentType,
});
export type PackedSpriteJson = ss.Infer<typeof packedSpriteJsonType>;

export function packSprite(objSprite: EntityRef, ecs: GameECS): PackedSpriteJson {
  const objSpriteComponents = ecs.getEntityComponents(objSprite);
  const packedObj = packObj(objSpriteComponents.get('obj'));
  const packedObjSprite = packObjSprite(objSpriteComponents.get('obj/sprite'));
  const packedObjWalkable = packObjWalkable(objSpriteComponents.get('obj/walkable'));

  return {
    version: LATEST_SPRITE_JSON_VERSION,
    packedObj,
    packedObjSprite,
    packedObjWalkable,
  }
}
