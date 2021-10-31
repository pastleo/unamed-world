import * as THREE from 'three';
import * as Comlink from 'comlink';
import localForage from 'localforage';

import { Game } from './game';
import { GameECS } from './gameECS';
import { RealmWorker, ChunkGenerationResult } from './worker/realm';

import { PackedObjRealmComponent, createBaseRealm, pack as packObjRealm, unpack as unpackObjRealm } from './obj/realm';
import {
  Cell, PackedChunkComponent, getChunkEntityComponents, createChunk, mergeChunk,
  pack as packChunk, unpack as unpackChunk, destroy as destroyChunk,
} from './chunk/chunk';
import { addChunkMeshToScene, removeChunkMeshFromScene } from './chunk/render';
import { PackedSubObjComponent, pack as packSubObj, unpack as unpackSubObj } from './subObj/subObj';
import { addOrRefreshSubObjToScene, destroySubObj } from './subObj/subObj';

import { EntityRef, UUID, entityEqual } from './utils/ecs';
import { Vec2, warnIfNotPresent, downloadJson } from './utils/utils';
import { spawnWorker, listenToWorkerNextValue } from './utils/worker';
import Map2D from './utils/map2d';

import { CHUNK_SIZE } from './consts';

export interface Realm {
  currentObj: EntityRef;
  prevChunks?: Map2D<EntityRef>;
  light: THREE.DirectionalLight;
  worker: Comlink.Remote<RealmWorker>;
  baseMaterial: THREE.Material;
}

export function init(ecs: GameECS): Realm {
  const currentObj = createBaseRealm(ecs);

  const light = new THREE.DirectionalLight(0xFFFFFF, 1);
  light.position.set(0, 1, 0);
  light.target.position.set(0, 0, 0);

  const worker = spawnWorker<RealmWorker>('realm');

  return {
    currentObj,
    light,
    worker,
    baseMaterial: createBaseMaterial(),
  };
}

export function addToScene(game: Game) {
  game.scene.add(game.realm.light);
  game.scene.add(game.realm.light.target);

  listenToWorkerNextValue(game.realm.worker.nextGeneratedChunk, result => {
    handleNextGeneratedChunk(result, game);
  });

  resetRealm(game);
}

export function resetRealm(game: Game) {
  const { backgrounds } = game.ecs.getComponent(game.realm.currentObj, 'obj/realm');

  const backgroundLoader = new THREE.CubeTextureLoader();
  const texture = backgroundLoader.load(backgrounds);
  game.scene.background = texture;

  (async () => {
    await game.realm.worker.load(game.ecs.getUUID(game.realm.currentObj));
    await game.realm.worker.triggerRealmGeneration([0, 0]);
  })();
}

export async function fetchRealm(realmObjUUID: UUID): Promise<ExportedRealmJson> {
  const response = await fetch(`dev-objs/${realmObjUUID}-realm.json`);
  if (warnIfNotPresent(response.ok)) return;
  const json = await response.json() as ExportedRealmJson; // TODO: might need to be verified
  if (realmObjUUID !== json.realmUUID) {
    console.warn('UUID in json not equal');
    return;
  }

  await localForage.setItem(`realm:${realmObjUUID}`, json);
  return json;
}

export function switchRealm(json: ExportedRealmJson, game: Game): boolean {
  const currentRealmObjComponents = game.ecs.getEntityComponents(game.realm.currentObj);
  if (json.realmUUID === game.ecs.getUUID(currentRealmObjComponents.entity)) {
    console.warn('realm UUID the same as current one');
    return false;
  }

  game.realm.prevChunks = currentRealmObjComponents.get('obj/realm').chunks;
  game.ecs.deallocate(game.realm.currentObj);
  game.realm.currentObj = loadExportedRealm(json, game.ecs);
  resetRealm(game);
  return true;
}

export function loadExportedRealm(json: ExportedRealmJson, ecs: GameECS): EntityRef {
  const newRealmEntity = ecs.fromUUID(json.realmUUID);
  unpackObjRealm(newRealmEntity, json.packedObjRealm, ecs);
  json.packedChunks.forEach(([UUID, packedChunk]) => {
    unpackChunk(
      ecs.fromUUID(UUID),
      packedChunk,
      ecs,
    )
  });
  json.packedSubObjs.forEach(([UUID, packedSubObjs]) => {
    unpackSubObj(
      ecs.fromUUID(UUID),
      packedSubObjs,
      ecs,
    );
  });

  return newRealmEntity;
}

