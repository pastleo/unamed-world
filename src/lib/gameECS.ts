import ECS, { EntityComponents } from './utils/ecs';

import { ObjComponent } from './obj/obj';
import { ObjRealmComponent } from './obj/realm';
import { ObjSpriteComponent } from './obj/sprite';
import { ObjWalkableComponent } from './obj/walkable';
import { ChunkComponent } from './chunk/chunk';
import { ChunkRenderComponent } from './chunk/render';
import { ChunkRenderAttributeComponent } from './chunk/renderAttribute';
import { SubObjComponent } from './subObj/subObj';
import { SubObjSpriteRenderComponent } from './subObj/spriteRender';
import { SubObjWalkingComponent } from './subObj/walking';

interface GameComponentMap {
  'obj': ObjComponent;
  'obj/realm': ObjRealmComponent;
  'obj/sprite': ObjSpriteComponent;
  'obj/walkable': ObjWalkableComponent;
  'chunk': ChunkComponent;
  'chunk/render': ChunkRenderComponent;
  'chunk/renderAttribute': ChunkRenderAttributeComponent;
  'subObj': SubObjComponent;
  'subObj/spriteRender': SubObjSpriteRenderComponent;
  'subObj/walking': SubObjWalkingComponent;
}

export type GameECS = ECS<GameComponentMap>;
export type GameEntityComponents = EntityComponents<GameComponentMap>;

export function init(): GameECS {
  return new ECS();
}
