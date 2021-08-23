import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Player } from './player';

export interface Input {
  controls: OrbitControls;
  keyPressed: Set<string>;
}

export function setup(renderer: THREE.Renderer, camera: THREE.Camera, player: Player): Input {
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target = player.sprite.position;
  controls.update();

  const keyPressed = new Set<string>();
  window.addEventListener('keydown', event => {
    keyPressed.add(event.key);
  }, false);
  window.addEventListener('keyup', event => {
    keyPressed.delete(event.key);
  }, false);

  return {
    controls,
    keyPressed,
  }
}

export function update(input: Input) {
  input.controls.update();
}
