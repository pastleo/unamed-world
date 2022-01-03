import * as THREE from 'three';
import Swiper, { Manipulation } from 'swiper';

import 'swiper/css';

import type { Game } from './game';
import type { GameEntityComponents } from './gameECS';
import { mountSubObj, movePlayerTo, syncLocationToRealmSpawnLocation } from './player';
import { broadcastMyself } from './network';
import { afterSaved } from './realm';
import {
  ChunkDrawAction, ChunkTerrainAltitudeAction, AddSubObjAction,
  dispatchAction,
} from './action';
//import { buildSpriteFromCurrentRealm } from './objBuilder';
import { exportRealm, exportSprite } from './resource';

import type { ObjPath } from './obj/obj';
import {
  Located,
  getChunkEntityComponents, locateOrCreateChunkCell, calcCellLocation,
} from './chunk/chunk';
import { detectCollision, destroySubObj, createSubObj } from './subObj/subObj';

import { Vec2, sub, rangeVec2s, length, vec3To2, threeToVec3, vecCopyToThree } from './utils/utils';
import { setUrlHash } from './utils/web';

import '../styles/tools.css';

export type Tool = 'walk' | 'draw' | 'terrainAltitude' | 'options' | 'pin' | string;
export interface Tools {
  activeTool: Tool;
  swiper: Swiper;
  toolsBox: Tool[];
  raycaster: THREE.Raycaster;

  draw?: Draw;
  terrainAltitude?: TerrainAltitude;
  options?: Options;
}

interface SwiperTool {
  swiper: Swiper;
  activeIndex: number;
}

interface Draw {
  swiper: SwiperTool;
  fillStyle: string;
  fillSize: number;
  eraser: boolean;
  pickingColor: boolean;
}

interface TerrainAltitude {
  upCone: THREE.Mesh;
  downCone: THREE.Mesh;
  coneGroup: THREE.Object3D;
  selectedChunkCell?: Located;
}

interface Options {
  swiper: SwiperTool;
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
  terrainAltitude: '↕️',
  options: '⚙️',
  pin: '🚩',
}
const RAYCAST_CHUNK_RANGE = 4;

export function start(game: Game) {
  game.tools.swiper.on('activeIndexChange', () => {
    updateActiveTool(game);
  });
  game.tools.swiper.on('touchMove', () => {
    document.getElementById('main-toolbox').classList.add('zoom');
  });
  game.tools.swiper.on('touchEnd', () => {
    document.getElementById('main-toolbox').classList.remove('zoom');
  });

  const toolItemTemplate = document.getElementById('tools-item-template') as HTMLTemplateElement;

  const initTools = ['walk', 'draw', 'terrainAltitude', 'pin', 'options'];
  const toolCount = initTools.length;
  
  document.getElementById('main-toolbox').style.width = `${toolCount * 10}rem`;
  document.getElementById('main-toolbox').style.marginLeft = `${toolCount * -5}rem`;

  initTools.forEach(name => {
    const itemFrag = toolItemTemplate.content.cloneNode(true) as HTMLElement;
    const itemDom = itemFrag.querySelector('.swiper-slide') as HTMLDivElement;
    itemDom.textContent = TOOL_ICONS[name];

    game.tools.swiper.appendSlide(itemFrag);
    game.tools.toolsBox.push(name)
  });

  game.tools.swiper.removeSlide(0);
  updateActiveTool(game);
}

function updateActiveTool(game: Game) {
  const prevTool = game.tools.activeTool;
  game.tools.activeTool = game.tools.toolsBox[game.tools.swiper.realIndex];

  switch(game.tools.activeTool) {
    case 'draw':
      ensureDrawActivated(game);
      showDrawTool(game);
      break;
    case 'terrainAltitude':
      ensureTerrainAltitudeActivated(game);
      showTerrainAltitudeTool(game);
      break;
    case 'options':
      ensureOptionsActivated(game);
      showOptionsTool(game);
      break;
  }

  switch(prevTool) {
    case 'draw':
      hideDrawTool(game);
      break;
    case 'terrainAltitude':
      hideTerrainAltitudeTool(game);
      break;
    case 'options':
      hideOptionsTool(game);
      break;
  }
}

export function setActiveTool(index: number, game: Game) {
  game.tools.swiper.slideToLoop(index);
  updateActiveTool(game);
}

