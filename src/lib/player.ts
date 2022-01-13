import * as THREE from 'three';
import localForage from 'localforage';

import type { Game } from './game';
import type { GameECS } from './gameECS';
import type { EntityRef } from './utils/ecs';

import { getObjEntity } from './obj/obj';
import { createSubObj, destroySubObj } from './subObj/subObj';
import { locateOrCreateChunkCell } from './chunk/chunk';
import { initSubObjWalking, setMoveTo, setMoveRelative } from './subObj/walking';
import { requireSprite } from './resource';

import { setCameraPosition, setCameraLocation, setCameraY } from './camera';
import { triggerRealmGeneration } from './realm';
import { broadcastMyself } from './network';

import { Vec2, Vec3, add, multiply, length, vec3To2, vec2To3, vecCopyToThree, assertPresentOrWarn } from './utils/utils';

import { MAX_DISTANCE_BETWEEN_PLAYER, PLAYER_OBJ_STORAGE_NAME } from './consts';

export interface Player {
  objEntity: EntityRef;
  subObjEntity: EntityRef;
  chunkIJ: Vec2;

  meleeRange?: THREE.Mesh;
}

export function create(ecs: GameECS): Player {
  const objEntity = getObjEntity('base', ecs);
  const subObjEntity = ecs.allocate();

  return {
    objEntity,
    subObjEntity, 
    chunkIJ: [0, 0],
  }
}

export function addToRealm(game: Game, initPosition: Vec3 = [0, 0, 0]) {
  const located = locateOrCreateChunkCell(initPosition, game);

  const subObj = createSubObj(game.player.objEntity, initPosition, [0, 0, 0], game, located, game.player.subObjEntity);
  mountSubObj(subObj, game);
}

export async function restorePlayerObj(game: Game) {
  const objPath = await localForage.getItem<string>(PLAYER_OBJ_STORAGE_NAME);
  if (!objPath) return;

  await requireSprite(objPath, game);
  await changePlayerObj(game.ecs.fromSid(objPath), game);
}

export function getPlayerLocation(game: Game) {
  const subObj = game.ecs.getComponent(game.player.subObjEntity, 'subObj');
  return vec3To2(subObj.position);
}

export async function changePlayerObj(targetObj: EntityRef, game: Game) {
  if (!game.ecs.getComponent(targetObj, 'obj/sprite')) return; // now we require obj to be sprite

  const playerSubObjComps = game.ecs.getEntityComponents(game.player.subObjEntity);
  const playerSubObj = playerSubObjComps.get('subObj');

  const located = locateOrCreateChunkCell(playerSubObj.position, game);
  destroySubObj(game.player.subObjEntity, game);
  const newSubObj = createSubObj(targetObj, playerSubObj.position, playerSubObj.rotation, game, located);
  mountSubObj(newSubObj, game);

  await Promise.all([
    localForage.setItem(PLAYER_OBJ_STORAGE_NAME, game.ecs.getPrimarySid(targetObj)),
    broadcastMyself(game),
  ]);
}

export function jumpOnRealm(game: Game) {
  game.player.subObjEntity = game.ecs.allocate();
  const realmObj = game.ecs.getComponent(game.realm.currentObj, 'obj/realm');
  addToRealm(game, vec2To3(realmObj.spawnLocation || [0, 0]));
}

export function jumpOffRealm(game: Game) {
  const oriSubObjComponents = game.ecs.getEntityComponents(game.player.subObjEntity);
  if (assertPresentOrWarn([oriSubObjComponents], 'player.jumpOffRealm: subObj of player not found')) return;

  destroySubObj(oriSubObjComponents.entity, game);
}

