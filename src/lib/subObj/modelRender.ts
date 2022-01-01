import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { Game } from '../game';

import { EntityRef } from '../utils/ecs';
import { warnIfNotPresent } from '../utils/utils';

export interface SubObjModelRenderComponent {
  threeObj: THREE.Object3D;
}

export function addModelToScene(subObjEntity: EntityRef, game: Game, refresh: boolean = false) {
  const subObjComponents = game.ecs.getEntityComponents(subObjEntity);
  const subObj = subObjComponents.get('subObj');
  if (warnIfNotPresent(subObj)) return;
  const objModel = game.ecs.getComponent(subObj.obj, 'obj/model');
  if (!objModel) return;

  let subObjModelRender = subObjComponents.get('subObj/modelRender');
  if (subObjModelRender) {
    if (refresh) {
      subObjModelRender.threeObj.removeFromParent();
    } else {
      return;
    }
  }

  let threeObj: THREE.Object3D;
  let gltf: GLTF = game.cache.gltfs.get(objModel.glbUrl);
  if (gltf) {
    threeObj = gltf.scene.clone(true);
  } else {
    threeObj = new THREE.Object3D();
    (async () => {
      const gltf = await loadGltf(objModel.glbUrl);
      game.cache.gltfs.set(objModel.glbUrl, gltf);
      gltf.scene.position.copy(threeObj.position);
      gltf.scene.rotation.copy(threeObj.rotation);
      threeObj.removeFromParent();
      threeObj = gltf.scene;
      game.scene.add(threeObj);
    })();
  }
  game.scene.add(threeObj);

  subObjModelRender = { threeObj };
  game.ecs.setComponent(subObjEntity, 'subObj/modelRender', subObjModelRender);
}

export function updateModelPosition(subObjEntity: EntityRef, game: Game) {
  const subObjModelRender = game.ecs.getComponent(subObjEntity, 'subObj/modelRender');

  if (!subObjModelRender) return;
  const subObj = game.ecs.getComponent(subObjEntity, 'subObj');

  subObjModelRender.threeObj.position.x = subObj.position[0];
  subObjModelRender.threeObj.position.y = subObj.position[1] + subObj.groundAltitude;
  subObjModelRender.threeObj.position.z = subObj.position[2];

  subObjModelRender.threeObj.rotation.y = subObj.rotation[1];
}

export function removeModel(subObjEntity: EntityRef, game: Game) {
  const subObjModelRender = game.ecs.getComponent(subObjEntity, 'subObj/modelRender');
  if (!subObjModelRender) return;

  subObjModelRender.threeObj.removeFromParent();
}

function loadGltf(url: string): Promise<GLTF> {
  return new Promise(resolve => {
    const loader = new GLTFLoader();
    loader.load(url, resolve);
  });
}
