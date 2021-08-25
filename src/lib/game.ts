import * as THREE from 'three';
import { Agent } from 'unnamed-network';
import { Player } from './player';
import { Input } from './input';
import { Realm } from './realm';

interface Game {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  cameraBase: THREE.Object3D;
  realm: Realm;
  player: Player;
  networkAgent: Agent;
  input: Input,
  time: number;
}

export default Game;
