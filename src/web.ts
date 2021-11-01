import update, { resize, changeRealm } from './lib/update';
import { Game, setup } from './lib/game';

import { getChunk } from './lib/chunk/chunk';
import { Vec2 } from './lib/utils/utils';

function startLoop(game: Game, now: number = 0) {
  const tDiff = now - game.time;
  game.time = now;

  update(game, tDiff);

  requestAnimationFrame(nextNow => startLoop(game, nextNow));
  game.renderer.render(game.scene, game.camera.camera);
}

async function main() {
  const game = await setup();

  { // for development
    (window as any).game = game;
    (window as any).getChunk = (...ij: Vec2) => (
      getChunk(ij, game.realm.currentObj, game.ecs)
    );
  }

  document.body.appendChild(game.renderer.domElement);

  window.addEventListener('resize', () => {
    resize(game, window.innerWidth, window.innerHeight);
  }, false);

  window.addEventListener('hashchange', () => {
    changeRealm(game);
  });

  startLoop(game);
}

main();