function addAndSwitchSpriteTool(spriteAsTool: Tool, game: Game) {
  const spriteToolName: Tool = `sprite/${spriteAsTool}`;
  if (game.tools.toolsBox.indexOf(spriteToolName) !== -1) return;

  const spriteObjComponents = game.ecs.getEntityComponents(game.ecs.fromSid(spriteAsTool));
  const spriteThumb = spriteObjComponents.get('obj/sprite').spritesheet;

  const toolSlideTemplate = document.getElementById('tools-item-sprite-obj-template') as HTMLTemplateElement;
  const toolSlideDOM = toolSlideTemplate.content.querySelector('.swiper-slide').cloneNode(true) as HTMLElement;
  const thumbDOM = toolSlideDOM.querySelector('.sprite-obj-thumb') as HTMLImageElement;
  thumbDOM.src = spriteThumb;

  const toolsCount = game.tools.toolsBox.push(spriteToolName);
  game.tools.swiper.appendSlide(toolSlideDOM);
  setActiveTool(toolsCount - 1, game);
}

function ensureDrawActivated(game: Game) {
  if (game.tools.draw) return;

  const topToolBoxesTemplate = document.getElementById('top-toolboxes') as HTMLTemplateElement;

  const drawBoxDOM = topToolBoxesTemplate.content.querySelector('#draw-box').cloneNode(true) as HTMLElement;
  document.body.appendChild(drawBoxDOM);

  const draw: Draw = {
    swiper: setupSwiperTool(drawBoxDOM, 1, 2, (_activeIndex, prevIndex) => {
      updateDrawActiveBrush(game, prevIndex);
    }),
    fillStyle: 'black',
    fillSize: 3,
    eraser: false,
    pickingColor: false,
  }

  drawBoxDOM.querySelectorAll('input[type=color]').forEach((colorInput: HTMLInputElement) => {
    colorInput.disabled = true;
    colorInput.addEventListener('click', () => {
      draw.pickingColor = true;
    });
    colorInput.addEventListener('change', () => {
      updateDrawActiveBrush(game);
    });
  });
  enableColorInput(drawBoxDOM, draw.swiper);

  const drawSizeInput = drawBoxDOM.querySelector('#draw-size') as HTMLInputElement;
  drawSizeInput.addEventListener('change', () => {
    draw.fillSize = parseInt(drawSizeInput.value);
  });

  game.tools.draw = draw;
}

function showDrawTool(game: Game) {
  document.getElementById('draw-box').classList.add('active');
  game.tools.draw.pickingColor = false;
}

function hideDrawTool(_game: Game) {
  document.getElementById('draw-box').classList.remove('active');
}

function updateDrawActiveBrush(game: Game, prevIndex?: number) {
  const draw = game.tools.draw;
  const drawBoxDOM = document.getElementById('draw-box');
  const swiperContainer = drawBoxDOM.querySelector('.swiper-wrapper') as HTMLElement;

  if (typeof prevIndex === 'number') {
    const prevColorInput = swiperContainer.children[prevIndex].querySelector('input');
    if (prevColorInput) {
      prevColorInput.disabled = true;
    }
  }
  const activeDOM = swiperContainer.children[draw.swiper.activeIndex] as HTMLElement;

  draw.eraser = !!activeDOM.dataset.eraser;
  if (draw.eraser) return;

  const colorInput = activeDOM.querySelector('input[type=color]') as HTMLInputElement;
  draw.fillStyle = colorInput.value;
  enableColorInput(drawBoxDOM, draw.swiper);
}

function enableColorInput(drawBoxDOM: HTMLElement, swiperTool: SwiperTool) {
  const activeDOM = drawBoxDOM.querySelector('.swiper-wrapper').children[swiperTool.activeIndex] as HTMLElement;
  const colorInput = activeDOM.querySelector('input[type=color]') as HTMLInputElement;
  colorInput.disabled = false;
}

function ensureTerrainAltitudeActivated(game: Game) {
  if (game.tools.terrainAltitude) return;

  const coneGroup = new THREE.Object3D();

  const upGeometry = new THREE.ConeGeometry(0.25, 0.5, 16);
  const upMaterial = new THREE.MeshPhongMaterial({ color: '#50ff76', emissive: '#90d39e' });
  const upCone = new THREE.Mesh(upGeometry, upMaterial);
  upCone.position.y = 1;
  coneGroup.add(upCone);

  const downGeometry = new THREE.ConeGeometry(0.25, 0.5, 16);
  const downMaterial = new THREE.MeshPhongMaterial({ color: '#ff6a6a', emissive: '#6e2f2f' });
  const downCone = new THREE.Mesh(downGeometry, downMaterial);
  downCone.position.y = 0.25;
  downCone.rotation.x = Math.PI;
  coneGroup.add(downCone);

  coneGroup.visible = false;
  game.scene.add(coneGroup);

  game.tools.terrainAltitude = {
    upCone, downCone, coneGroup
  }
}

