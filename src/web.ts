import update, { resize, changeRealm } from './lib/update';
import { Game, setup } from './lib/game';

import { create as createIpfs, IPFS } from 'ipfs-core-min';
//import { create as createIpfs, IPFS } from 'ipfs-core';
import { create as createIpfsClient } from 'ipfs-http-client';
//import { IPFS } from 'ipfs-core-min';
//const { create: createIpfs } = (window as any).Ipfs;
import * as uint8ArrUtils from 'uint8arrays';
import { CID } from 'multiformats/cid';
// @ts-ignore
import WS from 'libp2p-websockets';
// @ts-ignore
import filters from 'libp2p-websockets/src/filters'
// @ts-ignore
import Room from '../tmp/ipfs-pubsub-room.min';
const transportKey = WS.prototype[Symbol.toStringTag]

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
      const ipfs: IPFS = await createIpfs({
        relay: {
          enabled: true, // enable relay dialer/listener (STOP)
          hop: {
            enabled: true // make this node a relay (HOP)
          }
        },
        //libp2p: {
          //config: {
            //transport: {
              // This is added for local demo that allow IP+WS (no SSL/TLS)
              // In a production environment the default filter should be used
              // where only DNS + WSS (that have SSL/TLS) addresses will be dialed by websockets in the browser.
              //[transportKey]: {
                //filter: filters.all
              //}
            //}
          //}
        //}
      });
      (window as any).ipfs = ipfs;
      console.log('window.ipfs:', ipfs);

      const ipfsApi = createIpfsClient({ url: '/ip4/127.0.0.1/tcp/5001' });
      console.log('window.ipfsApi:', ipfsApi);
      (window as any).ipfsApi = ipfsApi;

      const libp2p = (ipfs as any).libp2p;
      (window as any).libp2p = libp2p;
      console.log('window.libp2p:', libp2p);
      console.log('config:', await ipfs.config.getAll());
      const version = await ipfs.version()
      console.log('Version:', version.version)
      const myPeerInfo = await ipfs.id();
      console.log('myPeerInfo:', myPeerInfo);

      console.log('window.CID:', CID);
      (window as any).CID = CID;

      // writing / uploading:
      //const file = await ipfs.add({
        //path: 'hello.txt',
        //content: uint8ArrUtils.fromString('Hello World 101 by PastLeo')
      //});
      //console.log('Added file:', file.path, file.cid.toString())
      //const fileCid = file.cid;

      // reading / downloading:
      //const cid = CID.parse('QmSVy17XmaY6NeSPJdvNTxExzovYpqMfjhjmejKScCimg5');
      //const fileCid = cid;

      // result:
      //const chunks = [];
      //for await (const chunk of ipfs.cat(fileCid)) {
        //chunks.push(chunk);
      //}
      //const data = uint8ArrUtils.concat(chunks);
      //console.log('file cid:', fileCid.toString());
      //console.log('file contents:', uint8ArrUtils.toString(data));

      // circuit-relaying
      (window as any).circuitRelaying = async (browserPeerId?: string, relayAddr: string = '/dns4/ipfs.unamed.world/tcp/443/wss/p2p/12D3KooWFcj6YesjJ8QxmEzraV45gT6N8CWAPpuSGNZ4N96wR5de') => {
        //const relayAddr = '/ip4/127.0.0.1/tcp/4004/ws/p2p/12D3KooWAyKPykdd72N5erpTQ4ZDFsurmND6iXsMiM3XAZU81Utk'; // for example
        await ipfs.swarm.connect(relayAddr);
        console.log('ipfs.swarm.connected to ' + relayAddr);

        if (browserPeerId) {
          //const browserPeerId = '12D3KooWNm7RoLa8YhUJ1joht7K4SKtZ7umys8sbhaNqE1K83pov'; // for example
          const browserAddr = `${relayAddr}/p2p-circuit/p2p/${browserPeerId}`;
          console.log('ipfs.swarm.connecting to ' + browserPeerId);
          await ipfs.swarm.connect(browserAddr);
          console.log('ipfs.swarm.connected to ' + browserPeerId);
        }

        const room = new Room(ipfs, 'pastleo/unamed-world/dev');
        (window as any).room = room;
        console.log('window.room:', room);
        room.on('peer joined', (peer: any) => {
          console.log('peer ' + peer + ' joined')
        })

        room.on('peer left', (peer: any) => {
          console.log('peer ' + peer + ' left')
        })

        // send and receive messages
        room.on('message', (message: any) => {
          if (message.from !== myPeerInfo.id) {
            console.log('got message from ' + message.from + ': ' + uint8ArrUtils.toString(message.data))
          }
        });

        setInterval(() => {
          const rnd = `${(new Date()).toISOString()}: ${Math.random() * 10000}`;
          room.broadcast(rnd)
        }, 2000);
      }
    })();
  }
}

main();
