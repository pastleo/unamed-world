import { GameECS, GameEntityComponents } from '../gameECS';

import { EntityRef, Sid } from '../utils/ecs';

export type ObjEntityComponents = GameEntityComponents;

export interface ObjComponent {}

/**
 * localForage: /local/xxx
 * IPFS: /ipfs/xxx
 * devObj: /xxx
 */
export type ObjPath = string & Sid;

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
