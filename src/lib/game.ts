import * as THREE from 'three';
import type { IPFS } from 'ipfs-core';

import { getChunk } from './chunk/chunk';

import { GameECS, init as initECS } from './gameECS';
import { Realm, init as initRealm, addToScene as addRealmToScene } from './realm';
import { SpriteManager, init as initSpriteManager, createBaseSpriteObj } from './sprite';
import { changeRealm } from './update';

import { Networking, init as initNetworking } from './network';
import {
  StorageManager, init as initStorageManager, start as startStorageManager,
} from './storage';

import { Player, create as createPlayer, addToRealm as addPlayerToRealm } from './player';
import { Tools, create as createTools, start as startTools } from './tools';
import { Input, create as createInput, startListeners } from './input';
import { Camera, init as initCamera, addToScene as addCameraToScene } from './camera';

import { Vec2 } from './utils/utils';

import { DBG_MODE } from './dbg';

import '../styles/body.css';

export interface Game {
  ecs: GameECS;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: Camera;
  realm: Realm;
  spriteManager: SpriteManager;
  player: Player;
  tools: Tools;
  ipfs: IPFS;
  storage: StorageManager;
  network: Networking;
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
    scene: new THREE.Scene(),
    camera: initCamera(),
    realm: initRealm(ecs),
    spriteManager: initSpriteManager(),
    player: createPlayer(ecs),
    tools: createTools(),
    ipfs: null,
    storage: initStorageManager(),
    network: initNetworking(),
    input: createInput(),
    time: 0,
    loader: new THREE.TextureLoader(),
  }

  createBaseSpriteObj(game.ecs);
  document.body.appendChild(renderer.domElement);

  addRealmToScene(game);
  addCameraToScene(game);
  addPlayerToRealm(game);
  startTools(game);
  startListeners(game);

  await startStorageManager(game);

  changeRealm(game);

  if (DBG_MODE) {
    (window as any).getChunk = (...ij: Vec2) => (
      getChunk(ij, game.realm.currentObj, game.ecs)
    );
  }

  return game;
}
