import type { Game } from './game';

import { addActionToBroadcast } from './network';

import {
  Cell, getChunkEntityComponents, getChunkAndCell, afterChunkChanged,
  locateOrCreateChunkCell,
} from './chunk/chunk';
import { createSubObj } from './subObj/subObj';
import { editChunkCanvas2d } from './chunk/render';

import { Vec2, Vec3, rangeVec2s } from './utils/utils';
import { Sid } from './utils/ecs';
import Map2D from './utils/map2d';

import { DRAW_CANVAS_SIZE } from './consts';

export interface Action {
  type: string;
}

export interface ChunkAction extends Action {
  type: `chunk-${string}`;
  chunkIJ: Vec2;
}
export interface ChunkDrawAction extends ChunkAction {
  type: 'chunk-draw';
  erasing: boolean;
  color: string;
  uv: Vec2;
  radius: number;
}
export interface ChunkTerrainAltitudeAction extends ChunkAction {
  type: 'chunk-terrainAltitude';
  cellIJ: Vec2;
  altitudeAdjustment: number;
  flatness: number;
  range: number;
}

export interface AddSubObjAction extends Action {
  type: 'subObj-add';
  sid: Sid;
  obj: Sid;
  position: Vec3;
}

export function dispatchAction(action: Action, game: Game) {
  processAction(action, game);
  addActionToBroadcast(action, game);
}

export function processAction(action: Action, game: Game) {
  switch (action.type) {
    case 'chunk-draw':
      return draw(action as ChunkDrawAction, game);
    case 'chunk-terrainAltitude':
      return adjustTerrain(action as ChunkTerrainAltitudeAction, game);
    case 'subObj-add':
      return addSubObj(action as AddSubObjAction, game);
    default:
      return console.warn('processChunkAction: unknown action', action);
  }
}

function draw(action: ChunkDrawAction, game: Game) {
  const chunkEntityComponents = getChunkEntityComponents(action.chunkIJ, game.realm.currentObj, game.ecs);
  editChunkCanvas2d((canvas2d: CanvasRenderingContext2D) => {
    if (action.erasing) {
      canvas2d.fillStyle = 'rgba(255, 255, 255, 1)';
      canvas2d.globalCompositeOperation = 'destination-out';
    } else {
      canvas2d.fillStyle = action.color;
      canvas2d.globalCompositeOperation = 'source-over';
    }

    canvas2d.beginPath();
    canvas2d.arc(
      DRAW_CANVAS_SIZE * action.uv[0], DRAW_CANVAS_SIZE * (1 - action.uv[1]),
      action.radius,
      0, 2 * Math.PI);
    canvas2d.fill();
  }, chunkEntityComponents, game);

  afterChunkChanged(chunkEntityComponents.get('chunk'));
}

function adjustTerrain(action: ChunkTerrainAltitudeAction, game: Game) {
  const updatedCells = new Map2D<Cell>();

  rangeVec2s(action.cellIJ, action.range).map(cellIJ => {
    const [chunk, cell] = getChunkAndCell(action.chunkIJ, cellIJ, game.realm.currentObj, game.ecs);
    cell.altitude += action.altitudeAdjustment;
    updatedCells.put(...cellIJ, cell);
    afterChunkChanged(chunk);
  });

  rangeVec2s(action.cellIJ, action.range + 1).map(cellIJ => {
    const [chunk, cell] = getChunkAndCell(action.chunkIJ, cellIJ, game.realm.currentObj, game.ecs);
    cell.flatness = action.flatness;
    updatedCells.put(...cellIJ, cell);
    afterChunkChanged(chunk);
  });

  game.realm.worker.updateCells(action.chunkIJ, updatedCells.entries());
}

function addSubObj(action: AddSubObjAction, game: Game) {
  const subObjEntity = game.ecs.fromSid(action.sid);
  const spriteObj = game.ecs.fromSid(action.obj);
  const located = locateOrCreateChunkCell(action.position, game);
  createSubObj(spriteObj, action.position, game, located, subObjEntity);
}
