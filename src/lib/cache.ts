import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface Cache {
  gltfs: Map<string, GLTF>
}

export function init(): Cache {
  return {
    gltfs: new Map(),
  }
}
