import update, { resize, updateBrowsing } from './lib/update';
import { Game, setup } from './lib/game';

import { DBG_MODE } from './lib/dbg';

function startLoop(game: Game, now: number = 0) {
  const tDiff = now - game.time;
  game.time = now;

  try {
    update(game, tDiff);
  } catch (error) {
    console.error(`main: error during game update @ ${game.time}`);
    if (DBG_MODE) throw error;
    console.error(error);
  }

  requestAnimationFrame(nextNow => startLoop(game, nextNow));
  game.renderer.render(game.scene, game.camera.camera);
}

async function main() {
  const game = await setup();

  window.addEventListener('resize', () => {
    resize(game, window.innerWidth, window.innerHeight);
  }, false);

  window.addEventListener('popstate', _event => {
    // _event.state may be used
    updateBrowsing(game);
  });

  //window.addEventListener('beforeunload', event => {
    //if (game.realm.state === 'changed' && !DBG_MODE) {
      //event.preventDefault();
      //event.returnValue = 'Changes are not saved, are you sure?';
    //}
  //}, { capture: true });

  startLoop(game);

  if (DBG_MODE) {
    (window as any).game = game;
  }
}

main();
