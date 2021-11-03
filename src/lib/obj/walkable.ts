import * as T from 'typed';
import { GameECS } from '../gameECS';

import { EntityRef } from '../utils/ecs';

export interface ObjWalkableComponent {
  speed: number;
  maxClimbRad: number;
}

export const packedObjWalkableComponentType = T.object({
  speed: T.number,
  maxClimbRad: T.number,
});
export type PackedObjWalkableComponent = T.Infer<typeof packedObjWalkableComponentType> & ObjWalkableComponent;

export function pack(objSpriteComponent: ObjWalkableComponent): PackedObjWalkableComponent {
  return objSpriteComponent;
}

export function unpack(objEntity: EntityRef, packedObjSprite: PackedObjWalkableComponent, ecs: GameECS) {
  ecs.setComponent(objEntity, 'obj/walkable', packedObjSprite);
}
