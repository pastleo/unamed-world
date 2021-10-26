export interface ObjWalkableComponent {
  speed: number;
  maxClimbRad: number;
}

export type PackedObjSpriteComponent = ObjWalkableComponent;
export function pack(objSpriteComponent: ObjWalkableComponent): PackedObjSpriteComponent {
  return objSpriteComponent;
}
