import * as THREE from 'three';
import { Agent, BrowserConnManager } from 'unnamed-network';

import { GameECS, init as initECS } from './gameECS';

import { Realm as RealmV2, init as initRealm, addToScene as addRealmToScene } from './realm';

import { Player, create as createPlayer, addToRealm as addPlayerToRealm } from './player';
import { Input, create as createInput, startListeners } from './input';
import { Camera, init as initCamera, addToScene as addCameraToScene } from './camera';

export interface Game {
  ecs: GameECS;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: Camera;
  realm: RealmV2;
  player: Player;
  networkAgent: Agent;
  input: Input,
  time: number;

  loader: THREE.TextureLoader;
}

export async function setup(): Promise<Game> {
  const ecs = initECS();

  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = initCamera();

  const player = createPlayer(ecs);

  const connManager = new BrowserConnManager();
  const networkAgent = new Agent(connManager);

  const game: Game = {
    ecs,
    renderer,
    scene,
    camera,
    realm: initRealm(ecs),
    player,
    networkAgent,
    input: createInput(),
    time: 0,
    loader: new THREE.TextureLoader(),
  }

  addRealmToScene(game);
  addCameraToScene(camera, game);
  addPlayerToRealm(game);
  startListeners(game.input, game);

  return game;
}
