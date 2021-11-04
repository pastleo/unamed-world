import * as ss from 'superstruct';

import { Game } from '../game';
import { GameECS, GameEntityComponents } from '../gameECS';
import { requireObjSprite } from '../sprite';

import { Located, getOrCreateChunk, locateOrCreateChunkCell, calcAltitudeAt } from '../chunk/chunk';
import { addOrRefreshSpriteToScene, updateSpritePosition, removeSprite } from './spriteRender';

import { EntityRef, uuidType, entityEqual } from '../utils/ecs';
import { Vec2, Vec3, vec2Type, vec3Type, add, warnIfNotPresent } from '../utils/utils';

export const subObjStateType = ss.union([ss.literal('normal'), ss.literal('walking'), ss.string()]);
export type SubObjState = ss.Infer<typeof subObjStateType>;

export type SubObjEntityComponents = GameEntityComponents;

export interface SubObjComponent {
  obj: EntityRef;
  position: Vec3;
  rotation: Vec3;
  groundAltitude: number;
  state: SubObjState;
  cellIJ: Vec2;
  chunkIJ: Vec2;
}

export function createSubObj(obj: EntityRef, position: Vec3, game: Game, locatedArg?: Located, existingSubObjEntity?: EntityRef): EntityRef {
  const located = locatedArg ?? locateOrCreateChunkCell(position, game);
  if (warnIfNotPresent(located)) return;
  const { cellIJ, chunkIJ } = located;

  const subObjEntity = existingSubObjEntity ?? game.ecs.allocate();
  game.ecs.setComponent(subObjEntity, 'subObj', {
    obj, position, rotation: [0, 0, 0],
    groundAltitude: calcAltitudeAt(position, located, game),
    state: 'normal',
    cellIJ, chunkIJ,
  });

  located.chunk.subObjs.push(subObjEntity);
  addOrRefreshSubObjToScene(subObjEntity, game);

  return subObjEntity;
}

export function addOrRefreshSubObjToScene(subObjEntity: EntityRef, game: Game) {
  requireObjSprite(subObjEntity, game.ecs.getComponent(subObjEntity, 'subObj').obj, game);

  // all possible subObj render systems:
  addOrRefreshSpriteToScene(subObjEntity, game);

  updateSubObjPosition(subObjEntity, game);
}

export function updateSubObjPosition(subObjEntity: EntityRef, game: Game) {
  // all possible subObj render systems:
  updateSpritePosition(subObjEntity, game);
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

export const packedSubObjComponentType = ss.object({
  obj: uuidType,
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
    obj: ecs.getUUID(obj),
    position, rotation, groundAltitude, state, cellIJ, chunkIJ,
  }
}

export function unpack(subObjEntity: EntityRef, packedSubObj: PackedSubObjComponent, ecs: GameECS) {
  const { obj, position, rotation, groundAltitude, state, cellIJ, chunkIJ } = packedSubObj;
  ecs.setComponent(subObjEntity, 'subObj', {
    obj: ecs.fromUUID(obj),
    position, rotation, groundAltitude, state, cellIJ, chunkIJ,
  });
}

function removeFromChunk(subObjEntity: EntityRef, subObj: SubObjComponent, game: Game) {
  const oriChunk = getOrCreateChunk(subObj.chunkIJ, game.realm.currentObj, game.ecs);
  const index = oriChunk.subObjs.findIndex(entity => entityEqual(entity, subObjEntity));
  if (index >= 0) oriChunk.subObjs.splice(index, 1);
}
