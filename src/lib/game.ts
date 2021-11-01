import * as THREE from 'three';

import { GameECS, init as initECS } from './gameECS';

import { Realm, init as initRealm, addToScene as addRealmToScene, exportRealm } from './realm';
import { SpriteManager, init as initSpriteManager, createBaseSpriteObj, exportSprite } from './sprite';
import { changeRealm } from './update';

import { Player, create as createPlayer, addToRealm as addPlayerToRealm } from './player';
import { Input, create as createInput, startListeners } from './input';
import { Camera, init as initCamera, addToScene as addCameraToScene } from './camera';

import { Vec2 } from './utils/utils';

import { getChunk, getChunkEntityComponents, calcAltitudeInChunk } from './chunk/chunk';
import { CHUNK_SIZE } from './consts';
import Delatin from 'delatin';

const CHUNK_CELL_RESOLUTION = 8;
const CHUNK_RESOLUTION = CHUNK_CELL_RESOLUTION * CHUNK_SIZE + 1;
const CHUNK_POS_MULT = 1 / CHUNK_CELL_RESOLUTION;
const CHUNK_UV_MULT = 1 / CHUNK_RESOLUTION;
const CHUNK_XZ_POSITION_OFFSET = CHUNK_SIZE * -0.5;

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

    (window as any).run = () => {
      const d0 = new Delatin(Array(256).fill(0), 16, 16);
      d0.run(0.3);
      console.log('d0', d0.coords, d0.triangles);

      const chunkIJ: Vec2 = [0, 0];
      const chunk = getChunk([0, 0], game.realm.currentObj, game.ecs);

      // change some chunk cells to test flatness
      chunk.cells.get(4, 0).altitude = 2;
      chunk.cells.get(4, 0).flatness = 1;

      chunk.cells.get(5, 1).altitude = 3;
      chunk.cells.get(5, 1).flatness = 2;

      chunk.cells.get(6, 2).altitude = 1;
      chunk.cells.get(6, 2).flatness = 15;
      console.log('chunk cells change applied');

      const data = Array(CHUNK_RESOLUTION).fill(null).flatMap((_, j) => (
        Array(CHUNK_RESOLUTION).fill(null).map((_, i) => {
          const localPos: Vec2 = [i * CHUNK_POS_MULT, j * CHUNK_POS_MULT];
          const cellIJ = localPos.map(Math.floor) as Vec2;
          const cell = chunk.cells.get(...cellIJ);

          return calcAltitudeInChunk(localPos, {
            cellIJ, cell, chunkIJ, chunk,
          }, game.realm.currentObj, game.ecs);
        })
      ));

      console.log(data);
      const d1 = new Delatin(data, CHUNK_RESOLUTION, CHUNK_RESOLUTION);
      d1.run(0.005);
      console.log('d1', d1.coords, d1.triangles);

      const positions: number[] = [];
      const uvs: number[] = [];
      Array(d1.coords.length >> 1).fill(null).forEach((_, index) => {
        const i = d1.coords[index * 2];
        const j = d1.coords[index * 2 + 1];
        positions.push(
          i * CHUNK_POS_MULT + CHUNK_XZ_POSITION_OFFSET,
          d1.heightAt(i, j),
          j * CHUNK_POS_MULT + CHUNK_XZ_POSITION_OFFSET,
        );
        uvs.push(
          i * CHUNK_UV_MULT,
          j * CHUNK_UV_MULT,
        );
      });

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(
        new Float32Array(positions), 3,
      ));
      geometry.setAttribute('uv', new THREE.BufferAttribute(
        new Float32Array(uvs), 2,
      ));
      geometry.setIndex(d1.triangles);
      geometry.computeVertexNormals();

      console.log('normal', geometry.getAttribute('normal').array);
      console.log('indices', geometry.index.array);

      const material = new THREE.MeshPhongMaterial({
        map: game.loader.load('assets/ground.jpg'),
      });
      const wireframeMaterial = new THREE.MeshStandardMaterial({
        color: 'green',
        wireframe: true,
      });
      const mesh = new THREE.Mesh(geometry,
        material,
        //game.realm.baseMaterial
      );

      (window as any).mesh = mesh;

      getChunkEntityComponents([0, 0], game.realm.currentObj, game.ecs).get('chunk/render').mesh.removeFromParent();
      getChunkEntityComponents([1, 0], game.realm.currentObj, game.ecs).get('chunk/render').mesh.removeFromParent();

      game.scene.add(mesh);

      const mesh2 = new THREE.Mesh(geometry,
        wireframeMaterial,
      );

      mesh2.position.x = CHUNK_SIZE * 1;
      game.scene.add(mesh2);
    };
  }

  return game;
}
