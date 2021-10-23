import { GameECS, GameEntityComponents } from '../gameECS';

import { EntityRef } from '../utils/ecs';

export type ObjEntityComponents = GameEntityComponents;

export interface ObjComponent {
  id: string
}

const objs: Record<string, EntityRef> = {};
export function createObj(id: string, ecs: GameECS): EntityRef {
  const objEntity = ecs.allocate();
  ecs.setComponent(objEntity, 'obj', { id });
  objs[id] = objEntity;

  return objEntity;
}

export function getObjEntity(id: string): EntityRef {
  return objs[id]
}
