import { GameECS, GameEntityComponents } from '../gameECS';

import { EntityRef } from '../utils/ecs';

export type ObjEntityComponents = GameEntityComponents;

export interface ObjComponent {}

export function createObjEntity(ecs: GameECS, sid?: string): EntityRef {
  const objEntity = ecs.fromSid(sid);
  ecs.setComponent(objEntity, 'obj', {});
  return objEntity;
}

export function getObjEntity(sid: string, ecs: GameECS): EntityRef {
  return ecs.fromSid(sid);
}
