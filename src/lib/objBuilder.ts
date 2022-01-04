import type { Game } from './game';

import * as Comlink from 'comlink';

import type { ObjBuilderRPCs } from '../workers/objBuilder';

import type { OffscreenCanvas } from '../lib/utils/web';
import { supportOffscreenCanvas } from '../lib/utils/web'
import { listenToReversedRPC } from '../lib/utils/worker';

export interface ObjBuilder {
  worker: Comlink.Remote<ObjBuilderRPCs>;
}

export async function ensureStarted(game: Game): Promise<void> {
  if (game.objBuilder) return;

  let worker: Comlink.Remote<ObjBuilderRPCs>;
  if (supportOffscreenCanvas) {
    worker = Comlink.wrap<ObjBuilderRPCs>(
      new Worker(new URL('../workers/objBuilder', import.meta.url))
    );
  } else {
    const { startWorker } = await import(
      /* webpackChunkName: 'objBuilder' */ '../workers/objBuilder'
    );
    worker = startWorker(false);
  }

  game.objBuilder = {
    worker,
  }

  listenToReversedRPC(
    game.objBuilder.worker.nextRequestCanvas,
    game.objBuilder.worker.responseCanvas,
    async ({ width, height }) => {
      const canvas = document.createElement('canvas') as OffscreenCanvas;
      canvas.width = width;
      canvas.height = height;

      if (supportOffscreenCanvas) {
        const offscreenCanvas = canvas.transferControlToOffscreen();
        return Comlink.transfer(offscreenCanvas, [offscreenCanvas as any]);
      } else {
        return canvas;
      }
    }
  );
}
