import { GameECS } from '../gameECS';

import { SubObjState } from '../subObj/subObj';

import { EntityRef } from '../utils/ecs';
import { Vec2 } from '../utils/utils';

export interface ObjSpriteComponent {
  spritesheet: string;
  eightBitStyle?: boolean;
  colRow: Vec2;
  stateAnimations: Record<SubObjState, SpriteStateAnimation>;
  tall: number;
  radius: number
}

type SpriteAnimation = [start: number, end: number];
export interface SpriteStateAnimation {
  animations: SpriteAnimation[]; // WIP: for different facing directions
  speed: number;
}

export type PackedObjSpriteComponent = ObjSpriteComponent;
export function pack(objSpriteComponent: ObjSpriteComponent): PackedObjSpriteComponent {
  return objSpriteComponent;
}

export function unpack(objEntity: EntityRef, packedObjSprite: PackedObjSpriteComponent, ecs: GameECS) {
  ecs.setComponent(objEntity, 'obj/sprite', packedObjSprite);
}
