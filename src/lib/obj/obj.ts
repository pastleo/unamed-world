import * as ss from 'superstruct';
import { GameECS, GameEntityComponents } from '../gameECS';

import { EntityRef, sidType } from '../utils/ecs';

export type ObjEntityComponents = GameEntityComponents;

export const subObjTypeType = ss.union([ss.literal('sprite'), ss.literal('mesh')]);
type SubObjType = ss.Infer<typeof subObjTypeType>;

export interface ObjComponent {
  subObjType: SubObjType;
}

export const objPathType = ss.union([sidType, ss.string()]);
/**
 * localForage: /local/xxx
 * IPFS: /ipfs/xxx
 * devObj: /xxx
 */
export type ObjPath = ss.Infer<typeof objPathType>;

export function createObjEntity(ecs: GameECS, objPath: ObjPath, subObjType: SubObjType): EntityRef {
  const objEntity = ecs.fromSid(objPath);
  ecs.setComponent(objEntity, 'obj', { subObjType });
  return objEntity;
}

export function getOrBaseObjEntityComponents(objEntity: EntityRef, ecs: GameECS): GameEntityComponents {
  const obj = ecs.getComponent(objEntity, 'obj');
  if (obj) return ecs.getEntityComponents(objEntity);

  return ecs.getEntityComponents(ecs.fromSid('base'));
}

export function getObjEntity(objPath: ObjPath, ecs: GameECS): EntityRef {
  return ecs.fromSid(objPath);
}

export function getObjPath(objEntity: EntityRef, ecs: GameECS, assertExist: boolean = true): ObjPath | null {
  return ecs.getPrimarySid(objEntity, assertExist);
}

export const packedObjComponentType = ss.object({
  subObjType: subObjTypeType,
});
export type PackedObjComponent = ss.Infer<typeof packedObjComponentType>;

export function pack(objComponent: ObjComponent): PackedObjComponent {
  return objComponent;
}

export function unpack(objEntity: EntityRef, packedObj: PackedObjComponent, ecs: GameECS) {
  ecs.setComponent(objEntity, 'obj', packedObj);
}