function showTerrainAltitudeTool(_game: Game) {
}

function hideTerrainAltitudeTool(game: Game) {
  game.tools.terrainAltitude.coneGroup.visible = false;
}

function ensureOptionsActivated(game: Game) {
  if (game.tools.options) return;

  const topToolBoxesTemplate = document.getElementById('top-toolboxes') as HTMLTemplateElement;

  const optionsBoxDOM = topToolBoxesTemplate.content.querySelector('#options-box').cloneNode(true) as HTMLElement;
  document.body.appendChild(optionsBoxDOM);

  const saveActionDOM = optionsBoxDOM.querySelector('#save-action');
  const genActionDOM = optionsBoxDOM.querySelector('#gen-sprite');

  const options: Options = {
    swiper: setupSwiperTool(optionsBoxDOM, 0, 2, () => {}),
  }

  saveActionDOM.addEventListener('click', async () => {
    if (options.swiper.activeIndex !== 0) return;

    if (!confirm('Will Save and switch to the saved room / realm, proceed?')) return;

    game.realm.rmEditingWhileUpdateChunkTexture = true;
    syncLocationToRealmSpawnLocation(game);
    const realmObjPath = await exportRealm('local', game);
    game.realm.rmEditingWhileUpdateChunkTexture = false;

    if (realmObjPath) {
      afterSaved(realmObjPath, game);
      setUrlHash({ '': game.resource.savedRealmObjPath });
    }
  });
  genActionDOM.addEventListener('click', async () => {
    if (options.swiper.activeIndex !== 1) return;

    await exportRealm('local', game);
    //const spriteObj = buildSpriteFromCurrentRealm(game);
    //const spriteObjPath = await exportSprite('local', spriteObj, game);

    //addAndSwitchSpriteTool(spriteObjPath, game);
  });

  game.tools.options = options;
}

function showOptionsTool(_game: Game) {
  document.getElementById('options-box').classList.add('active');
}

function hideOptionsTool(_game: Game) {
  document.getElementById('options-box').classList.remove('active');
}

