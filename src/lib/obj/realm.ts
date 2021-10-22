import { GameECS } from '../gameECS';

import { EntityRef } from '../utils/ecs';
import Map2D from '../utils/map2d';

import { BASE_REALM_BACKGROUND } from '../consts';

export interface ObjRealmComponent {
  chunks: Map2D<EntityRef>;
  backgrounds: [
    urlPosX: string, urlNegX: string,
    urlPosY: string, urlNegY: string,
    urlPosZ: string, urlPosZ: string
  ];
}

export function createBaseRealm(ecs: GameECS): EntityRef {
  const realmObjEntity = ecs.allocate();
  ecs.setComponent(realmObjEntity, 'obj/realm', {
    chunks: new Map2D(),
    backgrounds: BASE_REALM_BACKGROUND,
  });

  return realmObjEntity;
}
