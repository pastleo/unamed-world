import type { Game } from '../game';
import type { GameECS, GameEntityComponents } from '../gameECS';
import { requireSpriteForSubObj } from '../resource';
import { getOrBaseSprite } from '../builtInObj';

import { Located, getChunk, getOrCreateChunk, locateOrCreateChunkCell, calcAltitudeAt } from '../chunk/chunk';
import { addSpriteToScene, updateSpriteTexture, updateSpritePosition, removeSprite } from './spriteRender';
import { addModelToScene, updateModelPosition, removeModel } from './modelRender';

import { EntityRef, Sid, entityEqual } from '../utils/ecs';
import { Vec2, Vec3, vec3To2, length, add, sub, rangeVec2s, relativeToRad } from '../utils/utils';

import { EnsureSS, packedSubObjComponentType, subObjStateType } from '../utils/superstructTypes';

export type SubObjEntityComponents = GameEntityComponents;

export type SubObjState = EnsureSS<'normal' | 'walking' | string, typeof subObjStateType>;
export interface SubObjComponent {
  obj: EntityRef;
  position: Vec3;
  rotation: Vec3;
  mounted: boolean;
  groundAltitude: number;
  state: SubObjState;
  cellIJ: Vec2;
  chunkIJ: Vec2;
}

export function createSubObj(obj: EntityRef, position: Vec3, rotation: Vec3, game: Game, locatedArg?: Located, existingSubObjEntity?: EntityRef): EntityRef {
  const located = locatedArg ?? locateOrCreateChunkCell(position, game);
  const { cellIJ, chunkIJ } = located;

  const subObjEntity = existingSubObjEntity ?? game.ecs.allocate();
  game.ecs.setComponent(subObjEntity, 'subObj', {
    obj, position, rotation,
    mounted: false,
    groundAltitude: calcAltitudeAt(position, located, game),
    state: 'normal',
    cellIJ, chunkIJ,
  });

  located.chunk.subObjs.push(subObjEntity);
  addSubObjToScene(subObjEntity, game);

  return subObjEntity;
}

export function addSubObjToScene(subObjEntity: EntityRef, game: Game, refresh: boolean = false) {
  const subObj = game.ecs.getComponent(subObjEntity, 'subObj');
  const obj = game.ecs.getComponent(subObj.obj, 'obj');
  requireSpriteForSubObj(subObjEntity, subObj.obj, game);

  if (obj) {
    // all possible subObj render systems:
    switch (obj.subObjType) {
      case 'sprite':
        addSpriteToScene(subObjEntity, game, refresh);
        break;
      case 'mesh':
        removeSprite(subObjEntity, game);
        addModelToScene(subObjEntity, game, refresh);
        break;
    }
  } else {
    addSpriteToScene(subObjEntity, game, refresh);
  }

  updateSubObjPosition(subObjEntity, game);
}

export function updateSubObjDisplay(subObjEntity: EntityRef, game: Game) {
  // all possible subObj render systems:
  updateSpriteTexture(subObjEntity, game);
}

export function updateSubObjPosition(subObjEntity: EntityRef, game: Game) {
  // all possible subObj render systems:
  updateSpritePosition(subObjEntity, game);
  updateModelPosition(subObjEntity, game);
}

export function moveSubObj(subObjEntity: EntityRef, vec: Vec2, game: Game) {
  const subObj = game.ecs.getComponent(subObjEntity, 'subObj');
  const newPosition = add(subObj.position, [vec[0], 0, vec[1]]);
  const located = locateOrCreateChunkCell(newPosition, game);

  const { cellIJ, chunkIJ, chunk } = located;

  subObj.position = newPosition;
  subObj.groundAltitude = calcAltitudeAt(newPosition, located, game);

  updateSubObjPosition(subObjEntity, game);

  subObj.cellIJ = cellIJ;

  if (chunkIJ[0] !== subObj.chunkIJ[0] || chunkIJ[1] !== subObj.chunkIJ[1]) {
    removeFromChunk(subObjEntity, subObj, game);
    chunk.subObjs.push(subObjEntity);
    subObj.chunkIJ = chunkIJ;
  }
}

