import type { RewriteStatusResponse } from '@promptgenius/api-contract';
import { useCallback, useEffect, useState } from 'react';
import { getRewriteStatus } from '../lib/api';

export function useRewriteStatus(online: boolean) {
  const [status, setStatus] = useState<RewriteStatusResponse | undefined>();
  const refresh = useCallback(() => {
    getRewriteStatus()
      .then(setStatus)
      .catch(() => setStatus(undefined));
  }, []);
  useEffect(() => {
    if (online) refresh();
  }, [online, refresh]);
  return { status, refresh };
}
