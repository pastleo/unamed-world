import * as T from 'typed';

import { GameECS } from '../gameECS';

import { EntityRef, uuidType } from '../utils/ecs';
import Map2D, { map2DEntriesType } from '../utils/map2d';

import { BASE_REALM_BACKGROUND } from '../consts';

export interface ObjRealmComponent {
  chunks: Map2D<EntityRef>;
  backgrounds: Backgrounds;
}

const backgroundsType = T.tuple(
  T.string, T.string, T.string,
  T.string, T.string, T.string,
);
type Backgrounds = [
  urlPosX: string, urlNegX: string,
  urlPosY: string, urlNegY: string,
  urlPosZ: string, urlPosZ: string
] & T.Infer<typeof backgroundsType>;

export function createBaseRealm(ecs: GameECS): EntityRef {
  const realmObjEntity = ecs.allocate();
  ecs.setComponent(realmObjEntity, 'obj/realm', {
    chunks: new Map2D(),
    backgrounds: BASE_REALM_BACKGROUND,
  });

  return realmObjEntity;
}

export const packedObjRealmComponentType = T.object({
  chunkEntries: map2DEntriesType(uuidType),
  backgrounds: backgroundsType,
});
export type PackedObjRealmComponent = T.Infer<typeof packedObjRealmComponentType>;

export function pack(objRealm: ObjRealmComponent, ecs: GameECS): PackedObjRealmComponent {
  const { backgrounds } = objRealm;
  return {
    chunkEntries: objRealm.chunks.entries().filter(([_, chunkEntity]) => {
      const chunk = ecs.getComponent(chunkEntity, 'chunk');
      return chunk.persistance || chunk.subObjs.length > 0
    }).map(([chunkIJ, chunkEntity]) => ([
      chunkIJ, ecs.getUUID(chunkEntity),
    ])),
    backgrounds,
  }
}

export function unpack(objRealmEntity: EntityRef, packedObjRealm: PackedObjRealmComponent, ecs: GameECS) {
  ecs.setComponent(objRealmEntity, 'obj/realm', {
    chunks: Map2D.fromEntries(packedObjRealm.chunkEntries.map(([chunkIJ, UUID]) => (
      [chunkIJ, ecs.fromUUID(UUID)]
    ))),
    backgrounds: packedObjRealm.backgrounds,
  });
}
