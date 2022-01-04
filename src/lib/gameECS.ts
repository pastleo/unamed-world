import ECS, { EntityComponents } from './utils/ecs';

import type { ObjComponent } from './obj/obj';
import type { ObjRealmComponent } from './obj/realm';
import type { ObjSpriteComponent } from './obj/sprite';
import type { ObjModelComponent } from './obj/model';
import type { ObjWalkableComponent } from './obj/walkable';
import type { ChunkComponent } from './chunk/chunk';
import type { ChunkRenderComponent } from './chunk/render';
import type { ChunkRenderAttributeComponent } from './chunk/renderAttribute';
import type { SubObjComponent } from './subObj/subObj';
import type { SubObjSpriteRenderComponent } from './subObj/spriteRender';
import type { SubObjModelRenderComponent } from './subObj/modelRender';
import type { SubObjWalkingComponent } from './subObj/walking';

interface GameComponentMap {
  'obj': ObjComponent;
  'obj/realm': ObjRealmComponent;
  'obj/sprite': ObjSpriteComponent;
  'obj/model': ObjModelComponent;
  'obj/walkable': ObjWalkableComponent;
  'chunk': ChunkComponent;
  'chunk/render': ChunkRenderComponent;
  'chunk/renderAttribute': ChunkRenderAttributeComponent;
  'subObj': SubObjComponent;
  'subObj/spriteRender': SubObjSpriteRenderComponent;
  'subObj/modelRender': SubObjModelRenderComponent;
  'subObj/walking': SubObjWalkingComponent;
}

export type GameECS = ECS<GameComponentMap>;
export type GameEntityComponents = EntityComponents<GameComponentMap>;

export function init(): GameECS {
  return new ECS();
}
