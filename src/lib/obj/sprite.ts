import * as ss from 'superstruct';
import type { GameECS } from '../gameECS';

import { ObjPath, objPathType } from './obj';
import type { SubObjState } from '../subObj/subObj';

import { EntityRef } from '../utils/ecs';
import { Vec2, vec2Type } from '../utils/utils';

import { InferSSOptional, subObjStateType } from '../utils/superstructTypes';

export interface ObjSpriteComponent {
  spritesheet: string;
  eightBitStyle?: boolean;
  colRow: Vec2;
  stateAnimations: Record<SubObjState, SpriteStateAnimation>;
  tall: number;
  radius: number;
  collision?: boolean;
  srcRealmObjPath?: ObjPath;
}

const spriteAnimationType = ss.tuple([ss.number(), ss.number()]);
export type SpriteAnimation = ss.Infer<typeof spriteAnimationType> & [start: number, end: number];

const spriteStateAnimationType = ss.object({
  animations: ss.array(spriteAnimationType), // WIP: for different facing directions
  speed: ss.number(),
});
type SpriteStateAnimation = ss.Infer<typeof spriteStateAnimationType>;

const packedObjSpriteComponentTypeDef = ss.object({
  spritesheet: ss.string(),
  eightBitStyle: ss.optional(ss.boolean()),
  colRow: vec2Type,
  stateAnimations: ss.record(subObjStateType, spriteStateAnimationType),
  tall: ss.number(),
  radius: ss.number(),
  collision: ss.optional(ss.boolean()),
  srcRealmObjPath: ss.optional(objPathType),
});
export type PackedObjSpriteComponent = InferSSOptional<typeof packedObjSpriteComponentTypeDef, 'eightBitStyle' | 'collision' | 'srcRealmObjPath'>;
export const packedObjSpriteComponentType = packedObjSpriteComponentTypeDef as ss.Struct<PackedObjSpriteComponent>;

export function pack(objSpriteComponent: ObjSpriteComponent): PackedObjSpriteComponent {
  return objSpriteComponent;
}

export function unpack(objEntity: EntityRef, packedObjSprite: PackedObjSpriteComponent, ecs: GameECS) {
  ecs.setComponent(objEntity, 'obj/sprite', packedObjSprite);
}
