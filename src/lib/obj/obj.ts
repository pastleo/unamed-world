import { SpriteSheetMaterial } from '../sprite';
import { Chunk } from './chunk';
import Map2D from '../utils/map2d';

interface Obj {
  chunks: Map2D<Chunk>;
  spriteSheetMaterial: SpriteSheetMaterial;
  tall: number;
  speed: number;
  maxClimbRad: number;
  radius: number;
}

export default Obj;
