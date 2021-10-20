import * as THREE from 'three';
import { Game } from './game';
import { Vec2, Vec3 } from './utils/utils';

import {
  INIT_CAMERA_ANGLE,
  MAX_CAMERA_ANGLE, MIN_CAMERA_ANGLE,
  MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE,
} from './consts';

export interface Camera {
  camera: THREE.PerspectiveCamera;
  cameraBase: THREE.Object3D;
  cameraAngleBase: THREE.Object3D;
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
    camera, cameraBase, cameraAngleBase
  }
}

export function addToScene(camera: Camera, game: Game) {
  game.scene.add(camera.cameraBase);
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

export function setCameraPosition(position: Vec3, camera: Camera): void {
  camera.cameraBase.position.x = position[0];
  camera.cameraBase.position.y = position[1];
  camera.cameraBase.position.z = position[2];
}

export function setCameraPositionY(y: number, camera: Camera): void {
  camera.cameraBase.position.y = y;
}

export function moveCameraPosition(movedVec: Vec3, camera: Camera): void {
  camera.cameraBase.position.x += movedVec[0];
  camera.cameraBase.position.y += movedVec[1];
  camera.cameraBase.position.z += movedVec[2];
}

export function adjCameraDistance(distanceDelta: number, camera: Camera): void {
  camera.camera.position.z += distanceDelta;
  if (camera.camera.position.z <= MIN_CAMERA_DISTANCE) {
    camera.camera.position.z = MIN_CAMERA_DISTANCE;
  } else if (camera.camera.position.z >= MAX_CAMERA_DISTANCE) {
    camera.camera.position.z = MAX_CAMERA_DISTANCE;
  }
}

export function vecAfterCameraRotation(vec: Vec2, camera: Camera): Vec2 {
  const cos = Math.cos(camera.cameraBase.rotation.y);
  const sin = Math.sin(camera.cameraBase.rotation.y);
  return [
    vec[0] * cos - vec[1] * sin,
    vec[0] * sin + vec[1] * cos,
  ];
}
