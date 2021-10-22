export const CHUNK_SIZE = 8;
export const CELL_STEPS = 5;

export const INIT_CAMERA_ANGLE = -45 * Math.PI / 180;
export const MAX_CAMERA_ANGLE = -30 * Math.PI / 180;
export const MIN_CAMERA_ANGLE = -90 * Math.PI / 180;
export const MIN_CAMERA_DISTANCE = 4;
export const MAX_CAMERA_DISTANCE = 24;

export const REALM_CHUNK_AUTO_GENERATION_RANGE = 12;

export const MAX_TARGET_DISTANCE = 2;
export const STOP_TARGET_DISTANCE = 0.5;

export const BASE_REALM_BACKGROUND = [
  'assets/skybox/pos-x.png',
  'assets/skybox/neg-x.png',
  'assets/skybox/pos-y.png',
  'assets/skybox/neg-y.png',
  'assets/skybox/pos-z.png',
  'assets/skybox/neg-z.png',
] as [string, string, string, string, string, string];
