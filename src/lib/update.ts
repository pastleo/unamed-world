import Game from './game';
import { update as updatePlayer } from './player';
import { update as updateInput } from './input';
import { resize as resizeCamera } from './camera';
import { Chunk, SubObj, subObjState } from './obj';
import { setSpriteTexture } from './sprite';
import { Vec2 } from './utils/utils';

export default function update(game: Game, tDiff: number) {
  updatePlayer(game.player, tDiff, game);
  updateInput(game.input, tDiff, game);

  updateSubObjs([game.player.mounting.chunkI, game.player.mounting.chunkJ], game);
}

export function resize(game: Game, width: number, height: number) {
  resizeCamera(width, height, game.camera);
  game.renderer.setSize(width, height);
}

const UPDATE_CHUNK_RANGE = 2;
function updateSubObjs(centerChunkIJ: Vec2, game: Game) {
  [
    [0, 0],
    ...Array(UPDATE_CHUNK_RANGE).fill(null).map((_, i) => i + 1).flatMap(d =>
      Array(d * 2).fill(null).map((_, j) => j - d).flatMap(x => ([
        [x, d], [d, -x], [x + 1, -d], [-d, x],
      ])),
    ),
  ].map(([dChunkI, dChunkJ]) => (
    [centerChunkIJ[0] + dChunkI, centerChunkIJ[1] + dChunkJ]
  )).map(([chunkI, chunkJ]) => (
    [chunkI, chunkJ, game.realm.obj.chunks.get(chunkI, chunkJ)] as [number, number, Chunk]
  )).filter(
    ([_chunkI, _chunkJ, chunk]) => chunk
  ).forEach(([chunkI, chunkJ, chunk]) => {
    updateChunk(chunkI, chunkJ, chunk, game.time);
  })
}

function updateChunk(_chunkI: number, _chunkJ: number, chunk: Chunk, time: number) {
  chunk.subObjs.forEach(subObj => {
    updateSubObj(subObj, time);
  })
}

function updateSubObj(subObj: SubObj, time: number) {
  setSpriteTexture(
    subObj.obj.spriteSheetMaterial, 
    subObj.sprite.material.map,
    subObjState.normal,
    time
  );
}
