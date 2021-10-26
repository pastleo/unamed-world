import * as THREE from 'three';
import * as Comlink from 'comlink';

import { getObjEntity } from './obj/obj';
import { createBaseRealm, pack as packObjRealm } from './obj/realm';
import { ChunkComponent, ChunkEntityComponents, Cell, getChunkEntityComponents, pack as packChunk } from './chunk/chunk';
import { createChunkMesh } from './chunk/render';
import { Game } from './game';
import { GameECS } from './gameECS';
import { RealmWorker, ChunkGenerationResult } from './worker/realm';
import { addSubObj, pack as packSubObj } from './subObj/subObj';
import { pack as packObjSprite } from './obj/sprite';
import { pack as packObjWalkable } from './obj/walkable';
import { updateSpritePosition } from './subObj/spriteRender';

import { EntityRef, UUID, entityEqual } from './utils/ecs';
import { Vec2 } from './utils/utils';
import { spawnWorker, listenToWorkerNextValue } from './utils/worker';
import Map2D from './utils/map2d';

import { CHUNK_SIZE } from './consts';
import { loadObjSprites, loadRealm1 } from './dev-data';

export interface Realm {
  currentObj: EntityRef;
  light: THREE.DirectionalLight;
  worker: Comlink.Remote<RealmWorker>;
  baseMaterial: THREE.Material;
}

export function init(ecs: GameECS): Realm {
  let currentObj = createBaseRealm(ecs);

  // TODO: should not hard-code, downloading realm should be moved to addToScene and switch to target realm
  if (window.location.hash === '#/realm-1') {
    loadRealm1(ecs);
    currentObj = getObjEntity('realm-1', ecs);
  }

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
  const { backgrounds } = game.ecs.getComponent(game.realm.currentObj, 'obj/realm');

  game.scene.add(game.realm.light);
  game.scene.add(game.realm.light.target);

  {
    // TODO: load realm asynchronously, adding subObjs
    loadObjSprites(game.ecs);
    addSubObj(getObjEntity('hero-1', game.ecs), [-5, 0, -5], game);
    addSubObj(getObjEntity('flying-bitch-1', game.ecs), [0, 0, -5], game);
    addSubObj(getObjEntity('giraffe-1', game.ecs), [5, 0, -5], game);

    // TODO: cache realm, chunk entities and components to localstorage
    //
    // TODO: should not hard-code
    if (window.location.hash === '#/realm-1') {
      game.realm.worker.load('realm-1');
    }

    listenToWorkerNextValue(game.realm.worker.nextGeneratedChunk, result => {
      handleNextGeneratedChunk(result, game);
    });

    const backgroundLoader = new THREE.CubeTextureLoader();
    const texture = backgroundLoader.load(backgrounds);
    game.scene.background = texture;

    game.realm.worker.triggerRealmGeneration([0, 0]);
  }
}

export function updateRealmChunk(chunkSrc: ChunkComponent, game: Game): ChunkEntityComponents {
  let updating = true;
  const chunkEntityComponents = getChunkEntityComponents(chunkSrc.chunkIJ, game.realm.currentObj, game.ecs, () => {
    updating = false;
    return chunkSrc;
  });
  let chunk = chunkEntityComponents.get('chunk');
  if (updating) {
    chunk = {
      ...chunkSrc,
      persistance: chunkSrc.persistance || chunk.persistance,
      subObjs: [
        ...chunk.subObjs,
        ...chunkSrc.subObjs.filter(
          srcSobj => chunk.subObjs.findIndex(
            existingSobj => entityEqual(srcSobj, existingSobj)
          ) === -1
        )
      ],
    };
    chunkEntityComponents.set('chunk', chunk);
  }

  chunk.subObjs.forEach(subObjEntity => {
    // all possible subObj render systems:
    // initSprite()...
    updateSpritePosition(subObjEntity, game);
  });

  return chunkEntityComponents;
}

function handleNextGeneratedChunk(result: ChunkGenerationResult, game: Game) {
  const { chunkIJ, cellEntries, textureUrl, attributeArrays, persistance } = result;

  const cells = Map2D.fromEntries<Cell>(cellEntries);
  const chunkEntityComponents = updateRealmChunk({
    cells, textureUrl,
    chunkIJ,
    subObjs: [],
    persistance,
  }, game);

  createChunkMesh(chunkEntityComponents, chunkIJ, attributeArrays, game);
}

export function triggerRealmGeneration(centerChunkIJ: Vec2, game: Game) {
  game.realm.worker.triggerRealmGeneration(centerChunkIJ);
}

export function exportRealm(game: Game) {
  console.log('start exportRealm');
  const realmObjEntityComponents = game.ecs.getEntityComponents(game.realm.currentObj);

  const realmUUID = game.ecs.getUUID(game.realm.currentObj);
  const subObjUUIDs: UUID[] = [];

  const packedObjRealm = packObjRealm(realmObjEntityComponents.get('obj/realm'), game.ecs);
  const packedChunks = packedObjRealm.chunkEntries.map(([_chunkIJ, uuid]) => {
    const packedChunk = packChunk(
      game.ecs.getComponent(
        game.ecs.fromUUID(uuid),
        'chunk',
      ),
      game.ecs,
    );
    subObjUUIDs.push(...packedChunk.subObjs);

    return [uuid, packedChunk];
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
  ]));
  
  const objRealmJson = {
    realmUUID,
    packedObjRealm,
    packedChunks,
    packedSubObjs,
  };
  download(objRealmJson, `${realmUUID}-realm.json`);

  // TODO: generate sprite components for this realm

  // WIP ============
  ['hero-1', 'flying-bitch-1', 'giraffe-1'].forEach(objUUID => {
    const objEntityComponents = game.ecs.getEntityComponents(getObjEntity(objUUID, game.ecs));
    const packedObjSprite = packObjSprite(objEntityComponents.get('obj/sprite'));
    const packedObjWalkable = packObjWalkable(objEntityComponents.get('obj/walkable'));

    const objSpriteJson = {
      objUUID,
      packedObjSprite,
      packedObjWalkable,
    };
    download(objSpriteJson, `${objUUID}-sprite.json`);
  });
}

function download(json: any, filename: string) {
  const blob = new Blob([
    JSON.stringify(json)
  ], {type: "application/json"});
  const elem = document.createElement('a');
  elem.href = URL.createObjectURL(blob);
  elem.download = filename;        
  document.body.appendChild(elem);
  elem.click();        
  document.body.removeChild(elem);
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
