import * as Comlink from 'comlink';
import startRealmService from './lib/worker/realm';

self.onmessage = event => {
  const { workerName } = event.data;
  switch (workerName) {
    case 'realm':
      Comlink.expose(startRealmService());
      break;
  }
}

