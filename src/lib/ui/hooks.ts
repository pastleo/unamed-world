import { useState, useEffect } from 'react';

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
