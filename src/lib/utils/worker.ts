import * as Comlink from 'comlink';

// TODO: make workerName be 'realm' | '...'
export function spawnWorker<T>(workerName: string): Comlink.Remote<T> {
  if (typeof window !== 'undefined') {
    const worker = new Worker('web-worker.js');
    worker.postMessage({ workerName });
    return Comlink.wrap<T>(worker);
  }
}

export function createWorkerNextValueFn<T>(): [notifyNewValue: (value: T) => void, nextValue: () => Promise<T>] {
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

export function listenToWorkerNextValue<T>(workerNextValueFn: () => Promise<T>, callback: ((value: T) => void)):
(() => void) {
  let enabled = true;
  (async () => {
    while(enabled) {
      const newChunk = await workerNextValueFn();
      callback(newChunk);
    }
  })();

  return () => {
    enabled = false;
  };
}

export function createListenToWorkerFn<T>(workerNextValueFn: () => Promise<T>):
(callback: ((value: T) => void)) => (() => void) {
  if (!workerNextValueFn) return;

  return (callback: ((value: T) => void)) => {
    let enabled = true;
    (async () => {
      while(enabled) {
        const newChunk = await workerNextValueFn();
        callback(newChunk);
      }
    })();

    return () => {
      enabled = false;
    };
  };
}
