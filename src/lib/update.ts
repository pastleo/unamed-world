import Game from './game';
import { update as updatePlayer } from './player';
import { update as updateInput } from './input';
import { resize as resizeCamera } from './camera';
import { Chunk, SubObj } from './obj';
import { setSpriteTexture } from './sprite';
import { Vec2, rangeVec2s } from './utils/utils';

export default function update(game: Game, tDiff: number) {
  updateInput(game.input, tDiff, game);

  updateSubObjs([game.player.mounting.chunkI, game.player.mounting.chunkJ], game);
  updatePlayer(game.player, tDiff, game);
}

export function resize(game: Game, width: number, height: number) {
  resizeCamera(width, height, game.camera);
  game.renderer.setSize(width, height);
}

const UPDATE_CHUNK_RANGE = 2;
function updateSubObjs(centerChunkIJ: Vec2, game: Game) {
  rangeVec2s(centerChunkIJ, UPDATE_CHUNK_RANGE).map(([chunkI, chunkJ]) => (
    [chunkI, chunkJ, game.realm.obj.chunks.get(chunkI, chunkJ)] as [number, number, Chunk]
  )).filter(
    ([_chunkI, _chunkJ, chunk]) => chunk
  ).forEach(([chunkI, chunkJ, chunk]) => {
    updateChunk(chunkI, chunkJ, chunk, game);
  })
}

function updateChunk(_chunkI: number, _chunkJ: number, chunk: Chunk, game: Game) {
  chunk.subObjs.forEach(subObj => {
    updateSubObj(subObj, game);
  })
}

function updateSubObj(subObj: SubObj, game: Game) {
  setSpriteTexture(
    subObj.obj.spriteSheetMaterial, 
    subObj.sprite.material.map,
    subObj,
    game,
  );
}
