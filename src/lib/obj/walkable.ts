import * as ss from 'superstruct';
import { GameECS } from '../gameECS';

import { EntityRef } from '../utils/ecs';

export interface ObjWalkableComponent {
  speed: number;
  maxClimbRad: number;
}

export const packedObjWalkableComponentType = ss.object({
  speed: ss.number(),
  maxClimbRad: ss.number(),
});
export type PackedObjWalkableComponent = ss.Infer<typeof packedObjWalkableComponentType> & ObjWalkableComponent;

export function pack(objSpriteComponent: ObjWalkableComponent): PackedObjWalkableComponent {
  return objSpriteComponent;
}

export function unpack(objEntity: EntityRef, packedObjSprite: PackedObjWalkableComponent, ecs: GameECS) {
  ecs.setComponent(objEntity, 'obj/walkable', packedObjSprite);
}
