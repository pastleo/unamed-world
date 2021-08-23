import * as THREE from 'three';

export function create(loader: THREE.TextureLoader): THREE.Mesh {

  const planeSize = 512;
  const geometry = new THREE.PlaneGeometry(planeSize, planeSize, planeSize, planeSize);
  (window as any).geometry = geometry;
  const material = new THREE.MeshBasicMaterial({
    map: loader.load('assets/small-rocks.png', texture => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
    }),
  });

  {
    const attribute = geometry.attributes.position;
    const newArray = new Float32Array(attribute.array.length);
    for (let i = 0; i <= attribute.count; i++) {
      newArray[i * 3] = attribute.array[i * 3];
      newArray[i * 3 + 1] = attribute.array[i * 3 + 1];
      newArray[i * 3 + 2] = attribute.array[i * 3 + 2] + Math.random() * 0.3 - 0.15;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(newArray, attribute.itemSize));
  }

  {
    const attribute = geometry.attributes.uv;
    const newArray = new Float32Array(attribute.array.length);
    for (let i = 0; i <= attribute.count; i++) {
      newArray[i * 2] = attribute.array[i * 2] * planeSize / 2 + Math.random() * 0.25 - 0.0125;
      newArray[i * 2 + 1] = attribute.array[i * 2 + 1] * planeSize / 2 + Math.random() * 0.25 - 0.0125;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(newArray, attribute.itemSize));
  }

  const terrain = new THREE.Mesh(geometry, material);

  return terrain;
}
