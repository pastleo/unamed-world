import * as Comlink from 'comlink';
import startRealmService from './lib/worker/realm';

import localForage from 'localforage';

setInterval(async () => {
  const value = await localForage.getItem<number>('hello-localForage-cnt') || 0;
  console.log('worker', { value });
  await localForage.setItem('hello-localForage-cnt', value + 1);
}, 1000);

self.onmessage = event => {
  const { workerName } = event.data;
  switch (workerName) {
    case 'realm':
      Comlink.expose(startRealmService());
      break;
  }
}

