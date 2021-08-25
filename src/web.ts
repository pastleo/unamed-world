import setup from './lib/setup';
import update, { resize } from './lib/update';
import Game from './lib/game';

function startLoop(game: Game, now: number = 0) {
  const tDiff = now - game.time;
  game.time = now;

  update(game, tDiff);

  //if (now < 10000) {
    requestAnimationFrame(nextNow => startLoop(game, nextNow));
  //}
  game.renderer.render(game.scene, game.camera);
}

const game = setup();
(window as any).game = game; // for development

document.body.appendChild(game.renderer.domElement);

window.addEventListener('resize', () => {
  resize(game, window.innerWidth, window.innerHeight);
}, false);

startLoop(game);
