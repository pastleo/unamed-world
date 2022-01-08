import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';

export function useDelayedState<T>(initState: T, delay: number): [state: T, delayedState: T, setState: (newState: T) => void] {
  const [state, setState] = useState<T>(initState);
  const [delayedState, setDelayedState] = useState(state);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDelayedState(state);
    }, delay);

    return () => {
      clearTimeout(timeout);
    };

  }, [state]);

  return [state, delayedState, setState];
}

export function useRefWithDelayedSetter<T>(initValue: T, timeout: number): [ref: React.MutableRefObject<T>, setValueLatter: (newValue: T) => void] {
  const ref = useRef<T>(initValue);
  const delayedSetterTimeout = useRef(null);
  const setValueLatter = useCallback((newValue: T) => {
    if (delayedSetterTimeout.current) clearTimeout(delayedSetterTimeout.current);
    delayedSetterTimeout.current = setTimeout(() => {
      ref.current = newValue;
    }, timeout);
  }, []);

  return [ref, setValueLatter];
}

export function usePromise<T>(deps: React.DependencyList): [promise: Promise<T>, resolveOfPromise: (resolved: T) => void] {
  return useMemo(() => {
    let resolveTmp;
    const promise = new Promise<T>(resolve => {
      resolveTmp = resolve;
    });

    return [promise, resolveTmp];
  }, deps);
}
