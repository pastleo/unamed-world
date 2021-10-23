import update, { resize } from './lib/update';
import { Game, setup } from './lib/game';

import localForage from 'localforage';

setInterval(async () => {
  const value = await localForage.getItem<number>('hello-localForage-cnt') || 0;
  console.log('web', { value });
  await localForage.setItem('hello-localForage-cnt', value + 1);
}, 1000);

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
