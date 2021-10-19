import { EntityRef } from '../utils/ecs';
import Map2D from '../utils/map2d';

export interface ObjRealmComponent {
  chunks: Map2D<EntityRef>;
  backgrounds: [
    urlPosX: string, urlNegX: string,
    urlPosY: string, urlNegY: string,
    urlPosZ: string, urlPosZ: string
  ];
}
