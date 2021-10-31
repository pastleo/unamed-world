import update, { resize, changeRealm } from './lib/update';
import { Game, setup } from './lib/game';

import Delatin from 'delatin';

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

  window.addEventListener('hashchange', () => {
    changeRealm(game);
  });

  { // survey
    (window as any).Delatin = Delatin;
    const d0 = new Delatin(Array(256).fill(0), 16, 16);
    d0.run(0.3);
    console.log('d0', d0.coords, d0.triangles);

    const d1 = new Delatin(Array(256).fill(null).map(() => Math.random()), 16, 16)
    d1.run(0.3);
    console.log('d1', d1.coords, d1.triangles);
  }

  startLoop(game);
}

main();
