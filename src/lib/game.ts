import * as THREE from 'three';

import { GameECS, init as initECS } from './gameECS';

import { Realm, init as initRealm, addToScene as addRealmToScene, exportRealm } from './realm';
import { SpriteManager, init as initSpriteManager, createBaseSpriteObj, exportSprite } from './sprite';
import { changeRealm } from './update';

import { Player, create as createPlayer, addToRealm as addPlayerToRealm } from './player';
import { Input, create as createInput, startListeners } from './input';
import { Camera, init as initCamera, addToScene as addCameraToScene } from './camera';

export interface Game {
  ecs: GameECS;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: Camera;
  realm: Realm;
  spriteManager: SpriteManager;
  player: Player;
  // networkAgent: Agent;
  input: Input,
  time: number;

  loader: THREE.TextureLoader;
}

export async function setup(): Promise<Game> {
  const ecs = initECS();

  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);

  const game: Game = {
    ecs,
    renderer,
    scene: new THREE.Scene,
    camera: initCamera(),
    realm: initRealm(ecs),
    spriteManager: initSpriteManager(),
    player: createPlayer(ecs),
    // networkAgent,
    input: createInput(),
    time: 0,
    loader: new THREE.TextureLoader(),
  }

  createBaseSpriteObj(game.ecs);

  addRealmToScene(game);
  addCameraToScene(game);
  addPlayerToRealm(game);
  startListeners(game);

  changeRealm(game);

  { // for development:
    (window as any).exportRealm = () => {
      exportRealm(game);
    };
    (window as any).exportSprite = () => {
      exportSprite(game);
    }
  }

  return game;
}
