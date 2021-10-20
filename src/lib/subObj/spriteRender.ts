import * as THREE from 'three';

import { Game } from '../game';
import { SubObjComponent } from './subObj';
import { ObjSpriteComponent } from '../obj/sprite';

import { EntityRef } from '../utils/ecs';
import { mod, warnIfNotPresent } from '../utils/utils';

export interface SubObjSpriteRenderComponent {
  sprite: THREE.Sprite;
}

export function initSprite(subObjEntity: EntityRef, game: Game) {
  const subObj = game.ecs.getComponent(subObjEntity, 'subObj');
  if (warnIfNotPresent(subObj)) return;
  const objSprite = game.ecs.getComponent(subObj.obj, 'obj/sprite');
  if (!objSprite) return;

  const material = new THREE.SpriteMaterial({
    map: game.loader.load(objSprite.url, texture => {
      initSpriteTexture(objSprite, texture);
      updateSpriteTexture(
        subObjEntity, game,
        subObjSpriteRender,
        subObj, objSprite,
      );
    }),
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.x = objSprite.radius * 2;
  sprite.scale.y = objSprite.tall;

  const subObjSpriteRender = {
    sprite,
    groundAltitude: 0,
  };
  game.ecs.setComponent(subObjEntity, 'subObj/spriteRender', subObjSpriteRender);
  game.scene.add(sprite);

  updateSpritePosition(
    subObjEntity, game,
    subObjSpriteRender,
    subObj, objSprite,
  );
}

export function updateSpritePosition(
  subObjEntity: EntityRef, game: Game,
  subObjSpriteRenderArg?: SubObjSpriteRenderComponent,
  subObjArg?: SubObjComponent, objSpriteArg?: ObjSpriteComponent,
) {
  const subObjSpriteRender = subObjSpriteRenderArg ?? game.ecs.getComponent(subObjEntity, 'subObj/spriteRender');
  if (!subObjSpriteRender) return;
  const subObj = subObjArg ?? game.ecs.getComponent(subObjEntity, 'subObj');
  const objSprite = objSpriteArg ?? game.ecs.getComponent(subObj.obj, 'obj/sprite');
  if (warnIfNotPresent(subObj, objSprite)) return;

  subObjSpriteRender.sprite.position.x = subObj.position[0];
  subObjSpriteRender.sprite.position.y = subObj.position[1] + subObj.groundAltitude + objSprite.tall * 0.5;
  subObjSpriteRender.sprite.position.z = subObj.position[2];
}

export function updateSpriteTexture(
  subObjEntity: EntityRef, game: Game,
  subObjSpriteRenderArg?: SubObjSpriteRenderComponent,
  subObjArg?: SubObjComponent, objSpriteArg?: ObjSpriteComponent,
) {
  const subObjSpriteRender = subObjSpriteRenderArg ?? game.ecs.getComponent(subObjEntity, 'subObj/spriteRender');
  if (!subObjSpriteRender) return;
  const subObj = subObjArg ?? game.ecs.getComponent(subObjEntity, 'subObj');
  const objSprite = objSpriteArg ?? game.ecs.getComponent(subObj.obj, 'obj/sprite');
  if (warnIfNotPresent(subObj)) return;

  const texture = subObjSpriteRender.sprite.material.map;

  const animation = objSprite.stateAnimations[subObj.state] || objSprite.stateAnimations.normal;
  const viewedRotationDeg = mod(Math.floor(
    (subObj.rotation[1] + (game?.camera.cameraBase.rotation.y || 0)) / Math.PI * 180
  ), 360);

  if (viewedRotationDeg > 5 && viewedRotationDeg < 175) {
    setTextureRepeat(texture, objSprite, false);
  } else if (viewedRotationDeg > 185 && viewedRotationDeg < 355) {
    setTextureRepeat(texture, objSprite, true);
  }

  const [aniFrameStart, aniFrameEnd] = animation.animations[0]; // WIP: different facing directions

  const spriteFrameIndex = (
    animation.speed <= 0 ? 0 : (Math.floor(game.time / animation.speed) % (aniFrameEnd + 1 - aniFrameStart))
  ) + aniFrameStart;
  const flopped = texture.repeat.x < 0;

  texture.offset.set(
    ((spriteFrameIndex % objSprite.colRow[0]) + (flopped ? 1 : 0)) * (1/objSprite.colRow[0]),
    (objSprite.colRow[1] - Math.floor(spriteFrameIndex / objSprite.colRow[0]) - 1) * (1/objSprite.colRow[1]),
  );
}

function initSpriteTexture(objSprite: ObjSpriteComponent, texture: THREE.Texture) {
  if (objSprite.eightBitStyle) {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
  }
  setTextureRepeat(texture, objSprite, false);
}

function setTextureRepeat(texture: THREE.Texture, objSprite: ObjSpriteComponent, flop: boolean) {
  if (flop) {
    texture.repeat.set(
      -1/objSprite.colRow[0],
      1/objSprite.colRow[1],
    );
  } else {
    texture.repeat.set(
      1/objSprite.colRow[0],
      1/objSprite.colRow[1],
    );
  }
}
