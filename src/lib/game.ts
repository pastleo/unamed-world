import * as THREE from 'three';
import { Agent } from 'unnamed-network';
import { Player } from './player';
import { Input } from './input';
import { Realm } from './realm';
import { Camera } from './camera';

interface Game {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: Camera;
  realm: Realm;
  player: Player;
  networkAgent: Agent;
  input: Input,
  time: number;
}

export default Game;
