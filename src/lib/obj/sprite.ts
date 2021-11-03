import * as T from 'typed';
import { GameECS } from '../gameECS';

import { SubObjState, subObjStateType } from '../subObj/subObj';

import { EntityRef } from '../utils/ecs';
import { Vec2, vec2Type, recordType } from '../utils/utils';

export interface ObjSpriteComponent {
  spritesheet: string;
  eightBitStyle?: boolean;
  colRow: Vec2;
  stateAnimations: Record<SubObjState, SpriteStateAnimation>;
  tall: number;
  radius: number;
}

const spriteAnimationType = T.tuple(T.number, T.number);
export type SpriteAnimation = T.Infer<typeof spriteStateAnimationType> & [start: number, end: number];

const spriteStateAnimationType = T.object({
  animations: T.array(spriteAnimationType), // WIP: for different facing directions
  speed: T.number,
});
type SpriteStateAnimation = T.Infer<typeof spriteStateAnimationType>;

export const packedObjSpriteComponentType = T.object({
  spritesheet: T.string,
  eightBitStyle: T.boolean,
  colRow: vec2Type,
  stateAnimations: recordType(subObjStateType, spriteStateAnimationType),
  tall: T.number,
  radius: T.number,
});
export type PackedObjSpriteComponent = T.Infer<typeof packedObjSpriteComponentType> & ObjSpriteComponent;

export function pack(objSpriteComponent: ObjSpriteComponent): PackedObjSpriteComponent {
  return {
    ...objSpriteComponent,
    eightBitStyle: !!objSpriteComponent.eightBitStyle,
  };
}

export function unpack(objEntity: EntityRef, packedObjSprite: PackedObjSpriteComponent, ecs: GameECS) {
  ecs.setComponent(objEntity, 'obj/sprite', packedObjSprite);
}
