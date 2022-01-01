(window as any).global = window; // for ipfs-core to work
import { create as createIPFS } from 'ipfs-core';

import type { Game } from './lib/game';

import { IPFS_OPTIONS } from './env';
import { DBG_MODE } from './lib/dbg';

export async function startIpfs(game: Game): Promise<void> {
  const ipfs = await createIPFS(IPFS_OPTIONS);
  game.ipfs = ipfs;

  if (DBG_MODE) {
    (window as any).ipfs = ipfs;
    console.log('window.ipfs created:', ipfs);
  }
}
