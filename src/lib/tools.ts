import * as THREE from 'three';
import localForage from 'localforage';

import type { Game } from './game';
import type { GameEntityComponents } from './gameECS';
import {
  changePlayerObj, movePlayerAddRelative, movePlayerTo,
  syncLocationToRealmSpawnLocation, showMeleeRange,
} from './player';
import { cameraRotationY, vecAfterCameraRotation } from './camera';
import { afterSaved } from './realm';
import {
  ChunkDrawAction, ChunkTerrainAltitudeAction, DamageSubObjAction,
  dispatchAction, dispatchAddSubObjAction,
} from './action';
import { ensureStarted as ensureObjBuilderStarted } from './objBuilder';
import { exportRealm, importRealm, addSavedObj } from './resource';
import { calcJsonCid } from './ipfs';

import { openJson } from './utils/web';

import type { ObjPath } from './obj/obj';
import {
  Located,
  getChunkEntityComponents, locateOrCreateChunkCell, calcCellLocation,
} from './chunk/chunk';
import {
  SubObjComponent, getThreeObj,
  subObjInChunkRange, makeSubObjFacing,
} from './subObj/subObj';

import {
  Vec2, sub, rangeVec2s, length, multiply,
  vec3To2, threeToVec3, vecCopyToThree,
  relativeToRad, timeoutPromise,
} from './utils/utils';
import { EntityRef, entityEqual } from './utils/ecs';

import { USER_TOOLS_STORAGE_NAME } from './consts';

export type Tool = 'melee' | 'draw' | 'terrainAltitude' | 'options' | 'pin' | string;
export interface Tools {
  activeTool: Tool;
  toolsBox: Tool[];
  userTools: Tool[];
  raycaster: THREE.Raycaster;

  draw: Draw;
  terrainAltitude?: TerrainAltitude;
}

