import * as THREE from 'three';
import * as Comlink from 'comlink';
import localForage from 'localforage';
import debug from 'debug';

import { GameECS, init as initECS } from '../lib/gameECS';
import { PackedRealmJson, packSprite } from '../lib/resourcePacker';
import { loadPackedRealm } from '../lib/resourceLoader';
import { calcJsonCid } from '../lib/ipfs';

import { ObjPath } from '../lib/obj/obj';
import { createBaseRealm } from '../lib/obj/realm';
import { getChunkEntityComponents, locateChunkIJ } from '../lib/chunk/chunk';
import { calcChunkMeshPosition } from '../lib/chunk/render';

import { EntityRef } from '../lib/utils/ecs';
import { Vec2, vecCopyToThree } from '../lib/utils/utils';
import type { OffscreenCanvas } from '../lib/utils/web';
import { makeOffscreenCanvas, loadImage, readAsDataURL } from '../lib/utils/web';
import { emulateComlinkRemote } from '../lib/utils/worker';

import { CHUNK_SIZE } from '../lib/consts';

const log = debug('worker/objBuilder');

export interface ObjBuilderRPCs {
  useCanvas: (canvas: HTMLCanvasElement) => void;
  buildSpriteFromRealm: (objRealmPath: ObjPath) => Promise<ObjPath>;
  drawSomething: () => Promise<string>;
  logWorker: () => void;
}

interface ObjBuilderWorker {
  canvas: OffscreenCanvas;
  ecs: GameECS;
  realmEntity: EntityRef;
}

export function startWorker(exposeAsComlink: boolean): Comlink.Remote<ObjBuilderRPCs> {
  const ecs = initECS();

  const worker: ObjBuilderWorker = {
    canvas: null,
    realmEntity: createBaseRealm(ecs),
    ecs,
  };

  const objBuilderRPCs: ObjBuilderRPCs = {
    useCanvas: canvas => {
      worker.canvas = makeOffscreenCanvas(canvas);
    },
    buildSpriteFromRealm: async objRealmPath => {
      await loadRealm(objRealmPath, worker);
      const builtObjEntity = buildSpriteFromRealm(worker.realmEntity, worker);
      const packedSpriteJson = packSprite(builtObjEntity, worker.ecs);
      const realmObjPath = `/local/${await calcJsonCid(packedSpriteJson)}`;
      await localForage.setItem(realmObjPath, packedSpriteJson);
      return realmObjPath;
    },
    drawSomething: async () => {
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera( 75, worker.canvas.width / worker.canvas.height, 0.1, 1000 );

      var renderer = new THREE.WebGLRenderer({ canvas: worker.canvas });

      // offscreenCanvas cannot set width/height:
      //renderer.setSize(512, 512);

      var geometry = new THREE.BoxGeometry( 1, 1, 1 );
      var material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
      var cube = new THREE.Mesh( geometry, material );
      scene.add( cube );

      camera.position.z = 5;

      cube.rotation.x += Math.PI * 0.25;
      cube.rotation.y += Math.PI * 0.25;

      renderer.render( scene, camera );

      const blob = await (renderer.domElement as OffscreenCanvas).convertToBlob();

      //console.log(URL.createObjectURL(blob));
      // new discovery in web!
      // object URL is like:
      // blob:http://localhost:8080/d91b83c1-71ce-4a4f-ad29-547748c94c63
      // but this can point to a large blob/file
      // docs: https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL
      // to convert object URL back: https://stackoverflow.com/a/52410044
     
      return readAsDataURL(blob);
    },
    logWorker: () => {
      console.log(worker);
    }
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

async function loadRealm(objRealmPath: ObjPath, worker: ObjBuilderWorker) {
  if (!objRealmPath) return;

  const json = await localForage.getItem<PackedRealmJson>(objRealmPath);
  if (json) {
    const prevChunks = worker.ecs.getComponent(worker.realmEntity, 'obj/realm').chunks;
    prevChunks.entries().forEach(([_chunkIJ, chunkEntity]) => {
      worker.ecs.deallocate(chunkEntity);
    });
    worker.ecs.deallocate(worker.realmEntity);

    worker.realmEntity = loadPackedRealm(objRealmPath, json, worker.ecs);
  }
}


function buildSpriteFromRealm(realmObj: EntityRef, worker: ObjBuilderWorker): EntityRef {
  const newObjSprite = worker.ecs.allocate();
  const newObjSpriteComponents = worker.ecs.getEntityComponents(newObjSprite);
  const chunkEntityComponents = getChunkEntityComponents([0, 0], realmObj, worker.ecs);

  renderSpritesheet(realmObj, worker);

  newObjSpriteComponents.set('obj', {
    subObjType: 'sprite',
  });
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
    srcRealmObjPath: worker.ecs.getPrimarySid(realmObj, true),
  });
  newObjSpriteComponents.set('obj/walkable', {
    speed: 4,
    maxClimbRad: Math.PI * 0.3,
  });

  return newObjSpriteComponents.entity;
}

async function renderSpritesheet(realmObj: EntityRef, worker: ObjBuilderWorker) {
  const left = -9;
  const top = 1.5;
  const bottom = 16.5;
  const right = 16.5;

  const renderer = new THREE.WebGLRenderer({ canvas: worker.canvas, alpha: true });
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
      const chunk = getChunkEntityComponents(chunkIJ, realmObj, worker.ecs).get('chunk');
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
