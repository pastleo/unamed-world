import * as THREE from 'three';

import { Game } from './game';

import { getChunkEntityComponents, locateChunkIJ } from './chunk/chunk';
import { calcChunkMeshPosition } from './chunk/render';

import { EntityRef } from './utils/ecs';
import { Vec2, vecCopyToThree } from './utils/utils';
import { loadImage } from './utils/web';

import { CHUNK_SIZE } from './consts';

//export interface ObjBuilder {
//}

//export function init(): ObjBuilder {
  //return {}
//}

//export async function start(_game: Game) {
//}

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
    srcRealmObjPath: game.ecs.getPrimarySid(game.realm.currentObj, true),
  });
  newObjSpriteComponents.set('obj/walkable', {
    speed: 4,
    maxClimbRad: Math.PI * 0.3,
  });

  return newObjSpriteComponents.entity;
}
