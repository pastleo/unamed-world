import * as ss from 'superstruct';
import { GameECS } from '../gameECS';

import { SubObjState, subObjStateType } from '../subObj/subObj';

import { EntityRef } from '../utils/ecs';
import { Vec2, vec2Type } from '../utils/utils';

export interface ObjSpriteComponent {
  spritesheet: string;
  eightBitStyle?: boolean;
  colRow: Vec2;
  stateAnimations: Record<SubObjState, SpriteStateAnimation>;
  tall: number;
  radius: number;
  collision: boolean;
}

const spriteAnimationType = ss.tuple([ss.number(), ss.number()]);
export type SpriteAnimation = ss.Infer<typeof spriteAnimationType> & [start: number, end: number];

const spriteStateAnimationType = ss.object({
  animations: ss.array(spriteAnimationType), // WIP: for different facing directions
  speed: ss.number(),
});
type SpriteStateAnimation = ss.Infer<typeof spriteStateAnimationType>;

export const packedObjSpriteComponentType = ss.object({
  spritesheet: ss.string(),
  eightBitStyle: ss.optional(ss.boolean()),
  colRow: vec2Type,
  stateAnimations: ss.record(subObjStateType, spriteStateAnimationType),
  tall: ss.number(),
  radius: ss.number(),
}) as ss.Struct<ObjSpriteComponent>; // If you are not using TypeScript's strictNullChecks option, Superstruct will be unable to infer your "optional" types correctly and will mark all types as optional.
// from https://docs.superstructjs.org/guides/06-using-typescript
export type PackedObjSpriteComponent = ss.Infer<typeof packedObjSpriteComponentType>;

export function pack(objSpriteComponent: ObjSpriteComponent): PackedObjSpriteComponent {
  return objSpriteComponent;
}

export function unpack(objEntity: EntityRef, packedObjSprite: PackedObjSpriteComponent, ecs: GameECS) {
  ecs.setComponent(objEntity, 'obj/sprite', packedObjSprite);
}
