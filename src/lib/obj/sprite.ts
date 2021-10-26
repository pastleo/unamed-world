import { Vec2 } from '../utils/utils';
import { SubObjState } from '../subObj/subObj';

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
