export const CURRENT_STORAGE_VERSION = 1;

export const CHUNK_SIZE = 8;

export const CHUNK_CELL_RESOLUTION = 8;
export const CHUNK_GEOMETRY_DELATIN_MAX_ERROR = 0.005;

export const INIT_CAMERA_ANGLE = -45 * Math.PI / 180;
export const MAX_CAMERA_ANGLE = -30 * Math.PI / 180;
export const MIN_CAMERA_ANGLE = -90 * Math.PI / 180;
export const MIN_CAMERA_DISTANCE = 4;
export const MAX_CAMERA_DISTANCE = 24;

export const REALM_CHUNK_AUTO_GENERATION_RANGE = 12;

export const MAX_TARGET_DISTANCE = 2;
export const STOP_TARGET_DISTANCE = 0.5;

export const BASE_REALM_BACKGROUND = [
  'assets/skybox/pos-x.jpg',
  'assets/skybox/neg-x.jpg',
  'assets/skybox/pos-y.jpg',
  'assets/skybox/neg-y.jpg',
  'assets/skybox/pos-z.jpg',
  'assets/skybox/neg-z.jpg',
] as [string, string, string, string, string, string];
