import * as THREE from 'three';
import { Game } from './game';
import Obj from './obj/obj';
import { SubObj, addSubObj } from './obj/subObj';
import { calcAltitudeAt, Chunk, Located, locateChunkCell } from './obj/chunk';
import { Vec2, mod } from './utils/utils';
import Map2D from './utils/map2d';

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
  walking?: SpriteStateAnimation;
}

export function createSubObjSprite(obj: Obj, realmObj: Obj, x: number, z: number, loader: THREE.TextureLoader): SubObj {
  const located = locateChunkCell(x, z, realmObj.chunks);
  const subObj = addSubObj(obj, realmObj, x, z, located);
  initSprite(subObj, realmObj, loader, located);

  return subObj;
}

export function initSprite(subObj: SubObj, realmObj: Obj, loader: THREE.TextureLoader, located: Located) {
  const material = new THREE.SpriteMaterial({
    map: loader.load(subObj.obj.spriteSheetMaterial.url, texture => {
      initSpriteTexture(subObj.obj.spriteSheetMaterial, texture, subObj);
    })
  });
  subObj.sprite = new THREE.Sprite(material);
  updateSpritePosition(subObj, located, realmObj.chunks);
}

function updateSpritePosition(subObj: SubObj, localed: Located, chunks: Map2D<Chunk>) {
  subObj.sprite.position.x = subObj.position[0];
  subObj.sprite.position.y = calcAltitudeAt(subObj.position[0], subObj.position[1], localed, chunks) + subObj.obj.tall;
  subObj.sprite.position.z = subObj.position[2];
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
  const viewedRotationDeg = mod(Math.floor(
    (subObj.rotation[1] + (game?.camera.cameraBase.rotation.y || 0)) / Math.PI * 180
  ), 360);

  if (viewedRotationDeg > 5 && viewedRotationDeg < 175) {
    texture.repeat.set(
      1/spriteSheetMaterial.colRow[0],
      1/spriteSheetMaterial.colRow[1],
    );
  } else if (viewedRotationDeg > 185 && viewedRotationDeg < 355) {
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
