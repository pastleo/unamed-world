import * as THREE from 'three';
import Swiper, { Manipulation } from 'swiper';

import 'swiper/css';

import { Game } from './game';
import { GameEntityComponents } from './gameECS';
import { mountSubObj, movePlayerTo } from './player';
import { broadcastMyself } from './network';

import { getChunkEntityComponents, locateOrCreateChunkCell } from './chunk/chunk';
import { detectCollision, destroySubObj, createSubObj } from './subObj/subObj';

import { Vec2, Vec3, sub, rangeVec2s, length, vec3To2 } from './utils/utils';

import '../styles/tools.css';

export type Tool = 'walk' | 'draw' | 'terrainHeight' | string;
export interface Tools {
  activeTool: Tool;
  swiper: Swiper;
  toolsBox: Tool[];
  raycaster: THREE.Raycaster;
}

export function create(): Tools {
  const swiper = new Swiper(document.getElementById('tools-swiper'), {
    modules: [Manipulation],
    slidesPerView: "auto",
    centeredSlides: true,
    slideToClickedSlide: true,
    loopAdditionalSlides: 3,
    loop: true,
  });

  return {
    activeTool: '',
    swiper,
    toolsBox: [],
    raycaster: new THREE.Raycaster(),
  }
}

const TOOL_ICONS: Record<Tool, string> = {
  walk: '🚶',
  draw: '✍️',
  //terrainHeight: '↕️',
  terrainHeight: '🚧', // WIP
}
const RAYCAST_CHUNK_RANGE = 4;

export function start(game: Game) {
  game.tools.swiper.on('activeIndexChange', () => {
    updateActiveTool(game);
  });

  const toolItemTemplate = document.getElementById('tools-item-template') as HTMLTemplateElement;

  const initTools = ['walk', 'draw', 'terrainHeight'];
  const toolCount = initTools.length;
  
  document.getElementById('tools-box').style.width = `${toolCount * 10}rem`;
  document.getElementById('tools-box').style.marginLeft = `${toolCount * -5}rem`;

  initTools.forEach(name => {
    const itemFrag = toolItemTemplate.content.cloneNode(true) as HTMLElement;
    const itemDom = itemFrag.querySelector('.swiper-slide') as HTMLDivElement;
    itemDom.textContent = TOOL_ICONS[name];
    itemDom.dataset.name = name;

    game.tools.swiper.appendSlide(itemFrag);
    game.tools.toolsBox.push(name)
  });

  game.tools.swiper.removeSlide(0);
  updateActiveTool(game);
}

function updateActiveTool(game: Game) {
  game.tools.activeTool = game.tools.toolsBox[game.tools.swiper.realIndex];
}

export function setActiveTool(index: number, game: Game) {
  game.tools.swiper.slideToLoop(index);
  updateActiveTool(game);
}

type InputType = 'down' | 'up' | 'move';
export function castMainTool(coordsPixel: Vec2, inputType: InputType, game: Game) {

  switch (game.tools.activeTool) {
    case 'walk':
      return castWalkTo(coordsPixel, inputType, game);
    case 'draw':
      return castDraw(coordsPixel, inputType, game);
    case 'terrainHeight':
      return console.log('castMainTool: terrainHeight not implemented');
  }
}

function castWalkTo(coordsPixel: Vec2, inputType: InputType, game: Game) {
  if (inputType !== 'up') return;

  const [intersect] = rayCastRealm(coordsPixel, game);
  if (!intersect) return;

  const location: Vec2 = [intersect.point.x, intersect.point.z];


  const subObjComps = game.ecs.getEntityComponents(game.player.subObjEntity);
  const subObj = subObjComps.get('subObj');
  const objSprite = game.ecs.getComponent(subObj.obj, 'obj/sprite');

  const locationDistance = length(sub(location, vec3To2(subObj.position)));

  if (locationDistance > objSprite.radius * 2) {
    return movePlayerTo(location, game);
  }

  const located = locateOrCreateChunkCell(subObj.position, game);
  const nearBySubObjs = detectCollision(subObjComps.entity, located.chunkIJ, game);
  if (nearBySubObjs.length <= 0) return;

  const nearBySubObj = game.ecs.getComponent(nearBySubObjs[0], 'subObj');
  const targetObjSprite = game.ecs.getComponent(nearBySubObj.obj, 'obj/sprite');

  const distanceBetweenSubObj = length(
    sub(vec3To2(nearBySubObj.position), location)
  );

  if (distanceBetweenSubObj > targetObjSprite.radius) return;

  console.log('changing to', game.ecs.getUUID(nearBySubObj.obj));

  game.player.objEntity = nearBySubObj.obj;
  destroySubObj(game.player.subObjEntity, game);
  const newSubObj = createSubObj(game.player.objEntity, subObj.position, game, located);
  mountSubObj(newSubObj, game);
  broadcastMyself(game);
}

function castDraw(coordsPixel: Vec2, _inputType: InputType, game: Game) {
  const [intersect, chunkEntityComponents] = rayCastRealm(coordsPixel, game);
  if (!intersect) return;

  const uv: Vec2 = [intersect.uv.x, intersect.uv.y];
  const mesh = intersect.object as THREE.Mesh;
  const chunkRender = chunkEntityComponents.get('chunk/render');

  if (!chunkRender.canvas) {
    const canvas = document.createElement('canvas');
    chunkRender.canvas = canvas;

    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'black';

    const texture = new THREE.CanvasTexture(ctx.canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    mesh.material = new THREE.MeshPhongMaterial({
      map: texture,
      transparent: true,
    });
  }

  const ctx = chunkRender.canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(512 * uv[0], 512 * (1 - uv[1]), 1, 0, 2 * Math.PI);
  ctx.fill();
  (mesh.material as THREE.MeshPhongMaterial).map.needsUpdate = true;
}

function rayCastRealm(coordsPixel: Vec2, game: Game): [intersect: THREE.Intersection, chunkEntityComponents: GameEntityComponents] {
  const coords: Vec2 = [
    (coordsPixel[0] / game.renderer.domElement.width) * 2 - 1,
    (coordsPixel[1] / game.renderer.domElement.height) * -2 + 1,
  ];

  const raycaster = game.tools.raycaster;
  raycaster.setFromCamera({ x: coords[0], y: coords[1] }, game.camera.camera);
  
  const chunkMeshes = rangeVec2s(game.player.chunkIJ, RAYCAST_CHUNK_RANGE).map(chunkIJ => (
    getChunkEntityComponents(chunkIJ, game.realm.currentObj, game.ecs)
  )).map(chunkEntityComponents => ([
    chunkEntityComponents
      ?.get('chunk/render')
      ?.mesh,
    chunkEntityComponents,
  ] as [THREE.Mesh, GameEntityComponents])).filter(([m, _]) => m);

  const intersects = raycaster.intersectObjects(chunkMeshes.map(([m, _]) => m));
  if (intersects.length <= 0) return [null, null];

  const [_, chunkEntityComponents] = chunkMeshes.find(([m, _]) => m.id === intersects[0].object.id);
  return [intersects[0], chunkEntityComponents]
}
