// @ts-ignore
window.global = window; // for IPFS to work
import { create as createIPFS } from 'ipfs-core';
import UnamedNetwork from 'unamed-network';
import { Game } from './lib/game';

import debug from 'debug';

// @ts-ignore
import WS from 'libp2p-websockets';
// @ts-ignore
import filters from 'libp2p-websockets/src/filters';

const WEB_DEV_IPFS_OPTIONS = {
  // @ts-ignore
  config: { Bootstrap: [] }, preload: { addresses: [] },
  libp2p: {
    config: {
      transport: {
        // In a production environment the default filter should be used
        // where only DNS + WSS addresses will be dialed by websockets in the browser.
        [WS.prototype[Symbol.toStringTag]]: { filter: filters.all }
      }
    }
  }
}

import {
  USE_DEV_IPFS_OPTIONS, IPFS_CONFIG,
  UNAMED_NETWORK_CONFIG, UNAMED_NETWORK_KNOWN_ADDRS,
} from './env';

debug.enable([
  'unamedNetwork:*',
  '-unamedNetwork:start',
  '-unamedNetwork:packet:*',
].join(',')); // for development

export async function startIpfs(game: Game): Promise<void> {
  const ipfs = await createIPFS({
    ...(USE_DEV_IPFS_OPTIONS ? WEB_DEV_IPFS_OPTIONS : {}),
    ...IPFS_CONFIG,
  });
  game.ipfs = ipfs;

  { // development
    (window as any).ipfs = ipfs;
    console.log('window.ipfs created:', ipfs);
  }
}

export async function startUnamedNetwork(game: Game): Promise<void> {
  const network = game.network;

  const unamedNetwork = new UnamedNetwork(game.ipfs, UNAMED_NETWORK_CONFIG);
  await unamedNetwork.start(UNAMED_NETWORK_KNOWN_ADDRS);

  network.unamedNetwork = unamedNetwork;

  { // development
    (window as any).unamedNetwork = unamedNetwork;
    console.log('window.unamedNetwork created:', unamedNetwork);
    console.log('unamedNetwork started, unamedNetwork.idInfo.id:', unamedNetwork.idInfo.id);

    unamedNetwork.on('new-member', ({ memberPeer, room }) => {
      console.log('new-member', { memberPeer, room });
    });
    unamedNetwork.on('room-message', ({ room, fromMember, message }) => {
      console.log('room-message', { room, fromMember, message });
    });
  }
}
