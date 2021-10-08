import * as Comlink from 'comlink';
import startRealmService from './lib/services/realm';

self.onmessage = event => {
  const { serviceName } = event.data;
  switch (serviceName) {
    case 'realm':
      Comlink.expose(startRealmService());
      break;
  }
}

