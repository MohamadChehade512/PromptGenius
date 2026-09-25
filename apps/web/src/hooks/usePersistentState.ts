import { useEffect, useState } from 'react';
import { readStorage, writeStorage } from '../lib/storage';

/** useState that remembers its value in localStorage (settings only, never prompts). */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readStorage('local', key, initial));
  useEffect(() => writeStorage('local', key, value), [key, value]);
  return [value, setValue] as const;
}
