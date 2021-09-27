import * as THREE from 'three';
import { Obj, subObjState, SubObjState } from './obj';
import { Vec2 } from './utils/utils';

type SpriteAnimation = [start: number, end: number];
export interface SpriteStateAnimation {
  animations: SpriteAnimation[]; // for different facing directions
  speed: number;
}
export interface SpriteSheetMaterial {
  url: string;
  nearestFilter?: boolean;
  colRow: Vec2;
  normal: SpriteStateAnimation;
  moving?: SpriteStateAnimation;
}

export function createSprite(obj: Obj, loader: THREE.TextureLoader): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: loader.load(obj.spriteSheetMaterial.url, texture => {
      initSpriteTexture(obj.spriteSheetMaterial, texture);
    })
  });
  return new THREE.Sprite(material);
}

function initSpriteTexture(spriteSheetMaterial: SpriteSheetMaterial, texture: THREE.Texture) {
  if (spriteSheetMaterial.nearestFilter) {
    texture.magFilter = THREE.NearestFilter;
  }
  texture.repeat.set(
    1/spriteSheetMaterial.colRow[0],
    1/spriteSheetMaterial.colRow[1],
  );

  setSpriteTexture(spriteSheetMaterial, texture, subObjState.normal, 700);
}

export function setSpriteTexture(spriteSheetMaterial: SpriteSheetMaterial, texture: THREE.Texture, state: SubObjState, time: number = 0) {
  const animation = spriteSheetMaterial[state];
  const [aniFrameStart, aniFrameEnd] = animation.animations[0]; // WIP: different facing directions
  const spriteFrameIndex = (
    animation.speed <= 0 ? 0 : (Math.floor(time / animation.speed) % (aniFrameEnd + 1 - aniFrameStart))
  ) + aniFrameStart;
  texture.offset.set(
    (spriteFrameIndex % spriteSheetMaterial.colRow[0]) * (1/spriteSheetMaterial.colRow[0]),
    (spriteSheetMaterial.colRow[1] - Math.floor(spriteFrameIndex / spriteSheetMaterial.colRow[0]) - 1) * (1/spriteSheetMaterial.colRow[1]),
  );
}
