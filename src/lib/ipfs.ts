import debug from 'debug';

import { Game } from './game';

const log = debug('ipfs-start');

export async function ensureIpfsStarted(game: Game): Promise<void> {
  if (game.ipfs && game.network.unamedNetwork) return;

  log('start importing ipfs...');
  const { startIpfs } = await import(
    /* webpackChunkName: 'ipfs' */ '../ipfs'
  );

  log('starting ipfs...');
  await startIpfs(game);
}

