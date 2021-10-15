import * as THREE from 'three';
import { Game } from '../game';
import { EntityRef } from '../utils/ecs';
import { Vec2, warnIfNotPresent } from '../utils/utils';
import { AttributeArrays } from '../obj/chunk';

import { CHUNK_SIZE } from '../consts';

export interface ChunkRenderComponent {
  mesh: THREE.Mesh;
}

const chunkMaterialCache = new Map<string, THREE.MeshBasicMaterial>();

export function createChunkMesh(chunkEntity: EntityRef, chunkIJ: Vec2, attributeArrays: AttributeArrays, game: Game) {
  const chunk = game.ecs.getComponent(chunkEntity, 'chunk');
  if (warnIfNotPresent(chunk)) return;

  const geometry = new THREE.BufferGeometry();

  let material: THREE.MeshBasicMaterial;
  const cachedMaterial = chunkMaterialCache.get(chunk.textureUrl);
  if (cachedMaterial) {
    material = cachedMaterial;
  } else {
    material = new THREE.MeshBasicMaterial({
      map: game.loader.load(chunk.textureUrl, texture => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
      }),
    });
    chunkMaterialCache.set(chunk.textureUrl, material);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(
    new Float32Array(attributeArrays.positions),
    3,
  ));
  geometry.setAttribute('uv', new THREE.BufferAttribute(
    new Float32Array(attributeArrays.uvs),
    2,
  ));

  let chunkRender = game.ecs.getComponent(chunkEntity, 'chunk/render');
  if (chunkRender) {
    chunkRender.mesh.removeFromParent();
    chunkRender.mesh = new THREE.Mesh(geometry, material);
  } else {
    chunkRender = {
      mesh: new THREE.Mesh(geometry, material),
    };
    game.ecs.setComponent(chunkEntity, 'chunk/render', chunkRender);
  }

  chunkRender.mesh.position.x = chunkIJ[0] * CHUNK_SIZE;
  chunkRender.mesh.position.z = chunkIJ[1] * CHUNK_SIZE;
  game.scene.add(chunkRender.mesh);
}
