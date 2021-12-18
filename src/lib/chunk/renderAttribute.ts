import * as THREE from 'three';
import Delatin from 'delatin';

import { GameECS } from '../gameECS';
import { calcAltitudeInChunk } from './chunk';

import { EntityRef } from '../utils/ecs';
import { Vec2 } from '../utils/utils';

import { CHUNK_SIZE, CHUNK_CELL_RESOLUTION, CHUNK_GEOMETRY_DELATIN_MAX_ERROR } from '../consts';

export interface ChunkRenderAttributeComponent {
  cellSent: boolean;
  attributesGenerated: boolean;
}

export interface AttributeArrays {
  positions: ArrayBuffer,
  uvs: ArrayBuffer,
  normals: ArrayBuffer;
  indices: ArrayBuffer;
}

const CHUNK_RESOLUTION = CHUNK_CELL_RESOLUTION * CHUNK_SIZE + 1;
const CHUNK_POS_MULT = 1 / CHUNK_CELL_RESOLUTION;
const CHUNK_UV_MULT = 1 / (CHUNK_CELL_RESOLUTION * CHUNK_SIZE);
const CHUNK_XZ_POSITION_OFFSET = CHUNK_SIZE * -0.5;

export function chunkAttributeArrays(chunkEntity: EntityRef, realmEntity: EntityRef, ecs: GameECS): AttributeArrays {
  const chunk = ecs.getComponent(chunkEntity, 'chunk');
  const { chunkIJ } = chunk;

  const data = Array(CHUNK_RESOLUTION).fill(null).flatMap((_, j) => (
    Array(CHUNK_RESOLUTION).fill(null).map((_, i) => {
      const localPos: Vec2 = [i * CHUNK_POS_MULT, j * CHUNK_POS_MULT];
      const cellIJ = localPos.map(Math.floor) as Vec2;
      const cell = chunk.cells.get(...cellIJ);

      return calcAltitudeInChunk(localPos, {
        cellIJ, cell, chunkIJ, chunk,
      }, realmEntity, ecs);
    })
  ));

  const delatin = new Delatin(data, CHUNK_RESOLUTION, CHUNK_RESOLUTION);
  delatin.run(CHUNK_GEOMETRY_DELATIN_MAX_ERROR);

  return delatinAttributeArrays(delatin);
}

function delatinAttributeArrays(delatin: Delatin): AttributeArrays {
  const positionsData: number[] = [];
  const uvsData: number[] = [];
  Array(delatin.coords.length >> 1).fill(null).forEach((_, index) => {
    const i = delatin.coords[index * 2];
    const j = delatin.coords[index * 2 + 1];
    positionsData.push(
      i * CHUNK_POS_MULT + CHUNK_XZ_POSITION_OFFSET,
      delatin.heightAt(i, j),
      j * CHUNK_POS_MULT + CHUNK_XZ_POSITION_OFFSET,
    );
    uvsData.push(
      i * CHUNK_UV_MULT,
      j * CHUNK_UV_MULT,
    );
  });

  const positionsArray = new Float32Array(positionsData);
  const uvsArray = new Float32Array(uvsData);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',
    new THREE.BufferAttribute(positionsArray, 3),
  );
  geometry.setAttribute('uv',
    new THREE.BufferAttribute(uvsArray, 2),
  );
  geometry.setIndex(delatin.triangles);
  geometry.computeVertexNormals();

  const normalArray = geometry.getAttribute('normal').array as Float32Array;
  const indicesArray = geometry.index.array as Uint16Array;

  return {
    positions: positionsArray.buffer,
    uvs: uvsArray.buffer,
    normals: normalArray.buffer,
    indices: indicesArray.buffer,
  }
}
