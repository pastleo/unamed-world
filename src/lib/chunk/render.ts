import * as THREE from 'three';

import { Game } from '../game';
import { AttributeArrays } from './renderAttribute';

import { GameEntityComponents } from '../gameECS';
import { Vec2, warnIfNotPresent } from '../utils/utils';

import { CHUNK_SIZE } from '../consts';

export interface ChunkRenderComponent {
  mesh: THREE.Mesh;
}

const textureCache = new Map<string, THREE.Texture>();

export function addChunkMeshToScene(chunkEntityComponents: GameEntityComponents, chunkIJ: Vec2, attributeArrays: AttributeArrays, game: Game) {
  const chunk = chunkEntityComponents.get('chunk');
  if (warnIfNotPresent(chunk)) return;

  const geometry = new THREE.BufferGeometry();

  let material: THREE.Material;
  if (chunk.textureUrl) {
    let texture = textureCache.get(chunk.textureUrl);

    if (!texture) {
      texture = game.loader.load(chunk.textureUrl);
      textureCache.set(chunk.textureUrl, texture);
    }
    material = new THREE.MeshPhongMaterial({
      map: texture,
      transparent: true,
    });
  } else {
    material = game.realm.baseMaterial;
  }

  geometry.setAttribute('position',
    new THREE.Float32BufferAttribute(attributeArrays.positions, 3),
  );
  geometry.setAttribute('uv',
    new THREE.Float32BufferAttribute(attributeArrays.uvs, 2),
  );
  geometry.setAttribute('normal',
    new THREE.Float32BufferAttribute(attributeArrays.normals, 3),
  );
  geometry.setIndex(
    new THREE.Uint16BufferAttribute(attributeArrays.indices, 1)
  );

  let chunkRender = chunkEntityComponents.get('chunk/render');
  if (chunkRender) {
    chunkRender.mesh.removeFromParent();
    chunkRender.mesh = new THREE.Mesh(geometry, material);
  } else {
    chunkRender = {
      mesh: new THREE.Mesh(geometry, material),
    };
    chunkEntityComponents.set('chunk/render', chunkRender);
  }

  chunkRender.mesh.position.x = chunkIJ[0] * CHUNK_SIZE;
  chunkRender.mesh.position.z = chunkIJ[1] * CHUNK_SIZE;
  chunkRender.mesh.renderOrder = -1;
  game.scene.add(chunkRender.mesh);
}

export function removeChunkMeshFromScene(chunkEntityComponents: GameEntityComponents) {
  const prevChunkRender = chunkEntityComponents.get('chunk/render');
  if (prevChunkRender) {
    prevChunkRender.mesh.removeFromParent();
  }
}