export function makeSubObjFacing(location: Vec2, subObjComponent: SubObjComponent) {
  makeSubObjFacingRelative(sub(location, vec3To2(subObjComponent.position)), subObjComponent);
}
export function makeSubObjFacingRelative(to: Vec2, subObjComponent: SubObjComponent) {
  subObjComponent.rotation[1] = relativeToRad(to);
}

export function destroySubObj(subObjEntity: EntityRef, game: Game) {
  const subObj = game.ecs.getComponent(subObjEntity, 'subObj');
  if (!subObj) return;

  removeFromChunk(subObjEntity, subObj, game);

  // all possible subObj render systems:
  removeSprite(subObjEntity, game);
  removeModel(subObjEntity, game);

  game.ecs.deallocate(subObjEntity);
}

export function subObjInChunkRange(chunkIJ: Vec2, chunkRange: number, game: Game): EntityRef[] {
  return rangeVec2s(chunkIJ, chunkRange).map(ij => (
    getChunk(ij, game.realm.currentObj, game.ecs)
  )).filter(chunk => chunk).flatMap(chunk => (
    chunk.subObjs
  ))
}

export function detectCollision(subObjEntity: EntityRef, chunkIJ: Vec2, game: Game, newPosition?: Vec3): EntityRef[] {
  const subObj = game.ecs.getEntityComponents(subObjEntity);
  const subObjComponent = subObj.get('subObj');
  const objSprite = game.ecs.getComponent(subObjComponent.obj, 'obj/sprite');
  const position: Vec3 = newPosition || subObjComponent.position;

  return subObjInChunkRange(chunkIJ, 1, game).filter(
    sObjEntity => {
      //const sObjSprite = getOrBaseSprite(sObjEntity, game.ecs);
      //return sObjSprite.collision && !entityEqual(sObjEntity, subObj.entity)
      return !entityEqual(sObjEntity, subObj.entity)
    }
  ).filter(
    sObjEntity => {
      const sObj = game.ecs.getComponent(sObjEntity, 'subObj');
      const sObjSprite = getOrBaseSprite(sObj.obj, game.ecs);
      return (sObjSprite.radius + objSprite.radius) > length(sub(sObj.position, position))
    }
  );
}

interface PackedSubObjComponentDef {
  obj: Sid;
  position: Vec3;
  rotation: Vec3;
  groundAltitude: number;
  state: SubObjState;
  cellIJ: Vec2;
  chunkIJ: Vec2;
}
export type PackedSubObjComponent = EnsureSS<PackedSubObjComponentDef, typeof packedSubObjComponentType>;

export function pack(subObjComponent: SubObjComponent, ecs: GameECS): PackedSubObjComponent {
  const { obj, position, rotation, groundAltitude, state, cellIJ, chunkIJ } = subObjComponent;
  return {
    obj: ecs.getPrimarySid(obj, true),
    position, rotation, groundAltitude, state, cellIJ, chunkIJ,
  }
}

export function unpack(subObjEntity: EntityRef, packedSubObj: PackedSubObjComponent, ecs: GameECS) {
  const { obj, position, rotation, groundAltitude, state, cellIJ, chunkIJ } = packedSubObj;
  ecs.setComponent(subObjEntity, 'subObj', {
    obj: ecs.fromSid(obj),
    mounted: false,
    position, rotation, groundAltitude, state, cellIJ, chunkIJ,
  });
}

function removeFromChunk(subObjEntity: EntityRef, subObj: SubObjComponent, game: Game) {
  const oriChunk = getOrCreateChunk(subObj.chunkIJ, game.realm.currentObj, game.ecs);
  const index = oriChunk.subObjs.findIndex(entity => entityEqual(entity, subObjEntity));
  if (index >= 0) oriChunk.subObjs.splice(index, 1);
}
