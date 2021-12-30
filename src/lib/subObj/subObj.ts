import * as ss from 'superstruct';

import { Game } from '../game';
import { GameECS, GameEntityComponents } from '../gameECS';

import { Located, getOrCreateChunk, locateOrCreateChunkCell, calcAltitudeAt } from '../chunk/chunk';
import { addSpriteToScene, updateSpriteTexture, updateSpritePosition, removeSprite } from './spriteRender';
import { addMeshToScene, updateMeshPosition } from './meshRender';

import { EntityRef, sidType, entityEqual } from '../utils/ecs';
import { Vec2, Vec3, vec2Type, vec3Type, length, add, sub, warnIfNotPresent } from '../utils/utils';

export const subObjStateType = ss.union([ss.literal('normal'), ss.literal('walking'), ss.string()]);
export type SubObjState = ss.Infer<typeof subObjStateType>;

export type SubObjEntityComponents = GameEntityComponents;

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

export function getObjOrBaseComponents(objEntity: EntityRef, ecs: GameECS): GameEntityComponents {
  const objSprite = ecs.getComponent(objEntity, 'obj/sprite');
  if (objSprite) return ecs.getEntityComponents(objEntity);

  return ecs.getEntityComponents(ecs.fromSid('base'));
}

export function createSubObj(obj: EntityRef, position: Vec3, game: Game, locatedArg?: Located, existingSubObjEntity?: EntityRef): EntityRef {
  const located = locatedArg ?? locateOrCreateChunkCell(position, game);
  if (warnIfNotPresent(located)) return;
  const { cellIJ, chunkIJ } = located;

  const subObjEntity = existingSubObjEntity ?? game.ecs.allocate();
  game.ecs.setComponent(subObjEntity, 'subObj', {
    obj, position, rotation: [0, 0, 0],
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
  // all possible subObj render systems:
  addSpriteToScene(subObjEntity, game, refresh);
  addMeshToScene(subObjEntity, game, refresh);

  updateSubObjPosition(subObjEntity, game);
}

export function updateSubObjDisplay(subObjEntity: EntityRef, game: Game) {
  // all possible subObj render systems:
  updateSpriteTexture(subObjEntity, game);
}

export function updateSubObjPosition(subObjEntity: EntityRef, game: Game) {
  // all possible subObj render systems:
  updateSpritePosition(subObjEntity, game);
  updateMeshPosition(subObjEntity, game);
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

export function destroySubObj(subObjEntity: EntityRef, game: Game) {
  const subObj = game.ecs.getComponent(subObjEntity, 'subObj');
  if (!subObj) return;

  removeFromChunk(subObjEntity, subObj, game);

  // all possible subObj render systems:
  removeSprite(subObjEntity, game);

  game.ecs.deallocate(subObjEntity);
}

export function detectCollision(subObjEntity: EntityRef, chunkIJ: Vec2, game: Game, newPosition?: Vec3) {
  const subObj = game.ecs.getEntityComponents(subObjEntity);
  const subObjComponent = subObj.get('subObj');
  const objSprite = game.ecs.getComponent(subObjComponent.obj, 'obj/sprite');
  const position: Vec3 = newPosition || subObjComponent.position;
  const [chunkI, chunkJ] = chunkIJ;

  return [chunkI - 1, chunkI, chunkI + 1].flatMap(ci => (
    [chunkJ - 1, chunkJ, chunkJ + 1].flatMap(cj => (
      getOrCreateChunk([ci, cj], game.realm.currentObj, game.ecs).subObjs
    ))
  )).filter(
    sObjEntity => {
      //const sObjSprite = getObjOrBaseComponents(sObjEntity, game.ecs).get('obj/sprite');
      //return sObjSprite.collision && !entityEqual(sObjEntity, subObj.entity)
      return !entityEqual(sObjEntity, subObj.entity)
    }
  ).filter(
    sObjEntity => {
      const sObj = game.ecs.getComponent(sObjEntity, 'subObj');
      const sObjSprite = getObjOrBaseComponents(sObj.obj, game.ecs).get('obj/sprite');
      return (sObjSprite.radius + objSprite.radius) > length(sub(sObj.position, position))
    }
  );
}

export const packedSubObjComponentType = ss.object({
  obj: sidType,
  position: vec3Type,
  rotation: vec3Type,
  groundAltitude: ss.number(),
  state: subObjStateType,
  cellIJ: vec2Type,
  chunkIJ: vec2Type,
});
export type PackedSubObjComponent = ss.Infer<typeof packedSubObjComponentType>;

export function pack(subObjComponent: SubObjComponent, ecs: GameECS): PackedSubObjComponent {
  const { obj, position, rotation, groundAltitude, state, cellIJ, chunkIJ } = subObjComponent;
  return {
    obj: ecs.getSid(obj),
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