interface Draw {
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

const RAYCAST_CHUNK_RANGE = 4;
const BUILTIN_TOOLS: Tool[] = ['pin', 'melee', 'draw', 'terrainAltitude', 'options'];

export function create(): Tools {
  return {
    activeTool: 'melee',
    toolsBox: BUILTIN_TOOLS,
    userTools: [],
    raycaster: new THREE.Raycaster(),

    draw: createDraw(),
  }
}

function createDraw(): Draw {
  return {
    fillStyle: '#000000',
    fillSize: 16,
    eraser: false,
    pickingColor: false,
  }
}

export async function start(game: Game) {
  const userTools = await localForage.getItem<Tool[]>(USER_TOOLS_STORAGE_NAME) || [];
  game.tools.userTools = userTools;

  await updateMainToolbox(game);
}

export function setActiveTool(indexOrTool: number | Tool, game: Game) {
  const index = typeof indexOrTool === 'number' ? indexOrTool : (
    game.tools.toolsBox.indexOf(indexOrTool)
  );
  if (index < 0 || index >= game.tools.toolsBox.length) return;

  const prevTool = game.tools.activeTool;
  game.tools.activeTool = game.tools.toolsBox[index];
  game.ui.updateSelectedMainTool();

  switch(game.tools.activeTool) {
    case 'terrainAltitude':
      ensureTerrainAltitudeActivated(game);
      break;
  }

  switch(prevTool) {
    case 'terrainAltitude':
      hideTerrainAltitudeTool(game);
      break;
  }
}

export async function addAndSwitchSpriteTool(spriteAsTool: Tool, game: Game) {
  const spriteToolName: Tool = `sprite/${spriteAsTool}`;
  if (game.tools.userTools.indexOf(spriteToolName) !== -1) return;

  await game.ui.modal.pleaseWait('Building...', async () => {
    await timeoutPromise(500 + 1000 * Math.random());

    game.tools.userTools.push(spriteToolName);
    await updateMainToolbox(game);
    game.ui.updateSelectableMainTools();
    setActiveTool(spriteToolName, game);
  });
}

export async function rmSpriteTool(spriteAsTool: Tool, game: Game) {
  const spriteToolName: Tool = `sprite/${spriteAsTool}`;
  const index = game.tools.toolsBox.indexOf(spriteToolName);
  if (index === -1) return;

  game.tools.userTools.splice(index, 1);
  await updateMainToolbox(game);
  game.ui.updateSelectableMainTools();
}

async function updateMainToolbox(game: Game) {
  game.tools.toolsBox = [
    ...game.tools.userTools,
    ...BUILTIN_TOOLS,
  ];
  localForage.setItem<Tool[]>(USER_TOOLS_STORAGE_NAME, game.tools.userTools);
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

function hideTerrainAltitudeTool(game: Game) {
  game.tools.terrainAltitude.coneGroup.visible = false;
}

type InputType = 'down' | 'up' | 'click' | 'dbclick';
export function castMainTool(coordsPixel: Vec2, inputType: InputType, game: Game) {
  switch (game.tools.activeTool) {
    case 'melee':
      return castMelee(coordsPixel, inputType, game);
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

/**
 * maybe will add inputType=hover in the future that move but not down
 */
type MoveInputType = 'move';
export function castMainToolMove(coordsPixel: Vec2, movement: Vec2, inputType: MoveInputType, game: Game) {
  switch (game.tools.activeTool) {
    case 'melee':
      return castMeleeMove(coordsPixel, movement, inputType, game);
    case 'draw':
      return castDrawMove(coordsPixel, movement, inputType, game);
  }
}

function castMelee(coordsPixel: Vec2, inputType: InputType, game: Game) {
  switch (inputType) {
    case 'click':
      return castMeleeClick(coordsPixel, game);
    case 'dbclick':
      return castMeleeDbClick(coordsPixel, game);
  }
}

function castMeleeClick(coordsPixel: Vec2, game: Game) {
  const [intersectWithSubObj, subObjComponents] = rayCastSubObjs(coordsPixel, game);

  let location: Vec2;
  let targetSubObj: GameEntityComponents;

  if (intersectWithSubObj) {
    location = vec3To2(subObjComponents.get('subObj').position);
    targetSubObj = subObjComponents;
  } else {
    const [intersectWithRealm] = rayCastRealm(coordsPixel, game);
    if (!intersectWithRealm) return;
    location = [intersectWithRealm.point.x, intersectWithRealm.point.z];
  }

  const playerSubObjComps = game.ecs.getEntityComponents(game.player.subObjEntity);
  const playerSubObj = playerSubObjComps.get('subObj');
  const playerObjSprite = game.ecs.getComponent(playerSubObj.obj, 'obj/sprite');

  const locationDistance = length(sub(location, vec3To2(playerSubObj.position)));
  const playerRadius = playerObjSprite.radius || 0.5;

  if (locationDistance > playerRadius * 2) {
    return movePlayerTo(location, game);
  }

  if (!targetSubObj) {
    let currentDistance = Infinity;
    subObjInChunkRange(game.player.chunkIJ, 1, game).filter(subObjEntity => (
      !entityEqual(subObjEntity, game.player.subObjEntity)
    )).map(subObjEntity => (
      [game.ecs.getComponent(subObjEntity, 'subObj'), subObjEntity] as [SubObjComponent, EntityRef]
    )).map(([subObj, subObjEntity]) => (
      [length(sub(vec3To2(subObj.position), location)), subObj, subObjEntity] as [number, SubObjComponent, EntityRef]
    )).forEach(([distance, _, subObjEntity]) => {
      if (distance < playerRadius && distance < currentDistance) {
        currentDistance = distance;
        targetSubObj = game.ecs.getEntityComponents(subObjEntity);
      }
    });
  }
  if (!targetSubObj) return;

  changePlayerObj(targetSubObj.get('subObj').obj, game);
}

function castMeleeDbClick(coordsPixel: Vec2, game: Game) { // damage
  const [intersect] = rayCastRealm(coordsPixel, game);
  if (!intersect) return;

  const location: Vec2 = [intersect.point.x, intersect.point.z];

  const playerSubObjComps = game.ecs.getEntityComponents(game.player.subObjEntity);
  const playerSubObj = playerSubObjComps.get('subObj');
  const radius = game.ecs.getComponent(playerSubObj.obj, 'obj/sprite')?.radius || 0.5;

  makeSubObjFacing(location, playerSubObj);
  showMeleeRange(game);

  subObjInChunkRange(game.player.chunkIJ, 1, game).filter(subObjEntity => (
    !entityEqual(subObjEntity, game.player.subObjEntity)
  )).filter(subObjEntity => {
    const subObj = game.ecs.getComponent(subObjEntity, 'subObj');
    const subObjRadius = game.ecs.getComponent(subObj.obj, 'obj/sprite')?.radius || 0.5;
    const relativeLocation = sub(vec3To2(subObj.position), vec3To2(playerSubObj.position));
    const distance = length(relativeLocation);
    const directionRad = relativeToRad(relativeLocation);

    return (
      distance > (radius - subObjRadius) &&
      distance < (radius * 1.5 + subObjRadius) &&
      directionRad > (playerSubObj.rotation[1] - Math.PI / 4) &&
      directionRad < (playerSubObj.rotation[1] + Math.PI / 4)
    )
  }).forEach(subObjEntity => {
    const action: DamageSubObjAction = {
      type: 'subObj-damage',
      sid: game.ecs.getOrAddPrimarySid(subObjEntity),
    }

    dispatchAction(action, game);
  });
}

function castMeleeMove(_coordsPixel: Vec2, movement: Vec2, _inputType: MoveInputType, game: Game) {
  movePlayerAddRelative(
    (multiply(
      vecAfterCameraRotation(movement, game.camera),
      0.01,
    )),
    game,
  );
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

function castDrawMove(coordsPixel: Vec2, _movement: Vec2, _inputType: MoveInputType, game: Game) {
  castDraw(coordsPixel, /* dummy: */ 'down', game);
}

function castTerrainAltitude(coordsPixel: Vec2, inputType: InputType, game: Game) {
  if (inputType !== 'click') return;
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

  const [realmIntersect] = rayCastRealm(coordsPixel, game);
  if (!realmIntersect) return;

  dispatchAddSubObjAction(
    'pin',
    threeToVec3(realmIntersect.point),
    [0, cameraRotationY(game.camera), 0],
    game,
  );
}

function castSpriteObj(coordsPixel: Vec2, inputType: InputType, game: Game) {
  if (inputType !== 'up') return;

  const spriteObjPath: ObjPath = game.tools.activeTool.replace(/^sprite\//, '');
  const spriteObjAsTool = game.ecs.fromSid(spriteObjPath);
  const [realmIntersect] = rayCastRealm(coordsPixel, game);
  if (!realmIntersect || !spriteObjAsTool) return;

  dispatchAddSubObjAction(
    spriteObjPath,
    threeToVec3(realmIntersect.point),
    [0, cameraRotationY(game.camera), 0],
    game,
  );
}

function rayCastRealm(coordsPixel: Vec2, game: Game): [intersect: THREE.Intersection, chunkEntityComponents: GameEntityComponents] {
  const chunkMeshes = rangeVec2s(game.player.chunkIJ, RAYCAST_CHUNK_RANGE).map(chunkIJ => (
    getChunkEntityComponents(chunkIJ, game.realm.currentObj, game.ecs)
  )).map(chunkEntityComponents => ([
    chunkEntityComponents
      ?.get('chunk/render')
      ?.mesh,
    chunkEntityComponents,
  ] as [THREE.Mesh, GameEntityComponents, ])).filter(([m, _]) => m);

  const intersect = rayCast(coordsPixel, chunkMeshes.map(([m, _]) => m), game);
  if (!intersect) return [null, null];

  const [_, chunkEntityComponents] = chunkMeshes.find(([m, _]) => m.id === intersect.object.id);
  return [intersect, chunkEntityComponents]
}

function rayCastSubObjs(coordsPixel: Vec2, game: Game): [intersect: THREE.Intersection, subObjEntityComponents: GameEntityComponents] {
  const subObjAndThrees = subObjInChunkRange(game.player.chunkIJ, 2, game).filter(subObjEntity => (
    !entityEqual(subObjEntity, game.player.subObjEntity)
  )).map(subObjEntity => (
    [getThreeObj(subObjEntity, game.ecs), game.ecs.getEntityComponents(subObjEntity)] as [THREE.Object3D, GameEntityComponents]
  ));

  const intersect = rayCast(coordsPixel, subObjAndThrees.map(([m, _]) => m), game);
  if (!intersect) return [null, null];

  const [_, subObjEntityComponents] = subObjAndThrees.find(([threeObj, _]) => {
    if (threeObj.id === intersect.object.id) return true;
    let found = false;
    threeObj.traverse(obj => {
      if (found) return;
      found = obj.id === intersect.object.id;
    });
    return found;
  });
  return [intersect, subObjEntityComponents];
}

function rayCast(coordsPixel: Vec2, objs: THREE.Object3D[], game: Game): THREE.Intersection {
  const coords: Vec2 = [
    (coordsPixel[0] / game.renderer.domElement.width) * 2 - 1,
    (coordsPixel[1] / game.renderer.domElement.height) * -2 + 1,
  ];

  const raycaster = game.tools.raycaster;
  raycaster.setFromCamera({ x: coords[0], y: coords[1] }, game.camera.camera);
  const intersects = raycaster.intersectObjects(objs, true);
  return intersects[0];
}

export async function castOptionSave(game: Game, recordIndexToOverwrite?: number) {
  const message = typeof recordIndexToOverwrite === 'number' ? (
    'Will OVERWRITE selected record, proceed?'
  ) : (
    'Will Save as new record, proceed?'
  );
  if (!await game.ui.modal.confirm(message)) return;

  const objBuilderStarted = ensureObjBuilderStarted(game);

  await game.ui.modal.pleaseWait('Saving...', async _setMessage => {
    const savingMinWait = timeoutPromise(1500);

    game.realm.rmEditingWhileUpdateChunkTexture = true;
    syncLocationToRealmSpawnLocation(game);
    const realmObjPath = await exportRealm('local', game);
    game.realm.rmEditingWhileUpdateChunkTexture = false;

    if (!realmObjPath) return;

    await objBuilderStarted;
    const spriteObjPath = await game.objBuilder.worker.buildSpriteFromRealm(realmObjPath);

    if (!spriteObjPath) return;

    afterSaved(realmObjPath, game);
    await savingMinWait;
    await addSavedObj(realmObjPath, spriteObjPath, game, recordIndexToOverwrite);
  });
}

export async function castOptionImport(game: Game) {
  const json = await openJson();
  if (!json) return;
  const objBuilderStarted = ensureObjBuilderStarted(game);

  const success = await game.ui.modal.pleaseWait('Importing...', async () => {
    const realmObjPath = `/local/${await calcJsonCid(json)}`;
    const importedJson = await importRealm(realmObjPath, json);
    if (!importedJson) return;

    await objBuilderStarted;
    const spriteObjPath = await game.objBuilder.worker.buildSpriteFromRealm(realmObjPath);

    afterSaved(realmObjPath, game);
    await addSavedObj(realmObjPath, spriteObjPath, game);

    return true;
  });

  game.ui.modal.alert(success ? 'Imported successfully' : 'Oops! This json maybe invalid');
}
