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

import { Player, create as createPlayer, addToRealm as addPlayerToRealm, restorePlayerObj } from './player';
import { UI, create as createUI, start as startUI } from './ui/ui';
import { Tools, create as createTools, start as startTools } from './tools';
import { Input, create as createInput, startListeners } from './input';
import { Camera, init as initCamera, addToScene as addCameraToScene } from './camera';
import type { ObjBuilder } from './objBuilder';
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
  ui: UI;
  tools: Tools;
  resource: ResourceManager;
  network: Networking;
  input: Input;
  cache: Cache;
  time: number;

  loader: THREE.TextureLoader;

  ipfs?: IPFS;
  objBuilder?: ObjBuilder;
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
    ui: createUI(),
    tools: createTools(),
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
  startListeners(game);

  await startTools(game);
  await startResourceManager(game);
  await startUI(game);

  changeRealm(game);
  restorePlayerObj(game);

  if (DBG_MODE) {
    (window as any).getChunk = (...ij: Vec2) => (
      getChunk(ij, game.realm.currentObj, game.ecs)
    );
  }

  return game;
}
