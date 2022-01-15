import * as THREE from 'three';

import type { Game } from '../game';
import type { GameEntityComponents } from '../gameECS';

import type { AttributeArrays } from './renderAttribute';

import { Vec2, Vec3, assertPresentOrWarn, vecCopyToThree } from '../utils/utils';
import { createCanvas2d } from '../utils/web';

import { CHUNK_SIZE, DRAW_CANVAS_SIZE } from '../consts';

export interface Editing {
  canvas2d: CanvasRenderingContext2D;
  material: THREE.MeshPhongMaterial;
}

export interface ChunkRenderComponent {
  mesh: THREE.Mesh;
  editing?: Editing;
}

const textureCache = new Map<string, THREE.Texture>();

export function addChunkMeshToScene(chunkEntityComponents: GameEntityComponents, chunkIJ: Vec2, attributeArrays: AttributeArrays, game: Game) {
  const chunk = chunkEntityComponents.get('chunk');
  if (assertPresentOrWarn([chunk], 'chunk/render.addChunkMeshToScene: chunk component not found')) return;
  let chunkRender = chunkEntityComponents.get('chunk/render');

  const geometry = new THREE.BufferGeometry();

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

  let material: THREE.Material | THREE.Material[];
  if (chunkRender?.editing) {
    material = chunkRender.mesh.material;
    setupGroupForMultiMaterial(geometry);
  } else if (chunk.textureUrl) {
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
    material = game.realm.brandNew ? game.realm.gridMaterial : game.realm.emptyMaterial;
  }

  if (chunkRender) {
    chunkRender.mesh.removeFromParent();
    chunkRender.mesh = new THREE.Mesh(geometry, material);
  } else {
    chunkRender = {
      mesh: new THREE.Mesh(geometry, material),
    };
    chunkEntityComponents.set('chunk/render', chunkRender);
  }

  addMeshToScene(chunkRender, chunkIJ, game);
}

function addMeshToScene(chunkRender: ChunkRenderComponent, chunkIJ: Vec2, game: Game) {
  vecCopyToThree(
    calcChunkMeshPosition(chunkIJ),
    chunkRender.mesh.position,
  );
  chunkRender.mesh.renderOrder = -1;
  game.scene.add(chunkRender.mesh);
}

export function calcChunkMeshPosition(chunkIJ: Vec2): Vec3 {
  return [chunkIJ[0] * CHUNK_SIZE, 0, chunkIJ[1] * CHUNK_SIZE];
}

export function editChunkCanvas2d(
  callback: (canvas2d: CanvasRenderingContext2D) => void,
  chunkEntityComponents: GameEntityComponents, game: Game,
) {
  const chunkRender = chunkEntityComponents.get('chunk/render');
  const mesh = chunkRender.mesh;

  if (!chunkRender.editing) {
    const canvas2d = createCanvas2d(DRAW_CANVAS_SIZE, DRAW_CANVAS_SIZE);

    if (mesh.material !== game.realm.gridMaterial) {
      canvas2d.drawImage(
        (mesh.material as THREE.MeshPhongMaterial).map.image,
        0, 0, DRAW_CANVAS_SIZE, DRAW_CANVAS_SIZE,
      );
    }

    const texture = new THREE.CanvasTexture(canvas2d.canvas);
    const material = new THREE.MeshPhongMaterial({
      map: texture,
      transparent: true,
    });

    mesh.material = [game.realm.gridMaterial, material];
    setupGroupForMultiMaterial(mesh.geometry);

    chunkRender.editing = {
      canvas2d, material
    }
  }

  const canvas2d = chunkRender.editing.canvas2d;

  callback(canvas2d);

  chunkRender.editing.material.map.needsUpdate = true;
}

export function updateChunkTextureUrl(chunkEntityComponents: GameEntityComponents, rmEditing: boolean = false) {
  const chunk = chunkEntityComponents.get('chunk');
  const chunkRender = chunkEntityComponents.get('chunk/render');
  if (!chunkRender?.editing) return;

  chunk.textureUrl = chunkRender.editing.canvas2d.canvas.toDataURL('image/png');

  if (rmEditing) {
    const material = (chunkRender.mesh.material as THREE.Material[])[1];
    chunkRender.mesh.material = material;
    resetGroupForSingleMaterial(chunkRender.mesh.geometry);
    delete chunkRender.editing;
  }
}

function setupGroupForMultiMaterial(geometry: THREE.BufferGeometry) {
  geometry.clearGroups();
  geometry.addGroup(0, geometry.index.count, 0);
  geometry.addGroup(0, geometry.index.count, 1);
}
function resetGroupForSingleMaterial(geometry: THREE.BufferGeometry) {
  geometry.clearGroups();
  geometry.addGroup(0, geometry.index.count, 0);
}

export function removeChunkMeshFromScene(chunkEntityComponents: GameEntityComponents) {
  const prevChunkRender = chunkEntityComponents.get('chunk/render');
  if (prevChunkRender) {
    prevChunkRender.mesh.removeFromParent();
  }
}
