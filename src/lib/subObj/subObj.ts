import { Game } from '../game';
import { Located, getChunk, locateChunkCell, calcAltitudeAt } from '../chunk/chunk';
import { initSprite, updateSpritePosition } from './spriteRender';

import { EntityRef, entityEqual } from '../utils/ecs';
import { Vec2, Vec3, add, warnIfNotPresent } from '../utils/utils';

export type SubObjState = 'normal' | 'walking' | string;

export interface SubObjComponent {
  obj: EntityRef;
  position: Vec3;
  rotation: Vec3;
  groundAltitude: number;
  state: SubObjState;
  cellIJ: Vec2;
  chunkIJ: Vec2;
}

export function addSubObj(obj: EntityRef, position: Vec3, game: Game, locatedArg?: Located, existingSubObjEntity?: EntityRef): EntityRef {
  const located = locatedArg ?? locateChunkCell(position, game);
  if (warnIfNotPresent(located)) return;
  const { cellIJ, chunkIJ } = located;

  const subObjEntity = existingSubObjEntity ?? game.ecs.allocate();
  game.ecs.setComponent(subObjEntity, 'subObj', {
    obj, position, rotation: [0, 0, 0],
    groundAltitude: calcAltitudeAt(position, located, game),
    state: 'normal',
    cellIJ, chunkIJ,
  });

  // all possible subObj render systems:
  initSprite(subObjEntity, game);

  located.chunk.subObjs.push(subObjEntity);

  return subObjEntity;
}

export function moveSubObj(subObjEntity: EntityRef, vec: Vec2, game: Game) {
  const subObj = game.ecs.getComponent(subObjEntity, 'subObj');
  const newPosition = add(subObj.position, [vec[0], 0, vec[1]]);
  const located = locateChunkCell(newPosition, game);

  const { cellIJ, chunkIJ, chunk } = located;

  subObj.position = newPosition;

  // all possible subObj render systems:
  subObj.groundAltitude = calcAltitudeAt(newPosition, located, game);
  updateSpritePosition(subObjEntity, game);

  subObj.cellIJ = cellIJ;

  if (chunkIJ[0] !== subObj.chunkIJ[0] || chunkIJ[1] !== subObj.chunkIJ[1]) {
    const oriChunk = getChunk(subObj.chunkIJ, game.realm.currentObj, game.ecs);
    const index = oriChunk.subObjs.findIndex(entity => entityEqual(entity, subObjEntity));
    oriChunk.subObjs.splice(index, 1);
    chunk.subObjs.push(subObjEntity);
    subObj.chunkIJ = chunkIJ;
  }
}
