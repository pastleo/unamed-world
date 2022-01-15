import type { Game } from './game';
import { changeRealm } from './update';
import { exportRealm, requireSprite } from './resource';
import { syncLocationToRealmSpawnLocation } from './player';
import { ensureStarted as ensureObjBuilderStarted } from './objBuilder';
import { dispatchAddSubObjAction, dispatchReplaceSubObjActions } from './action';
import { cameraRotationY, setCameraLocation, castCameraZoomAnimation } from './camera';

import { createBaseRealm } from './obj/realm';
import { getOrCreateChunk, locateCellIJ } from './chunk/chunk';
import { subObjInChunkRange } from './subObj/subObj';

import { EntityRef, entityEqual } from './utils/ecs';
import { Vec2, Vec3, vec3To2, vec2To3, sub, length, timeoutPromise } from './utils/utils';

const MAX_DIST_TO_ZOOM_IN_SUBOBJ = 1;

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

    syncLocationToRealmSpawnLocation(game);
    const realmObjPath = await exportRealm('local', game);
    if (!realmObjPath) return false;

    game.realm.stack.push({
      realmObj: realmObjPath,
      possibleSubObjSids: game.ecs.getAllSids(zoomIntoSubObj),
    });

    const zoomIntoObj = game.ecs.getComponent(zoomIntoSubObj, 'subObj').obj;
    const zoomIntoObjPath = game.ecs.getComponent(zoomIntoObj, 'obj/sprite').srcRealmObjPath;

    await minWait;
    await changeRealm(zoomIntoObjPath, game);

    castCameraZoomAnimation('in', game);
    return true;
  });

  if (!success) {
    game.ui.modal.alert('failed');
  }
}

async function zoomOutRealm(game: Game) {
  const objBuilderStarted = ensureObjBuilderStarted(game);

  const success = game.ui.modal.pleaseWait('Exiting...', async () => {
    const minWait = timeoutPromise(1500);

    syncLocationToRealmSpawnLocation(game);
    const realmObjPath = await exportRealm('local', game);
    if (!realmObjPath) return false;

    await objBuilderStarted;
    const spriteObjPath = await game.objBuilder.worker.buildSpriteFromRealm(realmObjPath);
    const spriteObj = await requireSprite(spriteObjPath, game);

    if (game.realm.stack.length <= 0) {
      const newUpperRealm = createBaseRealm(game.ecs);
      const chunkIJ: Vec2 = [0, 0], position: Vec3 = [0, 0, 0];
      const chunk = getOrCreateChunk([0, 0], newUpperRealm, game.ecs);
      const newSubObjEntity = game.ecs.allocate();
      game.ecs.setComponent(newSubObjEntity, 'subObj', {
        obj: spriteObj,
        position: [0, 0, 0], rotation: [0, 0, 0],
        mounted: false,
        groundAltitude: 0,
        state: 'normal',
        chunkIJ,
        cellIJ: locateCellIJ(position, chunkIJ),
      });
      chunk.subObjs.push(newSubObjEntity);

      const newUpperRealmPath = await exportRealm('local', game, newUpperRealm);

      game.realm.stack.unshift({
        realmObj: newUpperRealmPath,
        possibleSubObjSids: game.ecs.getAllSids(newSubObjEntity),
      });
    }

    const poped = game.realm.stack.pop();

    await minWait;
    const upperRealmPath = poped.realmObj;
    await changeRealm(upperRealmPath, game);

    const subObjEntity = poped.possibleSubObjSids.map(sid => game.ecs.fromSid(sid)).find(entity => game.ecs.getComponent(entity, 'subObj'));
    if (!subObjEntity) return;
    dispatchReplaceSubObjActions(subObjEntity, spriteObjPath, game);

    castCameraZoomAnimation('out', game);
    return true;
  });

  if (!success) {
    game.ui.modal.alert('failed');
  }
}
