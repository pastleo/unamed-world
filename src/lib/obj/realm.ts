import * as ss from 'superstruct';
import { GameECS } from '../gameECS';

import { EntityRef, sidType } from '../utils/ecs';
import Map2D, { map2DEntriesType } from '../utils/map2d';

import { BASE_REALM_BACKGROUND } from '../consts';

export interface ObjRealmComponent {
  chunks: Map2D<EntityRef>;
  backgrounds: Backgrounds;
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

export const packedObjRealmComponentType = ss.object({
  chunkEntries: map2DEntriesType(sidType),
  backgrounds: backgroundsType,
});
export type PackedObjRealmComponent = ss.Infer<typeof packedObjRealmComponentType>;

export function pack(objRealm: ObjRealmComponent, ecs: GameECS): PackedObjRealmComponent {
  const { backgrounds } = objRealm;
  return {
    chunkEntries: objRealm.chunks.entries().filter(([_, chunkEntity]) => {
      const chunk = ecs.getComponent(chunkEntity, 'chunk');
      return chunk.persistance || chunk.subObjs.length > 0
    }).map(([chunkIJ, chunkEntity]) => ([
      chunkIJ, ecs.getSid(chunkEntity),
    ])),
    backgrounds,
  }
}

export function unpack(objRealmEntity: EntityRef, packedObjRealm: PackedObjRealmComponent, ecs: GameECS) {
  ecs.setComponent(objRealmEntity, 'obj/realm', {
    chunks: Map2D.fromEntries(packedObjRealm.chunkEntries.map(([chunkIJ, sid]) => (
      [chunkIJ, ecs.fromSid(sid)]
    ))),
    backgrounds: packedObjRealm.backgrounds,
  });
}
