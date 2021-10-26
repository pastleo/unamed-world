import { GameECS, GameEntityComponents } from '../gameECS';

import { EntityRef } from '../utils/ecs';

export type ObjEntityComponents = GameEntityComponents;

export interface ObjComponent {}

export function createObjEntity(ecs: GameECS, uuid?: string): EntityRef {
  const objEntity = ecs.fromUUID(uuid);
  ecs.setComponent(objEntity, 'obj', {});
  return objEntity;
}

export function getObjEntity(uuid: string, ecs: GameECS): EntityRef {
  return ecs.fromUUID(uuid);
}
