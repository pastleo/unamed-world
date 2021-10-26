import update, { resize } from './lib/update';
import { Game, setup } from './lib/game';

function startLoop(game: Game, now: number = 0) {
  const tDiff = now - game.time;
  game.time = now;

  update(game, tDiff);

  requestAnimationFrame(nextNow => startLoop(game, nextNow));
  game.renderer.render(game.scene, game.camera.camera);
}

async function main() {
  const game = await setup();
  (window as any).game = game; // for development

  document.body.appendChild(game.renderer.domElement);

  window.addEventListener('resize', () => {
    resize(game, window.innerWidth, window.innerHeight);
  }, false);

  startLoop(game);
}

main();
