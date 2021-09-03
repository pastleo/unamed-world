import * as THREE from 'three';
import { Vec2, Vec3 } from './utils/utils';

export interface Camera {
  camera: THREE.PerspectiveCamera;
  cameraBase: THREE.Object3D;
  cameraAngleBase: THREE.Object3D;
}
const INIT_CAMERA_ANGLE = 45 * Math.PI / 180;
const MAX_CAMERA_ANGLE = 60 * Math.PI / 180;
const MIN_CAMERA_DISTANCE = 4;
const MAX_CAMERA_DISTANCE = 32;

export function create(): Camera {
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

export function resize(width: number, height: number, camera: Camera) {
  camera.camera.aspect = width / height;
  camera.camera.updateProjectionMatrix();
}

export function moveCameraAngle(xyRotations: Vec2, camera: Camera): void {
  camera.cameraAngleBase.rotation.x += xyRotations[1];
  if (camera.cameraAngleBase.rotation.x > MAX_CAMERA_ANGLE) {
    camera.cameraAngleBase.rotation.x = MAX_CAMERA_ANGLE;
  } else if (camera.cameraAngleBase.rotation.x < 0) {
    camera.cameraAngleBase.rotation.x = 0;
  }
  camera.cameraBase.rotation.z += xyRotations[0];
}

export function moveCameraPosition(movedVec: Vec2 | Vec3, camera: Camera): void {
  camera.cameraBase.position.x += movedVec[0];
  camera.cameraBase.position.y += movedVec[1];
  if (movedVec.length >= 3) {
    camera.cameraBase.position.z += movedVec[2];
  }
}

export function adjCameraDistance(distanceDelta: number, camera: Camera): void {
  camera.camera.position.z += distanceDelta;
  if (camera.camera.position.z <= MIN_CAMERA_DISTANCE) {
    camera.camera.position.z = MIN_CAMERA_DISTANCE;
  } else if (camera.camera.position.z >= MAX_CAMERA_DISTANCE) {
    camera.camera.position.z = MAX_CAMERA_DISTANCE;
  }
}
