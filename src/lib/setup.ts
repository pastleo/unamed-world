import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Agent, BrowserConnManager } from 'unnamed-network';
import Game, { Player } from './game';

export default function setup(): Game {
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

  const loader = new THREE.TextureLoader();

  const controls = new OrbitControls(camera, renderer.domElement);

  camera.position.set(0, -3.5, 5);

  const light = new THREE.DirectionalLight(0xFFFFFF, 1);
  light.position.set(-1, 2, 4);
  scene.add(light);

  const player = createPlayer(loader);
  scene.add(player.sprite);

  controls.target = player.sprite.position;
  controls.update();

  const terrain = createTerrain(loader);
  scene.add(terrain);

  const connManager = new BrowserConnManager();
  const networkAgent = new Agent(connManager);

  return {
    renderer,
    scene, camera,
    light,
    objects: {
      player,
    },
    controls,
    networkAgent,
    keyPressed: new Set(),
    time: 0,
  }
}

function createTerrain(loader: THREE.TextureLoader): THREE.Mesh {

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

function createPlayer(loader: THREE.TextureLoader): Player {
  const playerMaterial = new THREE.SpriteMaterial({
    map: loader.load('assets/hero.png', texture => {
      texture.repeat.set(1/6, 1/5);
      texture.offset.set(0, 1/5 * 4);
      texture.magFilter = THREE.NearestFilter;
    })
    //color: 0x44aa88
  });
  const sprite = new THREE.Sprite(playerMaterial);
  sprite.position.z = 0.5;

  return {
    sprite,
    state: 0,
  }
}
