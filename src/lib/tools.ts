import * as THREE from 'three';

import type { Game } from './game';
import type { GameEntityComponents } from './gameECS';
import { mountSubObj, movePlayerAddRelative, movePlayerTo, syncLocationToRealmSpawnLocation, showMeleeRange } from './player';
import { cameraRotationY, vecAfterCameraRotation } from './camera';
import { broadcastMyself } from './network';
import { afterSaved } from './realm';
import {
  ChunkDrawAction, ChunkTerrainAltitudeAction, AddSubObjAction, DamageSubObjAction,
  dispatchAction,
} from './action';
import { ensureStarted as ensureObjBuilderStarted } from './objBuilder';
import { exportRealm, addSavedObj } from './resource';

import type { ObjPath } from './obj/obj';
import {
  Located,
  getChunkEntityComponents, locateOrCreateChunkCell, calcCellLocation,
} from './chunk/chunk';
import { subObjInChunkRange, detectCollision, destroySubObj, createSubObj, makeSubObjFacing } from './subObj/subObj';

import {
  Vec2, sub, rangeVec2s, length, multiply,
  vec3To2, threeToVec3, vecCopyToThree,
  relativeToRad, timeoutPromise,
} from './utils/utils';
import { entityEqual } from './utils/ecs';

export type Tool = 'melee' | 'draw' | 'terrainAltitude' | 'options' | 'pin' | string;
export interface Tools {
  activeTool: Tool;
  toolsBox: Tool[];
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

export function create(): Tools {
  return {
    activeTool: 'melee',
    toolsBox: ['pin', 'melee', 'draw', 'terrainAltitude', 'options'],
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

export function start(_game: Game) {
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
  if (game.tools.toolsBox.indexOf(spriteToolName) !== -1) return;

  if (!await game.ui.modal.confirm('Will build and add sprite into toolbox')) return;

  await game.ui.modal.pleaseWait('Building...', async () => {
    await timeoutPromise(500 + 1000 * Math.random());

    game.tools.toolsBox.splice(0, 0, spriteToolName);
    game.ui.updateSelectableMainTools();

    setActiveTool(spriteToolName, game);
  });
}

export async function rmSpriteTool(spriteAsTool: Tool, game: Game) {
  const spriteToolName: Tool = `sprite/${spriteAsTool}`;
  const index = game.tools.toolsBox.indexOf(spriteToolName);
  if (index === -1) return;
  if (!await game.ui.modal.confirm('This sprite is already built, remove from toolbox?')) return;

  game.tools.toolsBox.splice(index, 1);
  game.ui.updateSelectableMainTools();

  await game.ui.modal.alert('Removed from toolbox.');
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
  const [intersect] = rayCastRealm(coordsPixel, game);
  if (!intersect) return;

  const location: Vec2 = [intersect.point.x, intersect.point.z];

  const playerSubObjComps = game.ecs.getEntityComponents(game.player.subObjEntity);
  const playerSubObj = playerSubObjComps.get('subObj');
  const objSprite = game.ecs.getComponent(playerSubObj.obj, 'obj/sprite');

  const locationDistance = length(sub(location, vec3To2(playerSubObj.position)));

  if (locationDistance > objSprite.radius * 2) {
    return movePlayerTo(location, game);
  }

  const located = locateOrCreateChunkCell(playerSubObj.position, game);
  const nearBySubObjs = detectCollision(playerSubObjComps.entity, located.chunkIJ, game);
  if (nearBySubObjs.length <= 0) return;

  const nearBySubObj = game.ecs.getComponent(nearBySubObjs[0], 'subObj');
  const targetObjSprite = game.ecs.getComponent(nearBySubObj.obj, 'obj/sprite');
  if (!targetObjSprite) return;

  const distanceBetweenSubObj = length(
    sub(vec3To2(nearBySubObj.position), location)
  );

  if (distanceBetweenSubObj > targetObjSprite.radius) return;

  game.player.objEntity = nearBySubObj.obj;
  destroySubObj(game.player.subObjEntity, game);
  const newSubObj = createSubObj(game.player.objEntity, playerSubObj.position, playerSubObj.rotation, game, located);
  mountSubObj(newSubObj, game);
  broadcastMyself(game);
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
  const located = locateOrCreateChunkCell(playerSubObj.position, game);

  subObjInChunkRange(located.chunkIJ, 1, game).filter(subObjEntity => (
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

  const newSubObj = game.ecs.allocate();
  const sid = game.ecs.getOrAddPrimarySid(newSubObj);
  const action: AddSubObjAction = {
    type: 'subObj-add',
    sid, obj: 'pin',
    position: threeToVec3(realmIntersect.point),
    rotation: [0, cameraRotationY(game.camera), 0],
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
    rotation: [0, cameraRotationY(game.camera), 0],
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
  ] as [THREE.Mesh, GameEntityComponents, ])).filter(([m, _]) => m);

  const intersect = rayCast(coordsPixel, chunkMeshes.map(([m, _]) => m), game);
  if (!intersect) return [null, null];

  const [_, chunkEntityComponents] = chunkMeshes.find(([m, _]) => m.id === intersect.object.id);
  return [intersect, chunkEntityComponents]
}

function rayCastSubObjs(coordsPixel: Vec2, game: Game): [intersect: THREE.Intersection, chunkEntityComponents: GameEntityComponents] {
  const chunkMeshes = rangeVec2s(game.player.chunkIJ, RAYCAST_CHUNK_RANGE).map(chunkIJ => (
    getChunkEntityComponents(chunkIJ, game.realm.currentObj, game.ecs)
  )).map(chunkEntityComponents => ([
    chunkEntityComponents
      ?.get('chunk/render')
      ?.mesh,
    chunkEntityComponents,
  ] as [THREE.Mesh, GameEntityComponents, ])).filter(([m, _]) => m);

  const objs = [
    ...chunkMeshes.map(([m, _]) => m),

  ];

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
