import update, { resize, changeRealm } from './lib/update';
import { Game, setup } from './lib/game';

import { create as createIpfs } from 'ipfs-core-min';
import * as uint8ArrUtils from 'uint8arrays';
import { CID } from 'multiformats/cid';

function startLoop(game: Game, now: number = 0) {
  const tDiff = now - game.time;
  game.time = now;

  update(game, tDiff);

  requestAnimationFrame(nextNow => startLoop(game, nextNow));
  game.renderer.render(game.scene, game.camera.camera);
}

async function main() {
  const game = await setup();

  document.body.appendChild(game.renderer.domElement);

  window.addEventListener('resize', () => {
    resize(game, window.innerWidth, window.innerHeight);
  }, false);

  window.addEventListener('hashchange', () => {
    changeRealm(game);
  });

  startLoop(game);

  { // for development
    (window as any).game = game;

    (async () => {
      console.log({ createIpfs });
      const ipfs = await createIpfs();
      (window as any).ipfs = ipfs;
      console.log('window.ipfs:', ipfs);

      const version = await ipfs.version()
      console.log('Version:', version.version)

      // writing / uploading:
      //const file = await ipfs.add({
        //path: 'hello.txt',
        //content: uint8ArrUtils.fromString('Hello World 101 by PastLeo')
      //});
      //console.log('Added file:', file.path, file.cid.toString())
      //const fileCid = file.cid;

      // reading / downloading:
      const cid = CID.parse('QmSVy17XmaY6NeSPJdvNTxExzovYpqMfjhjmejKScCimg5');
      const fileCid = cid;

      // result:
      const chunks = [];
      for await (const chunk of ipfs.cat(fileCid)) {
        chunks.push(chunk);
      }
      const data = uint8ArrUtils.concat(chunks)
      console.log('file cid:', fileCid.toString())
      console.log('file contents:', uint8ArrUtils.toString(data))
    })();
  }
}

main();