export function update(tDiff: number, game: Game) {
  const { player } = game;
  const subObj = game.ecs.getComponent(player.subObjEntity, 'subObj');
  const subObjSpriteRender = game.ecs.getComponent(player.subObjEntity, 'subObj/spriteRender');
  const subObjWalking = game.ecs.getComponent(player.subObjEntity, 'subObj/walking');

  if (subObjWalking.moving) {
    updateCameraLocation(game);
    setCameraY(subObjSpriteRender.sprite.position.y, game);
  }
  if (subObj.chunkIJ[0] !== player.chunkIJ[0] || subObj.chunkIJ[1] !== player.chunkIJ[1]) {
    player.chunkIJ = subObj.chunkIJ;
    triggerRealmGeneration(player.chunkIJ, game);
  }

  if (game.player.meleeRange) {
    const material = game.player.meleeRange.material as THREE.Material;

    material.opacity -= tDiff * 0.001;
    if (material.opacity <= 0) {
      game.player.meleeRange.removeFromParent();
      delete game.player.meleeRange;
    }
  }
}

export function movePlayerTo(target: Vec2, game: Game) {
  setMoveTo(game.player.subObjEntity, target, game);
  updateCameraLocation(game);
  broadcastMyself(game);
}

export function movePlayerAddRelative(dVec: Vec2, game: Game) {
  const subObjEntity = game.player.subObjEntity;
  const subObjWalking = game.ecs.getComponent(subObjEntity, 'subObj/walking');

  const vec = maxDistanceBetweenPlayer(
    add(subObjWalking.moveRelative || [0, 0], dVec)
  );
  setMoveRelative(subObjEntity, vec, game);
  updateCameraLocation(game);
  broadcastMyself(game);
}

export function syncLocationToRealmSpawnLocation(game: Game) {
  const realmObj = game.ecs.getComponent(game.realm.currentObj, 'obj/realm');
  realmObj.spawnLocation = getPlayerLocation(game);
}

export function showMeleeRange(game: Game) {
  const subObj = game.ecs.getComponent(game.player.subObjEntity, 'subObj');
  const obj = game.ecs.getComponent(game.player.objEntity, 'obj/sprite');
  const radius = obj.radius || 0.5;

  if (!game.player.meleeRange) {
    const geometry = new THREE.RingGeometry(radius, radius * 2, 16, 1, 0, Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, transparent: true });
    game.player.meleeRange = new THREE.Mesh(geometry, material);
    game.player.meleeRange.rotation.x = -Math.PI / 2;
    game.scene.add(game.player.meleeRange);
  }

  vecCopyToThree(subObj.position, game.player.meleeRange.position);
  game.player.meleeRange.position.y += 0.01;
  game.player.meleeRange.rotation.z = subObj.rotation[1] + Math.PI / 4;
  const material = game.player.meleeRange.material as THREE.Material;
  material.opacity = 0.4;
}

function mountSubObj(subObjEntity: EntityRef, game: Game) {
  game.player.subObjEntity = subObjEntity;
  const subObj = game.ecs.getComponent(subObjEntity, 'subObj');
  game.player.objEntity = subObj.obj;
  subObj.mounted = true;

  game.player.chunkIJ = subObj.chunkIJ;
  const subObjRender = game.ecs.getComponent(game.player.subObjEntity, 'subObj/spriteRender');
  setCameraPosition(
    [subObj.position[0], subObjRender.sprite.position.y, subObj.position[2]],
    game
  );
  initSubObjWalking(game.player.subObjEntity, game);
}

function maxDistanceBetweenPlayer(vec: Vec2 | null): Vec2 {
  const distance = length(vec || [0, 0]);
  if (distance > MAX_DISTANCE_BETWEEN_PLAYER) {
    return multiply(vec, MAX_DISTANCE_BETWEEN_PLAYER / distance);
  }
  return vec
}

function updateCameraLocation(game: Game) {
  const subObjEntity = game.player.subObjEntity;
  const subObj = game.ecs.getComponent(subObjEntity, 'subObj');
  const subObjWalking = game.ecs.getComponent(subObjEntity, 'subObj/walking');

  setCameraLocation(
    add(
      vec3To2(subObj.position),
      maxDistanceBetweenPlayer(subObjWalking.moveRelative),
    ),
    game,
  );
}
