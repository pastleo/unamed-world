import ECS from './utils/ecs';

import { ObjComponent } from './obj/obj';
import { ObjRealmComponent } from './obj/realm';
import { ObjSpriteComponent } from './obj/sprite';
import { ObjWalkableComponent } from './obj/walkable';
import { ChunkComponent } from './chunk/chunk';
import { ChunkRenderComponent } from './chunk/render';
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
  'subObj': SubObjComponent;
  'subObj/spriteRender': SubObjSpriteRenderComponent;
  'subObj/walking': SubObjWalkingComponent;
}

export type GameECS = ECS<GameComponentMap>;

export function init(): GameECS {
  return new ECS();
}
