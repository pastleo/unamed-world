import * as THREE from 'three';
import { Obj } from './obj';
import { Vec2 } from './utils/utils';

type SpriteAnimation = [start: number, end: number];
export interface SpriteStateAnimation {
  animations: SpriteAnimation[]; // for 4 facing direction
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
      if (obj.spriteSheetMaterial.nearestFilter) {
        texture.magFilter = THREE.NearestFilter;
      }

      setSpriteTexture(obj.spriteSheetMaterial, texture);
    })
  });
  return new THREE.Sprite(material);
}

export function setSpriteTexture(spriteSheetMaterial: SpriteSheetMaterial, texture: THREE.Texture, time: number = 0) {
  texture.repeat.set(
    1/spriteSheetMaterial.colRow[0],
    1/spriteSheetMaterial.colRow[1],
  );
  const spriteFrameIndex = spriteSheetMaterial.normal.animations[0][0];
  texture.offset.set(
    (spriteFrameIndex % spriteSheetMaterial.colRow[0]) * (1/spriteSheetMaterial.colRow[0]),
    (spriteSheetMaterial.colRow[1] - Math.floor(spriteFrameIndex / spriteSheetMaterial.colRow[0]) - 1) * (1/spriteSheetMaterial.colRow[1]),
  );
}
