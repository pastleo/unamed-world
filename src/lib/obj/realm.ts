import * as ss from 'superstruct';
import type { GameECS } from '../gameECS';

import { EntityRef, sidType } from '../utils/ecs';
import { Vec2, vec2Type } from '../utils/utils';
import Map2D, { map2DEntriesType } from '../utils/map2d';

import type { InferSSOptional } from '../utils/superstructTypes';

import { BASE_REALM_BACKGROUND } from '../consts';

export interface ObjRealmComponent {
  chunks: Map2D<EntityRef>;
  backgrounds: Backgrounds;
  spawnLocation?: Vec2;
}

const backgroundsType = ss.tuple([
  ss.string(), ss.string(), ss.string(),
  ss.string(), ss.string(), ss.string(),
]);
type Backgrounds = [
  urlPosX: string, urlNegX: string,
  urlPosY: string, urlNegY: string,
  urlPosZ: string, urlPosZ: string
] & ss.Infer<typeof backgroundsType>;

export function createBaseRealm(ecs: GameECS): EntityRef {
  const realmObjEntity = ecs.allocate();
  ecs.setComponent(realmObjEntity, 'obj/realm', {
    chunks: new Map2D(),
    backgrounds: BASE_REALM_BACKGROUND,
  });

  return realmObjEntity;
}

const packedObjRealmComponentTypeDef = ss.object({
  chunkEntries: map2DEntriesType(sidType),
  backgrounds: backgroundsType,
  spawnLocation: ss.optional(vec2Type),
});
export type PackedObjRealmComponent = InferSSOptional<typeof packedObjRealmComponentTypeDef, 'spawnLocation'>
export const packedObjRealmComponentType = packedObjRealmComponentTypeDef as ss.Struct<PackedObjRealmComponent>;


export function pack(objRealm: ObjRealmComponent, ecs: GameECS): PackedObjRealmComponent {
  const { backgrounds, spawnLocation } = objRealm;
  return {
    chunkEntries: objRealm.chunks.entries().filter(([_, chunkEntity]) => {
      const chunk = ecs.getComponent(chunkEntity, 'chunk');
      return chunk.persistance || chunk.subObjs.length > 0
    }).map(([chunkIJ, chunkEntity]) => ([
      chunkIJ, ecs.addSid(chunkEntity),
    ])),
    backgrounds,
    spawnLocation,
  }
}

export function unpack(objRealmEntity: EntityRef, packedObjRealm: PackedObjRealmComponent, ecs: GameECS) {
  ecs.setComponent(objRealmEntity, 'obj/realm', {
    chunks: Map2D.fromEntries(packedObjRealm.chunkEntries.map(([chunkIJ, sid]) => (
      [chunkIJ, ecs.fromSid(sid)]
    ))),
    backgrounds: packedObjRealm.backgrounds,
    spawnLocation: packedObjRealm.spawnLocation || [0, 0],
  });
}
