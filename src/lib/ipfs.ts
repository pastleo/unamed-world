import { createIPFS, WEB_DEV_IPFS_OPTIONS } from 'unamed-network';
import { IPFS } from 'ipfs-core';

import { Game } from './game';

import { USE_DEV_IPFS_OPTIONS, IPFS_CONFIG } from '../env';

export async function start(_game: Game): Promise<IPFS> {
  const ipfs = await createIPFS({
    ...(USE_DEV_IPFS_OPTIONS ? WEB_DEV_IPFS_OPTIONS : {}),
    ...IPFS_CONFIG,
  });

  { // development
    (window as any).ipfs = ipfs;
    console.log('window.ipfs created:', ipfs);
  }

  return ipfs;
}
