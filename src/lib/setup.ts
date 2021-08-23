import * as THREE from 'three';
import { Agent, BrowserConnManager } from 'unnamed-network';
import Game from './game';
import { create as createPlayer } from './player';
import { setup as setupInput } from './input';
import { create as createTerrain } from './terrain';

export default function setup(): Game {
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

  const loader = new THREE.TextureLoader();

  camera.position.set(0, -3.5, 5);

  const light = new THREE.DirectionalLight(0xFFFFFF, 1);
  light.position.set(-1, 2, 4);
  scene.add(light);

  const player = createPlayer(loader);
  scene.add(player.sprite);

  const terrain = createTerrain(loader);
  scene.add(terrain);

  const connManager = new BrowserConnManager();
  const networkAgent = new Agent(connManager);

  return {
    renderer,
    scene, camera,
    light,
    player,
    networkAgent,
    input: setupInput(renderer, camera, player),
    time: 0,
  }
}

