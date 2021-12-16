import * as THREE from 'three';
import Swiper, { Manipulation } from 'swiper';

import 'swiper/css';

import { Game } from './game';
import { GameEntityComponents } from './gameECS';
import { mountSubObj, movePlayerTo } from './player';
import { broadcastMyself } from './network';

import { getChunkEntityComponents, locateOrCreateChunkCell } from './chunk/chunk';
import { detectCollision, destroySubObj, createSubObj } from './subObj/subObj';

import { Vec2, sub, rangeVec2s, length, vec3To2 } from './utils/utils';

import { DRAW_CANVAS_SIZE } from './consts';

import '../styles/tools.css';

export type Tool = 'walk' | 'draw' | 'terrainHeight' | string;
export interface Tools {
  activeTool: Tool;
  swiper: Swiper;
  toolsBox: Tool[];
  raycaster: THREE.Raycaster;

  draw?: Draw;
}

interface Draw {
  swiper: Swiper;
  activeIndex: number;
  fillStyle: string;
  fillSize: number;
  eraser: boolean;
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
  game.tools.swiper.on('touchMove', () => {
    document.getElementById('tools-box').classList.add('zoom');
  });
  game.tools.swiper.on('touchEnd', () => {
    document.getElementById('tools-box').classList.remove('zoom');
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

  document.querySelectorAll('.top-toolbox.active').forEach(element => {
    element.classList.remove('active');
  });

  switch(game.tools.activeTool) {
    case 'draw':
      ensureDrawActivated(game);
      document.getElementById('draw-box').classList.add('active');
      break;
  }
}

export function setActiveTool(index: number, game: Game) {
  game.tools.swiper.slideToLoop(index);
  updateActiveTool(game);
}

function ensureDrawActivated(game: Game) {
  if (game.tools.draw) return;

  const topToolBoxesTemplate = document.getElementById('top-tools-boxes') as HTMLTemplateElement;

  const drawBoxDOM = topToolBoxesTemplate.content.querySelector('#draw-box').cloneNode(true) as HTMLElement;
  document.body.appendChild(drawBoxDOM);

  const initialSlide = 1;
  const draw: Draw = {
    swiper: new Swiper(drawBoxDOM.querySelector('.swiper') as HTMLElement, {
      modules: [Manipulation],
      slidesPerView: "auto",
      centeredSlides: true,
      slideToClickedSlide: true,
      initialSlide,
    }),
    activeIndex: initialSlide,
    fillStyle: 'black',
    fillSize: 3,
    eraser: false,
  }

  drawBoxDOM.querySelectorAll('input[type=color]').forEach((element: HTMLInputElement) => {
    element.addEventListener('click', event => {
      if (draw.activeIndex !== parseInt(element.dataset.slide)) {
        event.preventDefault();
      }
    });
    element.addEventListener('change', () => {
      updateDrawActiveBrush(game);
    });
  });

  draw.swiper.on('activeIndexChange', () => {
    setTimeout(() => {
      updateDrawActiveBrush(game);
    }, 100);
  });

  const drawSizeInput = drawBoxDOM.querySelector('#draw-size') as HTMLInputElement;
  drawSizeInput.addEventListener('change', () => {
    draw.fillSize = parseInt(drawSizeInput.value);
  });

  game.tools.draw = draw;
}

function updateDrawActiveBrush(game: Game) {
  const draw = game.tools.draw;
  draw.activeIndex = draw.swiper.activeIndex;

  const activeDOM = document.getElementById('draw-box')
    .querySelector('.swiper-wrapper')
    .children[draw.swiper.activeIndex] as HTMLElement;

  draw.eraser = !!activeDOM.dataset.eraser;
  if (draw.eraser) return;

  const colorInput = activeDOM.querySelector('input[type=color]') as HTMLInputElement;
  draw.fillStyle = colorInput.value;
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

  if (!chunkRender.editing && !Array.isArray(mesh.material)) {
    const canvas = document.createElement('canvas');

    canvas.width = DRAW_CANVAS_SIZE;
    canvas.height = DRAW_CANVAS_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (mesh.material !== game.realm.gridMaterial) {
      ctx.drawImage(
        (mesh.material as THREE.MeshPhongMaterial).map.image,
        0, 0, DRAW_CANVAS_SIZE, DRAW_CANVAS_SIZE,
      );
    }

    const texture = new THREE.CanvasTexture(ctx.canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    const material = new THREE.MeshPhongMaterial({
      map: texture,
      transparent: true,
    });

    mesh.material = [game.realm.gridMaterial, material];
    mesh.geometry.clearGroups();
    mesh.geometry.addGroup(0, mesh.geometry.index.count, 0);
    mesh.geometry.addGroup(0, mesh.geometry.index.count, 1);

    chunkRender.editing = {
      canvas, material
    }
  }

  const ctx = chunkRender.editing.canvas.getContext('2d');

  if (game.tools.draw.eraser) {
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.globalCompositeOperation = 'destination-out';
  } else {
    ctx.fillStyle = game.tools.draw.fillStyle;
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.beginPath();
  ctx.arc(
    DRAW_CANVAS_SIZE * uv[0], DRAW_CANVAS_SIZE * (1 - uv[1]),
    game.tools.draw.fillSize,
    0, 2 * Math.PI);
  ctx.fill();
  chunkRender.editing.material.map.needsUpdate = true;
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
