export const CHUNK_SIZE = 8;

export const CHUNK_CELL_RESOLUTION = 8;
export const CHUNK_GEOMETRY_DELATIN_MAX_ERROR = 0.005;

export const INIT_CAMERA_ANGLE = -45 * Math.PI / 180;
export const MAX_CAMERA_ANGLE = -30 * Math.PI / 180;
export const MIN_CAMERA_ANGLE = -90 * Math.PI / 180;
export const MIN_CAMERA_DISTANCE = 4;
export const MAX_CAMERA_DISTANCE = 24;

export const REALM_CHUNK_AUTO_GENERATION_RANGE = 12;

export const MAX_DISTANCE_BETWEEN_PLAYER = 2;
export const START_MOVING_DISTANCE = 0.8;
export const STOP_MOVING_DISTANCE = 0.4;

export const BASE_REALM_BACKGROUND = [
  'assets/skybox/pos-x.jpg',
  'assets/skybox/neg-x.jpg',
  'assets/skybox/pos-y.jpg',
  'assets/skybox/neg-y.jpg',
  'assets/skybox/pos-z.jpg',
  'assets/skybox/neg-z.jpg',
] as [string, string, string, string, string, string];

export const DRAW_CANVAS_SIZE = 512;

export const ACTION_BROADCAST_INTIVAL = 50;

export const SAVED_OBJ_PATHS_STORAGE_NAME = 'SAVED_OBJ_PATHS';
export const PLAYER_OBJ_STORAGE_NAME = 'PLAYER_OBJ';
export const USER_TOOLS_STORAGE_NAME = 'USER_TOOLS';
