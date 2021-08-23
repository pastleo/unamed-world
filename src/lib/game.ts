import * as THREE from 'three';
import { Agent } from 'unnamed-network';
import { Player } from './player';
import { Input } from './input';

interface Game {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  light: THREE.DirectionalLight;
  player: Player;
  networkAgent: Agent;
  input: Input,
  time: number;
}

export default Game;
