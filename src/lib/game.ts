import * as THREE from 'three';
import type { IPFS } from 'ipfs-core';

import { getChunk } from './chunk/chunk';

import { GameECS, init as initECS } from './gameECS';
import { Realm, init as initRealm, addToScene as addRealmToScene } from './realm';
import { createBuiltInObjs } from './builtInObj';
import { changeRealm } from './update';

import { Networking, init as initNetworking } from './network';
import {
  ResourceManager, init as initResourceManager, start as startResourceManager,
} from './resource';

import { Player, create as createPlayer, addToRealm as addPlayerToRealm } from './player';
import { Tools, create as createTools, start as startTools } from './tools';
import { Input, create as createInput, startListeners } from './input';
import { Camera, init as initCamera, addToScene as addCameraToScene } from './camera';
import { Cache, init as initCache } from './cache';

import type { Vec2 } from './utils/utils';

import { DBG_MODE } from './dbg';

import '../styles/body.css';

export interface Game {
  ecs: GameECS;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: Camera;
  realm: Realm;
  player: Player;
  tools: Tools;
  ipfs: IPFS;
  resource: ResourceManager;
  network: Networking;
  input: Input;
  cache: Cache;
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
    player: createPlayer(ecs),
    tools: createTools(),
    ipfs: null,
    resource: initResourceManager(),
    network: initNetworking(),
    input: createInput(),
    cache: initCache(),
    time: 0,
    loader: new THREE.TextureLoader(),
  }

  document.body.appendChild(renderer.domElement);

  createBuiltInObjs(game.ecs);
  addRealmToScene(game);
  addCameraToScene(game);
  addPlayerToRealm(game);
  startTools(game);
  startListeners(game);

  await startResourceManager(game);

  changeRealm(game);

  if (DBG_MODE) {
    (window as any).getChunk = (...ij: Vec2) => (
      getChunk(ij, game.realm.currentObj, game.ecs)
    );
  }

  return game;
}
