import * as THREE from 'three';
import { Agent, BrowserConnManager } from 'unnamed-network';
import Game from './game';
import { create as createPlayer, addToRealm as addPlayerToRealm } from './player';
import { setup as setupInput } from './input';
import { create as createRealm, addToScene as addRealmToScene } from './realm';

export default function setup(): Game {
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  const cameraBase = new THREE.Object3D();

  const loader = new THREE.TextureLoader();

  cameraBase.add(camera);
  scene.add(cameraBase);
  camera.position.set(0, 0, 10);
  cameraBase.rotateX(60 * Math.PI / 180);
  //camera.ro

  const player = createPlayer();

  const connManager = new BrowserConnManager();
  const networkAgent = new Agent(connManager);

  const realm = createRealm();

  const game: Game = {
    renderer,
    scene, camera, cameraBase,
    realm,
    player,
    networkAgent,
    input: setupInput(renderer, camera, player),
    time: 0,
  }

  // ===============

  addRealmToScene(realm, loader, game);
  addPlayerToRealm(player, loader, game);

  // ===============

  return game;
}