type InputType = 'down' | 'up' | 'move';
export function castMainTool(coordsPixel: Vec2, inputType: InputType, game: Game) {

  switch (game.tools.activeTool) {
    case 'walk':
      return castWalkTo(coordsPixel, inputType, game);
    case 'draw':
      return castDraw(coordsPixel, inputType, game);
    case 'terrainAltitude':
      return castTerrainAltitude(coordsPixel, inputType, game);
    case 'pin':
      return castPin(coordsPixel, inputType, game);
  }

  if (game.tools.activeTool.startsWith('sprite/')) {
    return castSpriteObj(coordsPixel, inputType, game);
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

  game.player.objEntity = nearBySubObj.obj;
  destroySubObj(game.player.subObjEntity, game);
  const newSubObj = createSubObj(game.player.objEntity, subObj.position, game, located);
  mountSubObj(newSubObj, game);
  broadcastMyself(game);
}

function castDraw(coordsPixel: Vec2, _inputType: InputType, game: Game) {
  if (game.tools.draw.pickingColor) {
    game.tools.draw.pickingColor = false;
    return;
  }

  const [intersect, chunkEntityComponents] = rayCastRealm(coordsPixel, game);
  if (!intersect) return;

  const uv: Vec2 = [intersect.uv.x, intersect.uv.y];

  const action: ChunkDrawAction = {
    type: 'chunk-draw',
    chunkIJ: chunkEntityComponents.get('chunk').chunkIJ,
    erasing: game.tools.draw.eraser,
    color: game.tools.draw.fillStyle,
    uv,
    radius: game.tools.draw.fillSize,
  };
  dispatchAction(action, game);
}

function castTerrainAltitude(coordsPixel: Vec2, inputType: InputType, game: Game) {
  if (inputType !== 'up') return;
  const terrainAltitude = game.tools.terrainAltitude;

  if (terrainAltitude.selectedChunkCell) {
    const coneIntersect = rayCast(
      coordsPixel,
      [terrainAltitude.upCone, terrainAltitude.downCone],
      game,
    );

    if (coneIntersect) {
      const upClicked = coneIntersect.object.id === terrainAltitude.upCone.id;
      const adjustment = upClicked ? 0.2 : -0.2;

      const action: ChunkTerrainAltitudeAction = {
        type: 'chunk-terrainAltitude',
        chunkIJ: terrainAltitude.selectedChunkCell.chunkIJ,
        cellIJ: terrainAltitude.selectedChunkCell.cellIJ,
        altitudeAdjustment: adjustment,
        flatness: 4,
        range: 0,
      };
      terrainAltitude.coneGroup.position.y += adjustment;
      return dispatchAction(action, game);
    }
  }

  const [realmIntersect] = rayCastRealm(coordsPixel, game);
  if (!realmIntersect) return;
  
  const located = locateOrCreateChunkCell(threeToVec3(realmIntersect.point), game);

  const conePosition = calcCellLocation(located);

  vecCopyToThree(conePosition, terrainAltitude.coneGroup.position);
  terrainAltitude.coneGroup.position.y = located.cell.altitude;
  terrainAltitude.coneGroup.visible = true;
  terrainAltitude.selectedChunkCell = located;
}

function castPin(coordsPixel: Vec2, inputType: InputType, game: Game) {
  if (inputType !== 'up') return;

  //const spriteObjPath: ObjPath = game.tools.activeTool.replace(/^sprite\//, '');
  //const spriteObjAsTool = game.ecs.fromSid(spriteObjPath);
  const [realmIntersect] = rayCastRealm(coordsPixel, game);
  if (!realmIntersect) return;

  const newSubObj = game.ecs.allocate();
  const sid = game.ecs.getOrAddPrimarySid(newSubObj);
  const action: AddSubObjAction = {
    type: 'subObj-add',
    sid, obj: 'pin',
    position: threeToVec3(realmIntersect.point),
  }

  dispatchAction(action, game);
}

function castSpriteObj(coordsPixel: Vec2, inputType: InputType, game: Game) {
  if (inputType !== 'up') return;

  const spriteObjPath: ObjPath = game.tools.activeTool.replace(/^sprite\//, '');
  const spriteObjAsTool = game.ecs.fromSid(spriteObjPath);
  const [realmIntersect] = rayCastRealm(coordsPixel, game);
  if (!realmIntersect || !spriteObjAsTool) return;

  const newSubObj = game.ecs.allocate();
  const sid = game.ecs.getOrAddPrimarySid(newSubObj);
  const action: AddSubObjAction = {
    type: 'subObj-add',
    sid, obj: spriteObjPath,
    position: threeToVec3(realmIntersect.point),
  }

  dispatchAction(action, game);
}



function rayCastRealm(coordsPixel: Vec2, game: Game): [intersect: THREE.Intersection, chunkEntityComponents: GameEntityComponents] {
  const chunkMeshes = rangeVec2s(game.player.chunkIJ, RAYCAST_CHUNK_RANGE).map(chunkIJ => (
    getChunkEntityComponents(chunkIJ, game.realm.currentObj, game.ecs)
  )).map(chunkEntityComponents => ([
    chunkEntityComponents
      ?.get('chunk/render')
      ?.mesh,
    chunkEntityComponents,
  ] as [THREE.Mesh, GameEntityComponents])).filter(([m, _]) => m);

  const intersect = rayCast(coordsPixel, chunkMeshes.map(([m, _]) => m), game);
  if (!intersect) return [null, null];

  const [_, chunkEntityComponents] = chunkMeshes.find(([m, _]) => m.id === intersect.object.id);
  return [intersect, chunkEntityComponents]
}

function rayCast(coordsPixel: Vec2, objs: THREE.Object3D[], game: Game): THREE.Intersection {
  const coords: Vec2 = [
    (coordsPixel[0] / game.renderer.domElement.width) * 2 - 1,
    (coordsPixel[1] / game.renderer.domElement.height) * -2 + 1,
  ];

  const raycaster = game.tools.raycaster;
  raycaster.setFromCamera({ x: coords[0], y: coords[1] }, game.camera.camera);
  const intersects = raycaster.intersectObjects(objs);
  return intersects[0];
}

function setupSwiperTool(
  boxDOM: HTMLElement, initialSlide: number, slidesToShow: number,
  onUpdate: (activeIndex: number, prevIndex: number) => void
): SwiperTool {
  boxDOM.style.width = `${slidesToShow * 10}rem`;
  boxDOM.style.marginLeft = `${slidesToShow * -5}rem`;

  const swiperTool: SwiperTool = {
    swiper: new Swiper(boxDOM.querySelector('.swiper') as HTMLElement, {
      modules: [Manipulation],
      slidesPerView: "auto",
      centeredSlides: true,
      slideToClickedSlide: true,
      initialSlide,
    }),
    activeIndex: initialSlide,
  }
  swiperTool.swiper.on('activeIndexChange', () => {
    setTimeout(() => {
      const prevIndex = swiperTool.activeIndex;
      swiperTool.activeIndex = swiperTool.swiper.activeIndex;
      onUpdate(swiperTool.activeIndex, prevIndex);
    }, 100);
  });

  return swiperTool;
}
