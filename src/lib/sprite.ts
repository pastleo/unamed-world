import * as THREE from 'three';

import { Game } from './game';
import { GameECS } from './gameECS';
import { fetchObjJson, importSprite, loadExportedSprite } from './storage';
import { reqSprite } from './network';

import { ObjPath, createObjEntity } from './obj/obj';
import { getChunkEntityComponents, locateChunkIJ } from './chunk/chunk';
import { calcChunkMeshPosition } from './chunk/render';
import { addSubObjToScene } from './subObj/subObj';

import { EntityRef, entityEqual } from './utils/ecs';
import { Vec2, warnIfNotPresent, vecCopyToThree } from './utils/utils';
import { createCanvas2d } from './utils/web';

import { CHUNK_SIZE } from './consts';

export interface SpriteManager {
  fetchingObjs: Map<ObjPath, EntityRef[]>;
  requireObjSprite: (subObjEntityRequiring: EntityRef, objEntity: EntityRef) => void;
}

export function init(): SpriteManager {
  return {
    fetchingObjs: new Map(),
    requireObjSprite: () => {},
  }
}

export function start(game: Game) {
  game.spriteManager.requireObjSprite = (subObjEntityRequiring, objEntity) => {
    requireObjSprite(subObjEntityRequiring, objEntity, game) ;
  }
  createBaseSpriteObj(game.ecs);
}

export async function requireObjSprite(subObjEntityRequiring: EntityRef, objEntity: EntityRef, game: Game) {
  const objSprite = game.ecs.getComponent(objEntity, 'obj/sprite');
  if (objSprite) return; // already required

  const spriteObjPath: ObjPath = game.ecs.getSid(objEntity);
  let waitingSubObjs = game.spriteManager.fetchingObjs.get(spriteObjPath);
  if (!waitingSubObjs) {
    waitingSubObjs = []
    game.spriteManager.fetchingObjs.set(spriteObjPath, waitingSubObjs);
  }
  if (waitingSubObjs.findIndex(subObj => entityEqual(subObj, subObjEntityRequiring)) === -1) {
    waitingSubObjs.push(subObjEntityRequiring);
  }

  let json = await fetchObjJson(spriteObjPath, game, '-sprite');

  if (!json && game.network.roomName) {
    json = await reqSprite(spriteObjPath, game);
  }
  if (warnIfNotPresent(json)) return;
  const jsonValidated = await importSprite(spriteObjPath, json);

  loadExportedSprite(spriteObjPath, jsonValidated, game.ecs);
  waitingSubObjs.forEach(subObj => {
    addSubObjToScene(subObj, game, true);
  });
  game.spriteManager.fetchingObjs.delete(spriteObjPath);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.src = src;
  });
}

async function renderSpritesheet(game: Game) {
  const left = -9;
  const top = 1.5;
  const bottom = 16.5;
  const right = 16.5;

  const renderer = new THREE.WebGLRenderer({ alpha: true });
  const width = right - left;
  const height = bottom - top;
  renderer.setSize(width * 100, height * 100);
  const camera = new THREE.OrthographicCamera(-width/2, width/2, -height/2, height/2);
  camera.position.set(0, 10, 0);
  camera.lookAt(0, 0, 0);
  camera.scale.y = -1;
  const cameraWrapper = new THREE.Object3D();
  vecCopyToThree([(left + right) / 2, (top + bottom) / 2], cameraWrapper.position);
  cameraWrapper.add(camera);
  const tmpScene = new THREE.Scene();
  tmpScene.add(cameraWrapper);
  const planes = new THREE.Object3D();
  tmpScene.add(planes);

  const [chunkILeft, chunkJTop] = locateChunkIJ([left, 0, top]);
  const [chunkIRight, chunkJBottom] = locateChunkIJ([right, 0, bottom]);

  const promises = Array(chunkIRight - chunkILeft + 1).fill(null).map((_, i) => chunkILeft + i).flatMap(chunkI => (
    Array(chunkJBottom - chunkJTop + 1).fill(null).map((_, j) => chunkJTop + j).map(async chunkJ => {
      const chunkIJ: Vec2 = [chunkI, chunkJ];
      const chunk = getChunkEntityComponents(chunkIJ, game.realm.currentObj, game.ecs).get('chunk');
      //chunkRender.mesh.visible = false;

      const image = await loadImage(chunk.textureUrl);

      const texture = new THREE.Texture(image);
      texture.needsUpdate = true;
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
      });
      const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE);
      const plane = new THREE.Mesh( geometry, material );

      vecCopyToThree(
        calcChunkMeshPosition(chunkIJ), 
        plane.position,
      );
      plane.rotation.x = Math.PI / 2;
      planes.add(plane);
    })
  ));

  await Promise.all(promises);

  document.body.appendChild(
    renderer.domElement
  );
  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.top = '20px';
  renderer.domElement.style.left = '20px';
  renderer.domElement.style.width = '80vw';
  renderer.domElement.style.height = 'auto';

  renderer.render(tmpScene, camera);
  console.log('rendered');
}

export function buildSpriteFromCurrentRealm(game: Game): EntityRef {
  const newObjSprite = game.ecs.allocate();
  const newObjSpriteComponents = game.ecs.getEntityComponents(newObjSprite);
  const chunkEntityComponents = getChunkEntityComponents([0, 0], game.realm.currentObj, game.ecs);

  renderSpritesheet(game);

  newObjSpriteComponents.set('obj/sprite', {
    spritesheet: chunkEntityComponents.get('chunk').textureUrl, // TODO
    colRow: [1, 1],
    stateAnimations: {
      normal: {
        animations: [[0, 0]],
        speed: 0,
      },
    },
    tall: 1,
    radius: 0.5,
    srcRealmObjPath: game.ecs.getSid(game.realm.currentObj),
  });
  newObjSpriteComponents.set('obj/walkable', {
    speed: 4,
    maxClimbRad: Math.PI * 0.3,
  });

  return newObjSpriteComponents.entity;
}


export function createBaseSpriteObj(ecs: GameECS) {
  const ctx = createCanvas2d(256, 256);

  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, '#FFFFFFFF')
  gradient.addColorStop(1, '#FFFFFF00')

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const objEntity = createObjEntity(ecs, 'base');
  ecs.setComponent(objEntity, 'obj/sprite', {
    spritesheet: ctx.canvas.toDataURL('image/png'), // use 'image/webp' when Safari finally support webp
    eightBitStyle: true,
    colRow: [1, 1],
    stateAnimations: {
      normal: {
        animations: [[0, 0]],
        speed: 0,
      },
    },
    tall: 1,
    radius: 0.5,
    collision: false,
  });
  ecs.setComponent(objEntity, 'obj/walkable', {
    speed: 4,
    maxClimbRad: Math.PI * 0.3,
  });
}
