import * as ss from 'superstruct';
import { GameECS, GameEntityComponents } from '../gameECS';

import { EntityRef, sidType } from '../utils/ecs';

export type ObjEntityComponents = GameEntityComponents;

export interface ObjComponent {}

export const objPathType = ss.union([sidType, ss.string()]);
/**
 * localForage: /local/xxx
 * IPFS: /ipfs/xxx
 * devObj: /xxx
 */
export type ObjPath = ss.Infer<typeof objPathType>;

export function createObjEntity(ecs: GameECS, objPath: ObjPath): EntityRef {
  const objEntity = ecs.fromSid(objPath);
  ecs.setComponent(objEntity, 'obj', {});
  return objEntity;
}

export function getObjEntity(objPath: ObjPath, ecs: GameECS): EntityRef {
  return ecs.fromSid(objPath);
}

export function getObjPath(objEntity: EntityRef, ecs: GameECS): ObjPath {
  return ecs.getSid(objEntity);
}
