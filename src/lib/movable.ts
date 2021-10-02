import { SubObj, Chunk, locateChunkCell } from './obj';
import Map2D from './utils/map2d';
import { Vec2, add, sub, length, multiply } from './utils/utils';

export function moveLength(
  subObj: SubObj, moveTarget: Vec2, chunks: Map2D<Chunk>, tDiff: number
): number {
  const maxMoveLength = subObj.obj.speed * tDiff * 0.001;
  const moveTargetDistance = length(moveTarget);
  const movingVec = multiply(moveTarget, maxMoveLength / moveTargetDistance);

  const newPosition = add(subObj.position, [...movingVec, 0]);
  const located = locateChunkCell(newPosition[0], newPosition[1], chunks);

  const [_cell, _cellI, _cellJ, _chunk, chunkI, chunkJ] = located;
  const collidedSubObjs = [chunkI - 1, chunkI, chunkI + 1].flatMap(ci => (
    [chunkJ - 1, chunkJ, chunkJ + 1].flatMap(cj => (
      chunks.get(ci, cj)?.subObjs || []
    ))
  )).filter(
    sObj => sObj !== subObj
  ).filter(
    sObj => (sObj.obj.radius + subObj.obj.radius) > length(sub(sObj.position, newPosition))
  );

  if (collidedSubObjs.length) return 0;

  return maxMoveLength;
}
