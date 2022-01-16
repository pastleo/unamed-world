import * as THREE from 'three';
import type { Game } from './game';
import { Vec2, Vec3, length, sub, multiply, threeToVec3, vecCopyTo, vec2To3, vecAddToThree } from './utils/utils';

import {
  INIT_CAMERA_ANGLE,
  MAX_CAMERA_ANGLE, MIN_CAMERA_ANGLE,
  MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE,
  NEAR_CAMERA_DISTANCE, FAR_CAMERA_DISTANCE,
} from './consts';

export interface Camera {
  moving: boolean;
  position: Vec3;
  camera: THREE.PerspectiveCamera;
  cameraBase: THREE.Object3D;
  cameraAngleBase: THREE.Object3D;

  zoomState?: 'started' | 'bouncing' | 'triggered';
  zoomBouncingBack?: ReturnType<typeof setTimeout>;
}

export function init(): Camera {
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  const cameraBase = new THREE.Object3D();
  const cameraAngleBase = new THREE.Object3D();

  cameraBase.add(cameraAngleBase);
  cameraAngleBase.add(camera);
  camera.position.set(0, 0, 10);
  cameraAngleBase.rotateX(INIT_CAMERA_ANGLE);

  return {
    moving: false,
    position: [0, 0, 0],
    camera, cameraBase, cameraAngleBase
  }
}

export function addToScene(game: Game) {
  game.scene.add(game.camera.cameraBase);
}

export function update(tDiff: number, game: Game) {
  updateCameraMoving(tDiff, game.camera);
  updateCameraDistance(tDiff, game);
}

function updateCameraMoving(tDiff: number, camera: Camera) {
  if (!camera.moving) return;

  const delta = sub(
    camera.position,
    threeToVec3(
      camera.cameraBase.position
    )
  );
  const deltaLength = length(delta);

  if (deltaLength <= 0.0001) {
    camera.moving = false;
    return;
  }
  const frameMoveLength = calcMoveSpeed(deltaLength) * tDiff * 0.01;

  const moving = multiply(delta, frameMoveLength / deltaLength);
  vecAddToThree(moving, camera.cameraBase.position);
}

function updateCameraDistance(tDiff: number, game: Game) {
  const { camera } = game;
  if (camera.zoomState !== 'bouncing') return;

  if (camera.camera.position.z < NEAR_CAMERA_DISTANCE) {
    const d = NEAR_CAMERA_DISTANCE - camera.camera.position.z;
    camera.camera.position.z += d < 0.01 ? d : d * tDiff * 0.003;
  } else if (camera.camera.position.z > FAR_CAMERA_DISTANCE) {
    const d = camera.camera.position.z - FAR_CAMERA_DISTANCE;
    camera.camera.position.z -= d < 0.01 ? d : d * tDiff * 0.003;
  } else if (camera.zoomState) {
    delete camera.zoomState;
  }
}

function calcMoveSpeed(deltaLength: number): number {
  if (deltaLength < 1) return deltaLength;
  if (deltaLength > 1.5) return 1.25;

  return 1.25 - Math.pow(deltaLength - 1.5, 2);
}

export function resize(width: number, height: number, camera: Camera) {
  camera.camera.aspect = width / height;
  camera.camera.updateProjectionMatrix();
}

export function moveCameraAngle(xzRotations: Vec2, camera: Camera): void {
  camera.cameraAngleBase.rotation.x += xzRotations[1];
  if (camera.cameraAngleBase.rotation.x > MAX_CAMERA_ANGLE) {
    camera.cameraAngleBase.rotation.x = MAX_CAMERA_ANGLE;
  } else if (camera.cameraAngleBase.rotation.x < MIN_CAMERA_ANGLE) {
    camera.cameraAngleBase.rotation.x = MIN_CAMERA_ANGLE;
  }
  camera.cameraBase.rotation.y += xzRotations[0];
}

export function setCameraPosition(position: Vec3, game: Game): void {
  vecCopyTo(position, game.camera.position);
  game.camera.moving = true;
}
export function setCameraLocation(location: Vec2, game: Game): void {
  vec2To3(location, game.camera.position);
  game.camera.moving = true;
}
export function setCameraY(y: number, game: Game): void {
  game.camera.position[1] = y;
  game.camera.moving = true;
}

type Zoom = null | 'in' | 'out';
export function adjCameraDistance(distanceDelta: number, game: Game): Zoom {
  const { camera } = game;

  if (camera.zoomState === 'triggered') return;

  let distanceDeltaAdjustment = 1;
  if (camera.camera.position.z < NEAR_CAMERA_DISTANCE && distanceDelta < 0) {
    distanceDeltaAdjustment += 4 * (NEAR_CAMERA_DISTANCE - camera.camera.position.z) * 0.5;
  } else if (camera.camera.position.z > FAR_CAMERA_DISTANCE && distanceDelta > 0) {
    distanceDeltaAdjustment += 4 * (camera.camera.position.z - FAR_CAMERA_DISTANCE) * 0.5;
  }

  if (distanceDeltaAdjustment > 1) {
    camera.zoomState = 'started';
    clearTimeout(camera.zoomBouncingBack);
    camera.zoomBouncingBack = setTimeout(() => {
      camera.zoomState = 'bouncing';
    }, 1000);
  }

  camera.camera.position.z += distanceDelta / distanceDeltaAdjustment;

  let zoom: Zoom = null;
  if (camera.camera.position.z < MIN_CAMERA_DISTANCE) {
    camera.camera.position.z = MIN_CAMERA_DISTANCE;
    zoom = 'in';
  } else if (camera.camera.position.z > MAX_CAMERA_DISTANCE) {
    camera.camera.position.z = MAX_CAMERA_DISTANCE;
    zoom = 'out';
  }

  if (zoom) {
    clearTimeout(camera.zoomBouncingBack);
    camera.zoomState = 'triggered';
  }
  return zoom;
}

export function castCameraZoomAnimation(zoom: Zoom, game: Game) {
  if (zoom === 'in') {
    game.camera.camera.position.z = MAX_CAMERA_DISTANCE * 2;
  } else if (zoom === 'out') {
    game.camera.camera.position.z = MIN_CAMERA_DISTANCE * 0.5;
  }

  game.camera.zoomState = 'bouncing';
}

export function cameraRotationY(camera: Camera): number {
  return camera?.cameraBase.rotation.y || 0
}

export function vecAfterCameraRotation(vec: Vec2, camera: Camera): Vec2 {
  const rotationY = cameraRotationY(camera);
  const cos = Math.cos(-rotationY);
  const sin = Math.sin(-rotationY);
  return [
    vec[0] * cos - vec[1] * sin,
    vec[0] * sin + vec[1] * cos,
  ];
}
