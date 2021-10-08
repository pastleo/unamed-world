import * as Comlink from 'comlink';

export function spawnService<T>(serviceName: string): Comlink.Remote<T> {
  if (typeof window !== 'undefined') {
    const worker = new Worker('web-worker.js');
    worker.postMessage({ serviceName });
    return Comlink.wrap<T>(worker);
  }
}

export function createServiceNextValueFn<T>(): [notifyNewValue: (value: T) => void, nextValue: () => Promise<T>] {
  const values: T[] = [];
  let nextValuePromiseFn: [(value: T) => void, () => void];

  const notifyNewValue = (value: T) => {
    if (nextValuePromiseFn) {
      nextValuePromiseFn[0](value);
      nextValuePromiseFn = null;
    } else {
      values.push(value);
    }
  };
  const nextValue = () => new Promise<T>((resolve, rejects) => {
    if (nextValuePromiseFn) {
      nextValuePromiseFn[1]();
    }
    if (values.length > 0) {
      resolve(values.shift());
    } else {
      nextValuePromiseFn = [resolve, rejects];
    }
  });

  return [notifyNewValue, nextValue];
}

export function createListenToServiceFn<T>(serviceNextValueFn: () => Promise<T>):
(callback: ((value: T) => void)) => (() => void) {
  if (!serviceNextValueFn) return;

  return (callback: ((value: T) => void)) => {
    let enabled = true;
    (async () => {
      while(enabled) {
        const newChunk = await serviceNextValueFn();
        callback(newChunk);
      }
    })();

    return () => {
      enabled = false;
    };
  };
}
