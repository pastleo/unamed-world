import { Game } from './game';

export async function ensureIpfsUNetworkStarted(game: Game): Promise<void> {
  if (game.ipfs && game.network.unamedNetwork) return;

  console.log('start importing ipfs and unamed-network...');
  const { startIpfs, startUnamedNetwork } = await import('../ipfs-unamed-network.js');

  console.log('starting ipfs and unamed-network...');
  await startIpfs(game);
  await startUnamedNetwork(game);
}

