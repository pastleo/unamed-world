import type { Game } from './game';
import { ChunkComponent, getChunk } from './chunk/chunk';
import { updateSubObjDisplay } from './subObj/subObj';
import { update as updatePlayer, jumpOnRealm, jumpOffRealm } from './player';
import { update as updateInput } from './input';
import { update as updateCamera, resize as resizeCamera } from './camera';
import { update as updateWalking } from './subObj/walking';
import { switchRealm } from './realm';
import { fetchObjJson, importRealm } from './resource';
import { join, reqRealm, unpauseProcessingRuntimeMessages } from './network';
import { clearStack } from './zoom';

import type { ObjPath } from './obj/obj';

import { EntityRef } from './utils/ecs';
import { Vec2, vec2To3, rangeVec2s } from './utils/utils';
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

export async function updateBrowsing(game: Game) {
  const realmObjPath = parseUrlHash()[''];
  if (!realmObjPath) return;

  clearStack(game);
  await changeRealm(realmObjPath, game);
}

export async function changeRealm(realmObjPath: ObjPath, game: Game, tmpRealmObjPath?: ObjPath, location?: Vec2): Promise<boolean> {
  const realmObjPathSrc = tmpRealmObjPath || realmObjPath;
  const realmObjPathAlias = realmObjPath || tmpRealmObjPath;

  const joinPromise = join(realmObjPathAlias, game, location ? vec2To3(location) : null);

  const fetchedJson = await fetchObjJson(realmObjPathSrc, game, '-realm');

  let ok = await importAndSwitchRealmIfValid(realmObjPathAlias, fetchedJson, game, location);

  const memberExists = await joinPromise;
  if (memberExists) {
    const jsonFromPeer = await reqRealm(game);
    ok ||= await importAndSwitchRealmIfValid(realmObjPathAlias, jsonFromPeer, game, location);
  }

  unpauseProcessingRuntimeMessages(game, joinPromise);

  if (ok) return true;
  console.warn('changeRealm: failed', {
    realmObjPath, tmpRealmObjPath, realmObjPathSrc, realmObjPathAlias,
  });
  return false;
}

async function importAndSwitchRealmIfValid(realmObjPathAlias: ObjPath, json: any, game: Game, location?: Vec2): Promise<boolean> {
  if (!json) return false;

  const jsonValidated = await importRealm(realmObjPathAlias, json);
  if (!jsonValidated) return false;

  jumpOffRealm(game);
  switchRealm(realmObjPathAlias, jsonValidated, game);
  jumpOnRealm(game, location);

  return true;
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
  updateSubObjDisplay(subObj, game);
}
