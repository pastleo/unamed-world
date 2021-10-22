import { GameECS } from '../gameECS';

import { EntityRef } from '../utils/ecs';

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
