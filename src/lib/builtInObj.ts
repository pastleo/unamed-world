import { GameECS } from './gameECS';

import { createObjEntity } from './obj/obj';

import { createCanvas2d } from './utils/web';

export function createBuiltInObjs(ecs: GameECS) {
  createBaseSpriteObj(ecs);
  createPinObj(ecs);
}

export function createBaseSpriteObj(ecs: GameECS) {
  const ctx = createCanvas2d(256, 256);

  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, '#FFFFFFFF')
  gradient.addColorStop(1, '#FFFFFF00')

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

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
  ecs.setComponent(objEntity, 'obj/mesh', {
  });
}
