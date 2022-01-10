import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { Game } from '../game';

import { EntityRef } from '../utils/ecs';
import { assertPresentOrWarn } from '../utils/utils';

export interface SubObjModelRenderComponent {
  threeObj: THREE.Object3D;
}

export function addModelToScene(subObjEntity: EntityRef, game: Game, refresh: boolean = false) {
  const subObjComponents = game.ecs.getEntityComponents(subObjEntity);
  const subObj = subObjComponents.get('subObj');
  if (assertPresentOrWarn([subObj], 'subObj/modelRender.addModelToScene: subObj component not found')) return;
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
  subObjModelRender = { threeObj: new THREE.Object3D() };

  let gltf: GLTF = game.cache.gltfs.get(objModel.glbUrl);
  if (gltf) {
    subObjModelRender.threeObj = gltf.scene.clone(true);
  } else {
    (async () => {
      const gltf = await loadGltf(objModel.glbUrl);
      game.cache.gltfs.set(objModel.glbUrl, gltf);

      const loadedClonedModel = gltf.scene.clone(true);
      loadedClonedModel.position.copy(subObjModelRender.threeObj.position);
      loadedClonedModel.rotation.copy(subObjModelRender.threeObj.rotation);
      subObjModelRender.threeObj.removeFromParent();
      subObjModelRender.threeObj = loadedClonedModel;
      game.scene.add(loadedClonedModel);
    })();
  }
  game.scene.add(subObjModelRender.threeObj);

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
