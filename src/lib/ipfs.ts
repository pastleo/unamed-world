import * as BufferUtils from 'uint8arrays';
import { CID } from 'multiformats/cid'
import * as jsonCodec from 'multiformats/codecs/json'
import { sha256 } from 'multiformats/hashes/sha2'

import debug from 'debug';

import { Game } from './game';

const logger = {
  start: debug('ipfs-start'),
  fetch: debug('fetch'),
};

export async function ensureIpfsStarted(game: Game): Promise<void> {
  if (game.ipfs && game.network.unamedNetwork) return;

  logger.start('start importing ipfs...');
  const { startIpfs } = await import(
    /* webpackChunkName: 'ipfs' */ '../ipfs'
  );

  logger.start('starting ipfs...');
  await startIpfs(game);
}

export async function calcJsonCid(json: any) {
  const bytes = jsonCodec.encode(json);
  const hash = await sha256.digest(bytes);
  return CID.create(1, jsonCodec.code, hash).toString();
}

export async function fetchIpfsJson(ipfsPath: string, game: Game) {
  const chunks = [];
  logger.fetch(`ipfs.files.read('${ipfsPath}') starts...`);

  for await (const chunk of game.ipfs.files.read(ipfsPath)) {
    chunks.push(chunk);
  }
  const data = BufferUtils.concat(chunks);
  const json = JSON.parse(BufferUtils.toString(data));
  logger.fetch('fetchIpfsJson done', { ipfsPath, json });
  return json;
}
