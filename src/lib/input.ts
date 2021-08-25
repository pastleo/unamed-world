import { Player } from './player';

export interface Input {
  keyPressed: Set<string>;
}

export function setup(renderer: THREE.Renderer, camera: THREE.Camera, player: Player): Input {

  const keyPressed = new Set<string>();
  window.addEventListener('keydown', event => {
    keyPressed.add(event.key);
  }, false);
  window.addEventListener('keyup', event => {
    keyPressed.delete(event.key);
  }, false);

  return {
    keyPressed,
  }
}

export function update(_input: Input) {
}
