import * as THREE from 'three';
import * as Comlink from 'comlink';
import debug from 'debug';

import { GameECS, init as initECS } from '../lib/gameECS';
import { switchRealmLocally, exportSpriteLocally } from '../lib/resource';
import { renderBaseSprite } from '../lib/builtInObj';

import { ObjPath } from '../lib/obj/obj';
import { createBaseRealm } from '../lib/obj/realm';
import { getChunkEntityComponents, locateChunkIJ } from '../lib/chunk/chunk';
import { calcChunkMeshPosition } from '../lib/chunk/render';

import { EntityRef } from '../lib/utils/ecs';
import { Vec2, vecCopyToThree } from '../lib/utils/utils';
import type { OffscreenCanvas } from '../lib/utils/web';
import { makeOffscreenCanvas, loadImageBitmap, readAsDataURL } from '../lib/utils/web';
import { ReversedRPC, NextRequest, ResponseReq, createReversedRPC, emulateComlinkRemote } from '../lib/utils/worker';

import { CHUNK_SIZE } from '../lib/consts';

const log = debug('worker/objBuilder');

export interface ObjBuilderRPCs {
  buildSpriteFromRealm: (objRealmPath: ObjPath) => Promise<ObjPath>;
  nextRequestCanvas: NextRequest<CanvasRequest, HTMLCanvasElement>;
  responseCanvas: ResponseReq<CanvasRequest, HTMLCanvasElement>;
}

interface ObjBuilderWorker {
  requestCanvas: ReversedRPC<CanvasRequest, HTMLCanvasElement>;
  ecs: GameECS;
  realmEntity: EntityRef;
}

interface CanvasRequest {
  width: number;
  height: number;
}

export function startWorker(exposeAsComlink: boolean): Comlink.Remote<ObjBuilderRPCs> {
  const ecs = initECS();
  
  const [requestCanvas, nextRequestCanvas, responseCanvas] = createReversedRPC<CanvasRequest, HTMLCanvasElement>();

  const worker: ObjBuilderWorker = {
    requestCanvas,
    realmEntity: createBaseRealm(ecs),
    ecs,
  };

  const objBuilderRPCs: ObjBuilderRPCs = {
    buildSpriteFromRealm: objRealmPath => (
      buildSpriteFromRealm(objRealmPath, worker)
    ),
    nextRequestCanvas, responseCanvas,
  }

  if (exposeAsComlink) {
    Comlink.expose(objBuilderRPCs);
    return null;
  }

  return emulateComlinkRemote(objBuilderRPCs);
}

if (typeof window === 'undefined') {
  log('starting as real web worker');
  startWorker(true);
}

async function buildSpriteFromRealm(objRealmPath: ObjPath, worker: ObjBuilderWorker): Promise<ObjPath> {
  log('buildSpriteFromRealm: starting loading realm');
  const realmObj = await switchRealmLocally(objRealmPath, worker.realmEntity, worker.ecs);
  if (!realmObj) return;

  worker.realmEntity = realmObj;

  const newObjSprite = worker.ecs.allocate();
  const newObjSpriteComponents = worker.ecs.getEntityComponents(newObjSprite);

  log('buildSpriteFromRealm: starting rendering spritesheet');
  const spritesheet = await renderSpritesheet(realmObj, worker);

  log('buildSpriteFromRealm: creating sprite obj components');
  newObjSpriteComponents.set('obj', {
    subObjType: 'sprite',
  });
  newObjSpriteComponents.set('obj/sprite', {
    spritesheet,
    colRow: [1, 1],
    stateAnimations: {
      normal: {
        animations: [[0, 0]],
        speed: 0,
      },
    },
    tall: 1,
    radius: 0.5,
    srcRealmObjPath: worker.ecs.getPrimarySid(realmObj, true),
  });
  newObjSpriteComponents.set('obj/walkable', {
    speed: 4,
    maxClimbRad: Math.PI * 0.3,
  });

  log('buildSpriteFromRealm: exportSpriteLocally...');
  const objSpritePath = await exportSpriteLocally(newObjSpriteComponents.entity, worker.ecs);

  log(`buildSpriteFromRealm: sprite obj exported as '${objSpritePath}'`);
  return objSpritePath;
}

