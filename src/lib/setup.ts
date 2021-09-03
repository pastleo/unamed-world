import * as THREE from 'three';
import { Agent, BrowserConnManager } from 'unnamed-network';
import Game from './game';
import { create as createPlayer, addToRealm as addPlayerToRealm } from './player';
import { create as createInput, startListeners } from './input';
import { create as createRealm, addToScene as addRealmToScene } from './realm';
import { create as createCamera } from './camera';

export default function setup(): Game {
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  const loader = new THREE.TextureLoader();

  const scene = new THREE.Scene();
  const camera = createCamera();
  scene.add(camera.cameraBase);

  const player = createPlayer();

  const connManager = new BrowserConnManager();
  const networkAgent = new Agent(connManager);

  const realm = createRealm();

  const game: Game = {
    renderer,
    scene,
    camera,
    realm,
    player,
    networkAgent,
    input: createInput(),
    time: 0,
  }

  // ===============

  addRealmToScene(realm, loader, game);
  addPlayerToRealm(player, loader, game);
  startListeners(game.input, game);

  // ===============

  return game;
}

