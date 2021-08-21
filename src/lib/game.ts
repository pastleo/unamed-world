import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Agent } from 'unnamed-network';

export interface Player {
  sprite: THREE.Sprite;
  state: number;
}

interface Game {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  light: THREE.DirectionalLight;
  objects: {
    player: Player;
  };
  controls: OrbitControls;
  networkAgent: Agent;
  keyPressed: Set<string>;
  time: number;
}

export default Game;