function handleNextGeneratedChunk(result: ChunkGenerationResult, game: Game) {
  const { chunkIJ, textureUrl, attributeArrays, cellEntries } = result;
  
  let chunkEntityComponents = getChunkEntityComponents(chunkIJ, game.realm.currentObj, game.ecs);
  if (chunkEntityComponents) {
    mergeChunk({
      chunkIJ,
      textureUrl,
      subObjs: [],
      persistance: false,
      ...(cellEntries ? {
        cells: Map2D.fromEntries<Cell>(cellEntries),
      } : {})
    }, game);
  } else {
    if (warnIfNotPresent(cellEntries)) return;
    const chunkEntity = createChunk({
      chunkIJ,
      textureUrl,
      subObjs: [],
      persistance: false,
      cells: Map2D.fromEntries<Cell>(cellEntries),
    }, game.realm.currentObj, game.ecs);
    chunkEntityComponents = game.ecs.getEntityComponents(chunkEntity);
  }

  addChunkMeshToScene(chunkEntityComponents, chunkIJ, attributeArrays, game);
  chunkEntityComponents.get('chunk').subObjs.forEach(subObjEntity => {
    addOrRefreshSubObjToScene(subObjEntity, game);
  });

  if (game.realm.prevChunks) {
    const chunkEntityComponents = game.ecs.getEntityComponents(
      game.realm.prevChunks.get(...chunkIJ)
    );
    if (chunkEntityComponents) {
      chunkEntityComponents.get('chunk').subObjs.forEach(subObjEntity => {
        destroySubObj(subObjEntity, game);
      });

      removeChunkMeshFromScene(chunkEntityComponents);
      destroyChunk(chunkEntityComponents, game.ecs);
    }
  }
}

export function triggerRealmGeneration(centerChunkIJ: Vec2, game: Game) {
  game.realm.worker.triggerRealmGeneration(centerChunkIJ);
}

export interface ExportedRealmJson {
  realmUUID: UUID;
  packedObjRealm: PackedObjRealmComponent,
  packedChunks: UUIDEntry<PackedChunkComponent>[],
  packedSubObjs: UUIDEntry<PackedSubObjComponent>[],
}
type UUIDEntry<T> = [UUID, T];

export function exportRealm(game: Game) {
  const realmObjEntityComponents = game.ecs.getEntityComponents(game.realm.currentObj);

  const realmUUID = game.ecs.getUUID(game.realm.currentObj);
  const subObjUUIDs: UUID[] = [];

  const packedObjRealm = packObjRealm(realmObjEntityComponents.get('obj/realm'), game.ecs);
  const packedChunks = packedObjRealm.chunkEntries.map(([_chunkIJ, uuid]) => {
    const chunk = game.ecs.getComponent(game.ecs.fromUUID(uuid), 'chunk');
    const packedChunk = packChunk({
      ...chunk,
      subObjs: chunk.subObjs.filter(subObjEntity => !entityEqual(subObjEntity, game.player.subObjEntity))
    }, game.ecs);
    subObjUUIDs.push(...packedChunk.subObjs);

    return [uuid, packedChunk] as UUIDEntry<PackedChunkComponent>;
  });
  const packedSubObjs = subObjUUIDs.map(uuid => ([
    uuid,
    packSubObj(
      game.ecs.getComponent(
        game.ecs.fromUUID(uuid),
        'subObj',
      ),
      game.ecs,
    )
  ] as UUIDEntry<PackedSubObjComponent>));
  
  const objRealmJson: ExportedRealmJson = {
    realmUUID,
    packedObjRealm,
    packedChunks,
    packedSubObjs,
  };
  downloadJson(objRealmJson, `${realmUUID}-realm.json`);
}

function createBaseMaterial(): THREE.Material {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'white';
  ctx.lineWidth = 1;

  ctx.beginPath();
  const cellSize = canvas.width / CHUNK_SIZE;
  for(let i = 0; i <= CHUNK_SIZE; i++) {
    const pos = cellSize * i;
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, canvas.height);
    ctx.moveTo(0, pos);
    ctx.lineTo(canvas.width, pos);
  }
  ctx.stroke();

  const texture = new THREE.CanvasTexture(ctx.canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  return new THREE.MeshPhongMaterial({
    map: texture,
    transparent: true,
  });
}