async function renderSpritesheet(realmObj: EntityRef, worker: ObjBuilderWorker): Promise<string> {
  const [rotationY, left, top, bottom, right] = calcSpriteCapArea(realmObj, worker);

  const terrainWidth = right - left;
  const terrainHeight = bottom - top;
  const width = terrainWidth * 100;
  const height = terrainHeight * 100;

  const canvas = makeOffscreenCanvas(
    await worker.requestCanvas({ width, height })
  );

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  const tmpScene = new THREE.Scene();

  const cameraWrapper = new THREE.Object3D();
  vecCopyToThree([(left + right) / 2, (top + bottom) / 2], cameraWrapper.position);
  cameraWrapper.rotation.y = rotationY;
  tmpScene.add(cameraWrapper);

  const camera = new THREE.OrthographicCamera(-terrainWidth/2, terrainWidth/2, -terrainHeight/2, terrainHeight/2);
  camera.position.set(0, 10, 0);
  camera.lookAt(0, 0, 0);
  camera.scale.y = -1;
  cameraWrapper.add(camera);

  const planes = new THREE.Object3D();
  tmpScene.add(planes);

  const [chunkILeft, chunkJTop] = locateChunkIJ([left, 0, top]);
  const [chunkIRight, chunkJBottom] = locateChunkIJ([right, 0, bottom]);

  const promises = Array(chunkIRight - chunkILeft + 1).fill(null).map((_, i) => chunkILeft + i).flatMap(chunkI => (
    Array(chunkJBottom - chunkJTop + 1).fill(null).map((_, j) => chunkJTop + j).map(async chunkJ => {
      const chunkIJ: Vec2 = [chunkI, chunkJ];
      const chunkComponents = getChunkEntityComponents(chunkIJ, realmObj, worker.ecs);
      if (!chunkComponents) return;
      const chunk = chunkComponents.get('chunk');
      if (!chunk.textureUrl) return;

      log(`loading chunk (${chunk.chunkIJ.join(', ')})`);
      const image = await loadImageBitmap(chunk.textureUrl);

      const texture = new THREE.CanvasTexture(image);
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

  try {
    await Promise.all(promises);
    log('all chunks added to tmpScene');
  } catch (err) {
    console.error(err);
  }

  const renderTarget = new THREE.WebGLRenderTarget(width, height, { format: THREE.RGBAFormat });
  renderer.setRenderTarget(renderTarget);
  renderer.clear(true, true, true);
  renderer.render(tmpScene, camera);

  renderer.setRenderTarget(null);
  renderer.render(tmpScene, camera);

  let blob;
  const data = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, data);

  if (checkAllTransparent(data)) {
    log('all transparent, render base sprite and export...')

    const size = 256;
    const canvas = makeOffscreenCanvas(
      await worker.requestCanvas({ width: size, height: size })
    );
    renderBaseSprite(canvas.getContext('2d'), size);
    blob = await canvas.convertToBlob();
  } else {
    log('not all transparent, exporting...')
    blob = await (renderer.domElement as OffscreenCanvas).convertToBlob();
  }

  return readAsDataURL(blob);
}

function calcSpriteCapArea(realmObj: EntityRef, worker: ObjBuilderWorker): [rotationY: number, left: number, top: number, bottom: number, right: number] {
  const pinSubObjs = worker.ecs.getComponent(realmObj, 'obj/realm').chunks.entries().flatMap(([_chunkIJ, chunkEntity]) => {
    const chunk = worker.ecs.getComponent(chunkEntity, 'chunk');
    return chunk.subObjs.map(subObjEntity => (
      worker.ecs.getComponent(subObjEntity, 'subObj')
    )).filter(subObj => (
      worker.ecs.getPrimarySid(subObj.obj, true) === 'pin'
    ));
  });
  
  if (pinSubObjs.length < 3) {
    return [
      0,
      -CHUNK_SIZE / 2, -CHUNK_SIZE / 2,
      CHUNK_SIZE / 2, CHUNK_SIZE / 2,
    ]
  }

  const rotationY = pinSubObjs.reduce((sum, pin) => sum + pin.rotation[1], 0) / pinSubObjs.length;

  //const cos = Math.cos(rotationY);
  //const sin = Math.sin(rotationY);

  let left = Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  let right = -Infinity;

  pinSubObjs.forEach(pin => {
    const x = pin.position[0];
    const z = pin.position[2];

    if (left > x) { left = x; }
    if (right < x) { right = x; }
    if (top > z) { top = z; }
    if (bottom < z) { bottom = z; }
  });

  return [
    rotationY,
    left, top,
    bottom, right,
  ]
}

function checkAllTransparent(data: Uint8Array): boolean {
  const pixels = Math.floor(data.length / 4);
  for (let i = 0; i < pixels; i++) {
    const [r,g,b,a] = data.slice(i * 4, (i+1) * 4);
    if (r !== 0 || g !== 0 || b !== 0 || a !== 0) {
      return false;
    }
  }
  return true;
}
