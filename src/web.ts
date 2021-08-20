import setup from './lib/setup';
import Game from './lib/game';

function update(_game: Game, _tDiff: number) {
  //const { objects: { player } } = game;
  //player.rotation.x += 0.001 * tDiff;
  //player.rotation.y += 0.001 * tDiff;
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
window.addEventListener('resize', () => {
  game.camera.aspect = window.innerWidth / window.innerHeight;
  game.camera.updateProjectionMatrix();
  game.renderer.setSize(window.innerWidth, window.innerHeight);
}, false);

startLoop(game);
