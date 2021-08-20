import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Agent } from 'unnamed-network';

interface Game {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  light: THREE.DirectionalLight;
  objects: {
    player: THREE.Sprite;
  };
  controls: OrbitControls;
  networkAgent: Agent;
  time: number;
}

export default Game;
