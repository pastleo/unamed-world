import type { Game } from './game';
import { changeRealm } from './update';
import { exportRealm, requireSprite, hasObjJsonLocally } from './resource';
import { syncLocationToRealmSpawnLocation, getPlayerLocation } from './player';
import { ensureStarted as ensureObjBuilderStarted } from './objBuilder';
import { dispatchAddSubObjAction, dispatchReplaceSubObjActions } from './action';
import { cameraRotationY, setCameraLocation, castCameraZoomAnimation } from './camera';

import type { ObjPath } from './obj/obj';
import { createBaseRealm } from './obj/realm';
import { getOrCreateChunk } from './chunk/chunk';
import { subObjInChunkRange } from './subObj/subObj';

import { Sid, EntityRef, entityEqual } from './utils/ecs';
import { Vec2, vec3To2, vec2To3, sub, length, timeoutPromise } from './utils/utils';

const MAX_DIST_TO_ZOOM_IN_SUBOBJ = 1;

export interface RealmStackLevel {
  realmObjAlias: ObjPath;
  cachedRealmObj: ObjPath;
  possibleSubObjSids: Sid[];
  location: Vec2;
}

function mayZoom(zoom: undefined | 'in' | 'out', game: Game) {
  if (zoom === 'in') zoomInRealm(game);
  else if (zoom === 'out') zoomOutRealm(game);
}

export function clearStack(game: Game) {
  game.realm.stack = [];
}

export default mayZoom;

async function zoomInRealm(game: Game) {
  const objBuilderStarted = ensureObjBuilderStarted(game);

  const cameraLocation = vec3To2(game.camera.position);
  let zoomIntoSubObj: EntityRef, currentDistToSubObj = Infinity;
  subObjInChunkRange(game.player.chunkIJ, 1, game).filter(subObjEntity => (
    !entityEqual(subObjEntity, game.player.subObjEntity)
  )).forEach(subObjEntity => {
    const { position, obj } = game.ecs.getComponent(subObjEntity, 'subObj');
    const subObjLocation = vec3To2(position);
    const distToSubObj = length(sub(subObjLocation, cameraLocation));
    if (
      distToSubObj < MAX_DIST_TO_ZOOM_IN_SUBOBJ && distToSubObj < currentDistToSubObj &&
      game.ecs.getComponent(obj, 'obj/sprite')
    ) {
      zoomIntoSubObj = subObjEntity;
      currentDistToSubObj = distToSubObj;
    }
  });

  const message = zoomIntoSubObj ? 'Entering...' : 'Creating...';
  const success = await game.ui.modal.pleaseWait(message, async () => {
    const minWait = timeoutPromise(1500);

    if (zoomIntoSubObj) {
      setCameraLocation(
        vec3To2(game.ecs.getComponent(zoomIntoSubObj, 'subObj').position), game,
      );
    } else {
      const newInnerRealm = createBaseRealm(game.ecs);
      getOrCreateChunk([0, 0], newInnerRealm, game.ecs);
      const newInnerRealmPath = await exportRealm('local', game, newInnerRealm);
      await objBuilderStarted;
      const spriteObjPath = await game.objBuilder.worker.buildSpriteFromRealm(newInnerRealmPath);
      await requireSprite(spriteObjPath, game);

      zoomIntoSubObj = dispatchAddSubObjAction(
        spriteObjPath,
        vec2To3(vec3To2(game.camera.position)), 
        [0, cameraRotationY(game.camera), 0],
        game,
      );
    }

    const cachedRealmObj = await exportRealm('local', game);
    if (!cachedRealmObj) return false;

    const newStack: RealmStackLevel = {
      realmObjAlias: game.ecs.getPrimarySid(game.realm.currentObj),
      cachedRealmObj,
      possibleSubObjSids: game.ecs.getAllSids(zoomIntoSubObj),
      location: getPlayerLocation(game),
    }

    const zoomIntoObj = game.ecs.getComponent(zoomIntoSubObj, 'subObj').obj;
    const zoomIntoObjPath = game.ecs.getComponent(zoomIntoObj, 'obj/sprite').srcRealmObjPath;

    if (!(await hasObjJsonLocally(zoomIntoObjPath))) return false;

    await minWait;
    const realmChanged = await changeRealm(zoomIntoObjPath, game);
    if (realmChanged) {
      castCameraZoomAnimation('in', game);
      game.realm.stack.push(newStack);
      return true;
    }

    return false;
  });

  if (!success) {
    castCameraZoomAnimation(null, game);
    game.ui.modal.alert('failed. this sprite may not have a realm related.');
  }
}

async function zoomOutRealm(game: Game) {
  const objBuilderStarted = ensureObjBuilderStarted(game);

  if (game.realm.stack.length <= 0) {
    await game.ui.modal.alert('You did not zoom into any sprites.');
    return castCameraZoomAnimation(null, game);
  }

  const success = await game.ui.modal.pleaseWait('Exiting...', async () => {
    const minWait = timeoutPromise(1500);

    syncLocationToRealmSpawnLocation(game);
    const realmObjPath = await exportRealm('local', game);
    if (!realmObjPath) return false;

    await objBuilderStarted;
    const spriteObjPath = await game.objBuilder.worker.buildSpriteFromRealm(realmObjPath);

    const popedLevel = game.realm.stack.pop();

    await minWait;
    await changeRealm(popedLevel.realmObjAlias, game, popedLevel.cachedRealmObj, popedLevel.location);

    const subObjEntity = popedLevel.possibleSubObjSids.map(sid => game.ecs.fromSid(sid)).find(entity => game.ecs.getComponent(entity, 'subObj'));
    if (subObjEntity) {
      dispatchReplaceSubObjActions(subObjEntity, spriteObjPath, game);
    }

    castCameraZoomAnimation('out', game);
    return true;
  });

  if (!success) {
    castCameraZoomAnimation(null, game);
    game.ui.modal.alert('oops. something went wrong...');
  }
}
