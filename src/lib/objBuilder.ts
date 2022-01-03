import type { Game } from './game';

import * as Comlink from 'comlink';

import type { ObjBuilderRPCs } from '../workers/objBuilder';

import type { OffscreenCanvas } from '../lib/utils/web';
import { supportOffscreenCanvas } from '../lib/utils/web'

export interface ObjBuilder {
  worker: Comlink.Remote<ObjBuilderRPCs>;
}

export async function ensureStarted(game: Game): Promise<void> {
  if (game.objBuilder) return;

  const canvas = document.createElement('canvas') as OffscreenCanvas;
  canvas.width = 512;
  canvas.height = 512;

  let worker;
  if (supportOffscreenCanvas) {
    worker = Comlink.wrap<ObjBuilderRPCs>(
      new Worker(new URL('../workers/objBuilder', import.meta.url))
    );
    const offscreenCanvas = canvas.transferControlToOffscreen();
    await worker.useCanvas(
      Comlink.transfer(offscreenCanvas, [offscreenCanvas as any])
    );
  } else {
    const { startWorker } = await import(
      /* webpackChunkName: 'objBuilder' */ '../workers/objBuilder'
    );
    worker = startWorker(false);
    await worker.useCanvas(canvas);
  }

  (window as any).testOffscreenCanvas = async () => {
    const res = await game.objBuilder.worker.drawSomething();
    const img = document.createElement('img');
    img.src = res;
    document.body.appendChild(img);
  }

  game.objBuilder = {
    worker,
  }
}
