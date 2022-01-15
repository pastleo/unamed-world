import { GameECS } from './gameECS';

import { createObjEntity } from './obj/obj';
import type { ObjSpriteComponent } from './obj/sprite';

import { createCanvas2d } from './utils/web';
import type { EntityRef } from './utils/ecs';

export function getOrBaseSprite(objEntity: EntityRef, ecs: GameECS): ObjSpriteComponent {
  const objSprite = ecs.getComponent(objEntity, 'obj/sprite');
  if (objSprite) return objSprite;

  return ecs.getComponent(ecs.fromSid('base'), 'obj/sprite');
}

export function createBuiltInObjs(ecs: GameECS) {
  createBaseSpriteObj(ecs);
  createPinObj(ecs);
}

export function renderBaseSprite(ctx: CanvasRenderingContext2D, size: number) {
  const whiteGradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  whiteGradient.addColorStop(0, '#FFFFFFFF')
  whiteGradient.addColorStop(1, '#FFFFFF00')

  ctx.fillStyle = whiteGradient;
  ctx.fillRect(0, 0, size, size);

  const blackGradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 32);
  blackGradient.addColorStop(0, '#00000010')
  blackGradient.addColorStop(1, '#00000000')

  ctx.fillStyle = blackGradient;
  ctx.fillRect(0, 0, size, size);
}

export function createBaseSpriteObj(ecs: GameECS) {
  const size = 256;
  const ctx = createCanvas2d(size, size);

  renderBaseSprite(ctx, size);

  const objEntity = createObjEntity(ecs, 'base', 'sprite');
  ecs.setComponent(objEntity, 'obj/sprite', {
    spritesheet: ctx.canvas.toDataURL('image/png'), // use 'image/webp' when Safari finally support webp
    eightBitStyle: true,
    colRow: [1, 1],
    stateAnimations: {
      normal: {
        animations: [[0, 0]],
        speed: 0,
      },
    },
    tall: 1,
    radius: 0.5,
    collision: false,
  });
  ecs.setComponent(objEntity, 'obj/walkable', {
    speed: 4,
    maxClimbRad: Math.PI * 0.3,
  });
}

export function createPinObj(ecs: GameECS) {
  const objEntity = createObjEntity(ecs, 'pin', 'mesh');
  ecs.setComponent(objEntity, 'obj/model', {
    glbUrl: 'assets/pin.glb',
  });
}
