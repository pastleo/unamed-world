import * as THREE from 'three';

import type { Game } from '../game';
import { getOrBaseSprite } from '../builtInObj';
import { cameraRotationY } from '../camera';

import type { SubObjComponent } from './subObj';
import type { ObjSpriteComponent } from '../obj/sprite';

import { EntityRef } from '../utils/ecs';
import { radToDeg, normalizeDeg, assertPresentOrWarn } from '../utils/utils';

export interface SubObjSpriteRenderComponent {
  sprite: THREE.Sprite;
}

export function addSpriteToScene(subObjEntity: EntityRef, game: Game, refresh: boolean = false) {
  const subObjComponents = game.ecs.getEntityComponents(subObjEntity);
  const subObj = subObjComponents.get('subObj');
  if (assertPresentOrWarn([subObj], 'subObj/spriteRender.addSpriteToScene: subObj component not found')) return;

  const objSprite = getOrBaseSprite(subObj.obj, game.ecs);
  if (assertPresentOrWarn([objSprite], 'subObj/spriteRender.addSpriteToScene: objSprite component not found')) return;

  let subObjSpriteRender = subObjComponents.get('subObj/spriteRender');
  if (subObjSpriteRender) {
    if (refresh) {
      subObjSpriteRender.sprite.removeFromParent();
    } else {
      return;
    }
  }

  const texture = game.loader.load(objSprite.spritesheet);
  const material = new THREE.SpriteMaterial({
    map: texture,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.x = objSprite.radius * 2;
  sprite.scale.y = objSprite.tall;

  subObjSpriteRender = { sprite };
  game.ecs.setComponent(subObjEntity, 'subObj/spriteRender', subObjSpriteRender);

  initSpriteTexture(objSprite, texture);
  updateSpriteTexture(
    subObjEntity, game,
    subObjSpriteRender,
    subObj, objSprite,
  );

  game.scene.add(sprite);
}

export function updateSpritePosition(subObjEntity: EntityRef, game: Game) {
  const subObjSpriteRender = game.ecs.getComponent(subObjEntity, 'subObj/spriteRender');
  if (!subObjSpriteRender) return;
  const subObj = game.ecs.getComponent(subObjEntity, 'subObj');
  const objSprite = getOrBaseSprite(subObj.obj, game.ecs);
  if (assertPresentOrWarn([subObj, objSprite], 'subObj/spriteRender.updateSpritePosition: subObj or objSprite component not found')) return;

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
  const objSprite = objSpriteArg ?? getOrBaseSprite(subObj.obj, game.ecs);
  if (assertPresentOrWarn([subObj], 'subObj/spriteRender.updateSpritePosition: subObj component not found')) return;

  const texture = subObjSpriteRender.sprite.material.map;

  const animation = objSprite.stateAnimations[subObj.state] || objSprite.stateAnimations.normal;
  const cameraYDeg = radToDeg(cameraRotationY(game?.camera));
  const spriteRotationYDeg = radToDeg(subObj.rotation[1]);
  const viewedRotationDeg = normalizeDeg(cameraYDeg - spriteRotationYDeg);

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

export function removeSprite(subObjEntity: EntityRef, game: Game) {
  const subObjSpriteRender = game.ecs.getComponent(subObjEntity, 'subObj/spriteRender');
  if (!subObjSpriteRender) return;

  subObjSpriteRender.sprite.removeFromParent();
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
