import type { HealthResponse } from '@promptgenius/api-contract';
import { useEffect, useState } from 'react';
import { getHealth } from '../lib/api';

export type Health =
  { state: 'checking' } | { state: 'online'; data: HealthResponse } | { state: 'offline' };

export function useHealth(): Health {
  const [health, setHealth] = useState<Health>({ state: 'checking' });
  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then((data) => setHealth({ state: 'online', data }))
      .catch(() => {
        if (!controller.signal.aborted) setHealth({ state: 'offline' });
      });
    return () => controller.abort();
  }, []);
  return health;
}
