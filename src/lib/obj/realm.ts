import { GameECS } from '../gameECS';

import { EntityRef, UUID } from '../utils/ecs';
import Map2D, { Map2DEntries } from '../utils/map2d';

import { BASE_REALM_BACKGROUND } from '../consts';

export interface ObjRealmComponent {
  chunks: Map2D<EntityRef>;
  backgrounds: Backgrounds;
}
type Backgrounds = [
  urlPosX: string, urlNegX: string,
  urlPosY: string, urlNegY: string,
  urlPosZ: string, urlPosZ: string
];

export function createBaseRealm(ecs: GameECS): EntityRef {
  const realmObjEntity = ecs.allocate();
  ecs.setComponent(realmObjEntity, 'obj/realm', {
    chunks: new Map2D(),
    backgrounds: BASE_REALM_BACKGROUND,
  });

  return realmObjEntity;
}

export interface PackedObjRealmComponent {
  chunkEntries: Map2DEntries<UUID>;
  backgrounds: Backgrounds;
}

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
