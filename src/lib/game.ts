import * as THREE from 'three';
import { Agent, BrowserConnManager } from 'unnamed-network';
import { Player, create as createPlayer, addToRealm as addPlayerToRealm } from './player';
import { Input, create as createInput, startListeners } from './input';
import { Realm, create as createRealm, addToScene as addRealmToScene } from './realm';
import { Camera, create as createCamera } from './camera';

export interface Game {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: Camera;
  realm: Realm;
  player: Player;
  networkAgent: Agent;
  input: Input,
  time: number;
}

export async function setup(): Promise<Game> {
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  const loader = new THREE.TextureLoader();

  const scene = new THREE.Scene();
  const camera = createCamera();
  scene.add(camera.cameraBase);

  const player = createPlayer();

  const connManager = new BrowserConnManager();
  const networkAgent = new Agent(connManager);

  const realm = await createRealm();

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

  camera.cameraBase.position.y = player.mounting.sprite.position.y;

  // ===============

  return game;
}
