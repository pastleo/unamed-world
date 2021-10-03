import * as THREE from 'three';
import Game from './game';
import { Obj, SubObj } from './obj';
import { Vec2 } from './utils/utils';

type SpriteAnimation = [start: number, end: number];
export interface SpriteStateAnimation {
  animations: SpriteAnimation[]; // WIP: for different facing directions
  speed: number;
}
export interface SpriteSheetMaterial {
  url: string;
  eightBitStyle?: boolean;
  colRow: Vec2;
  normal: SpriteStateAnimation;
  moving?: SpriteStateAnimation;
}

export function createSprite(obj: Obj, loader: THREE.TextureLoader, subObj: SubObj): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: loader.load(obj.spriteSheetMaterial.url, texture => {
      initSpriteTexture(obj.spriteSheetMaterial, texture, subObj);
    })
  });
  return new THREE.Sprite(material);
}

function initSpriteTexture(spriteSheetMaterial: SpriteSheetMaterial, texture: THREE.Texture, subObj: SubObj) {
  if (spriteSheetMaterial.eightBitStyle) {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
  }
  texture.repeat.set(
    1/spriteSheetMaterial.colRow[0],
    1/spriteSheetMaterial.colRow[1],
  );

  setSpriteTexture(spriteSheetMaterial, texture, subObj);
}

export function setSpriteTexture(spriteSheetMaterial: SpriteSheetMaterial, texture: THREE.Texture, subObj: SubObj, game?: Game) {
  const time = game?.time || 0;

  const animation = spriteSheetMaterial[subObj.state] || spriteSheetMaterial.normal;
  const zRotation = (subObj.rotation[2] - game?.camera.cameraBase.rotation.z + Math.PI * 2) % (Math.PI * 2);
  if (zRotation < Math.PI * 0.472 || zRotation > Math.PI * 1.527) {
    texture.repeat.set(
      1/spriteSheetMaterial.colRow[0],
      1/spriteSheetMaterial.colRow[1],
    );
  } else if (zRotation > Math.PI * 0.527 && zRotation < Math.PI * 1.472) {
    texture.repeat.set(
      -1/spriteSheetMaterial.colRow[0],
      1/spriteSheetMaterial.colRow[1],
    );
  }

  const [aniFrameStart, aniFrameEnd] = animation.animations[0]; // WIP: different facing directions

  const spriteFrameIndex = (
    animation.speed <= 0 ? 0 : (Math.floor(time / animation.speed) % (aniFrameEnd + 1 - aniFrameStart))
  ) + aniFrameStart;
  const flipped = texture.repeat.x < 0;

  texture.offset.set(
    ((spriteFrameIndex % spriteSheetMaterial.colRow[0]) + (flipped ? 1 : 0)) * (1/spriteSheetMaterial.colRow[0]),
    (spriteSheetMaterial.colRow[1] - Math.floor(spriteFrameIndex / spriteSheetMaterial.colRow[0]) - 1) * (1/spriteSheetMaterial.colRow[1]),
  );
}
