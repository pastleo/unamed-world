import * as THREE from 'three';
import setup from './lib/setup';
import Game from './lib/game';

function update(game: Game, tDiff: number) {
  if (game.keyPressed.has('a')) {
    game.objects.player.sprite.position.x -= 0.01 * tDiff;
    game.camera.position.x -= 0.01 * tDiff;
  } else if (game.keyPressed.has('d')) {
    game.objects.player.sprite.position.x += 0.01 * tDiff;
    game.camera.position.x += 0.01 * tDiff;
  }

  if (game.keyPressed.has('w')) {
    game.objects.player.sprite.position.y += 0.01 * tDiff;
    game.camera.position.y += 0.01 * tDiff;
  } else if (game.keyPressed.has('s')) {
    game.objects.player.sprite.position.y -= 0.01 * tDiff;
    game.camera.position.y -= 0.01 * tDiff;
  }

  if (Math.sin(game.time * 0.005) > 0) {
    game.objects.player.sprite.material.map.offset.x = 1/6;
  } else {
    game.objects.player.sprite.material.map.offset.x = 0;
  }

  game.controls.update();
}

function startLoop(game: Game, now: number = 0) {
  const tDiff = now - game.time;
  game.time = now;

  update(game, tDiff);

  requestAnimationFrame(nextNow => startLoop(game, nextNow));
  game.renderer.render(game.scene, game.camera);
}

const game = setup();

document.body.appendChild(game.renderer.domElement);

window.addEventListener('keydown', event => {
  game.keyPressed.add(event.key);
}, false);
window.addEventListener('keyup', event => {
  game.keyPressed.delete(event.key);
}, false);
window.addEventListener('resize', () => {
  game.camera.aspect = window.innerWidth / window.innerHeight;
  game.camera.updateProjectionMatrix();
  game.renderer.setSize(window.innerWidth, window.innerHeight);
}, false);

startLoop(game);
