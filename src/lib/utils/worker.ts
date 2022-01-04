import type * as Comlink from 'comlink';

export function createWorkerValueStream<T>(): [notifyNewValue: (value: T) => void, nextValue: () => Promise<T>] {
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

export function listenToWorkerValueStream<T>(workerNextValueFn: () => Promise<T>, callback: ((value: T) => void)): (() => void) {
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

export type ReversedRPC<T, R> = (request: T) => Promise<R>;
export type NextRequest<T, _R> = () => Promise<[T, number]>;
export type ResponseReq<_T, R> = (response: R, id: number, err?: any) => void;

export function createReversedRPC<T, R>(): [RPCFn: ReversedRPC<T, R>, nextRequest: NextRequest<T, R>, responseReq: ResponseReq<T, R>] {
  const [notifyNewValue, nextValue] = createWorkerValueStream<[T, number]>();

  const requests = new Map<number, [(response: R) => void, (err: any) => void]>();
  let incremental = 0;

  const RPCFn = (request: T) => new Promise<R>((resolve, reject) => {
    const id = incremental++;
    requests.set(id, [resolve, reject]);
    notifyNewValue([request, id]);
  });

  const responseReq = (response: R, id: number, err?: any) => {
    const request = requests.get(id);
    if (request) {
      requests.delete(id);
      if (err) {
        request[1](err);
      } else {
        request[0](response);
      }
    }
  }

  return [RPCFn, nextValue, responseReq];
}

export function listenToReversedRPC<T, R>(nextRequest: NextRequest<T, R>, responseReq: ResponseReq<T, R>, callback: ((value: T) => R | Promise<R>)):
(() => void) {
  let enabled = true;
  (async () => {
    while(enabled) {
      const [newChunk, id] = await nextRequest();
      let response: R, err;
      try {
        response = await callback(newChunk);
      } catch (e) {
        err = e;
      }
      responseReq(response, id, err);
    }
  })();

  return () => {
    enabled = false;
  };
}

export function emulateComlinkRemote<T>(RPCs: T): Comlink.Remote<T> {
  return Object.fromEntries(
    Object.entries(RPCs).map(
      ([name, fn]) => ([name, async (...arg: any[]) => await fn(...arg)])
    )
  ) as Comlink.Remote<T>;
}
