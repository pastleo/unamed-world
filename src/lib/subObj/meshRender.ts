import * as THREE from 'three';

import { Game } from '../game';

import { EntityRef } from '../utils/ecs';
import { warnIfNotPresent } from '../utils/utils';

export interface SubObjMeshRenderComponent {
  mesh: THREE.Mesh;
}

export function addMeshToScene(subObjEntity: EntityRef, game: Game, refresh: boolean = false) {
  const subObjComponents = game.ecs.getEntityComponents(subObjEntity);
  const subObj = subObjComponents.get('subObj');
  if (warnIfNotPresent(subObj)) return;
  const objMesh = game.ecs.getComponent(subObj.obj, 'obj/mesh');
  if (!objMesh) return;

  let subObjMeshRender = subObjComponents.get('subObj/meshRender');
  if (subObjMeshRender) {
    if (refresh) {
      subObjMeshRender.mesh.removeFromParent();
    } else {
      return;
    }
  }

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const mesh = new THREE.Mesh(geometry, material);
  game.scene.add(mesh);

  subObjMeshRender = { mesh };
  game.ecs.setComponent(subObjEntity, 'subObj/meshRender', subObjMeshRender);
}

export function updateMeshPosition(subObjEntity: EntityRef, game: Game) {
  const subObjMeshRender = game.ecs.getComponent(subObjEntity, 'subObj/meshRender');

  if (!subObjMeshRender) return;
  const subObj = game.ecs.getComponent(subObjEntity, 'subObj');
  //const objSprite = getObjOrBaseComponents(subObj.obj, game.ecs).get('obj/sprite');;
  //if (warnIfNotPresent(subObj, objSprite)) return;

  subObjMeshRender.mesh.position.x = subObj.position[0];
  subObjMeshRender.mesh.position.y = subObj.position[1] + subObj.groundAltitude + 0.5;
  subObjMeshRender.mesh.position.z = subObj.position[2];

  subObjMeshRender.mesh.rotation.y = subObj.rotation[1];
}
