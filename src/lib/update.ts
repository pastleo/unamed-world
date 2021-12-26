import { Game } from './game';
import { ChunkComponent, getChunk } from './chunk/chunk';
import { updateSpriteTexture } from './subObj/spriteRender';
import { update as updatePlayer } from './player';
import { update as updateInput } from './input';
import { update as updateCamera, resize as resizeCamera } from './camera';
import { update as updateWalking } from './subObj/walking';
import { switchRealm } from './realm';
import { jumpOnRealm, jumpOffRealm } from './player';
import { fetchObjJson, importRealm } from './storage';
import { join, reqRealm, unpauseProcessingRuntimeMessages } from './network';

import { EntityRef } from './utils/ecs';
import { Vec2, rangeVec2s } from './utils/utils';
import { parseUrlHash } from './utils/web';

export default function update(game: Game, tDiff: number) {
  updateInput(game.input, tDiff, game);

  updateChunks(game.player.chunkIJ, tDiff, game);
  updatePlayer(tDiff, game);
  updateCamera(tDiff, game);
}

export function resize(game: Game, width: number, height: number) {
  resizeCamera(width, height, game.camera);
  game.renderer.setSize(width, height);
}

export async function changeRealm(game: Game) {
  const realmObjPath = parseUrlHash()[''];
  if (!realmObjPath) return

  const memberExists = await join(realmObjPath, game);

  let json = await fetchObjJson(realmObjPath, game, '-realm');

  if (!json && memberExists) {
    json = await reqRealm(game);
  }

  const jsonValidated = await importRealm(realmObjPath, json);
  if (!jsonValidated) {
    return console.warn(`changeRealm: fetchRealm '${realmObjPath}' failed`);
  };

  jumpOffRealm(game);
  switchRealm(realmObjPath, jsonValidated, game);
  jumpOnRealm(game);

  unpauseProcessingRuntimeMessages(game);
}

const UPDATE_CHUNK_RANGE = 2;
function updateChunks(centerChunkIJ: Vec2, tDiff: number, game: Game) {
  rangeVec2s(centerChunkIJ, UPDATE_CHUNK_RANGE).map(chunkIJ => (
    [chunkIJ, getChunk(chunkIJ, game.realm.currentObj, game.ecs)] as [Vec2, ChunkComponent]
  )).forEach(([chunkIJ, chunk]) => {
    updateChunk(chunkIJ, chunk, tDiff, game);
  })
}

function updateChunk(_chunkIJ: Vec2, chunk: ChunkComponent, tDiff: number, game: Game) {
  if (!chunk) return;
  chunk.subObjs.forEach(subObj => {
    updateSubObj(subObj, tDiff, game);
  })
}

function updateSubObj(subObj: EntityRef, tDiff: number, game: Game) {
  updateWalking(subObj, tDiff, game);
  updateSpriteTexture(subObj, game);
}
