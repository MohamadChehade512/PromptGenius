import type { RewriteStatusResponse } from '@promptgenius/api-contract';
import { useCallback, useEffect, useState } from 'react';
import { getRewriteStatus } from '../lib/api';
import { useApiKey } from '../lib/apiKey';

/** Whether the paid rewrite can run: through the server, or with the person's own API key. */
export function useRewriteStatus(online: boolean) {
  const [status, setStatus] = useState<RewriteStatusResponse | undefined>();
  const hasKey = !!useApiKey();
  const available = online || hasKey;
  const refresh = useCallback(() => {
    getRewriteStatus()
      .then(setStatus)
      .catch(() => setStatus(undefined));
  }, []);
  useEffect(() => {
    if (available) refresh();
  }, [available, hasKey, refresh]);
  return { status: available ? status : undefined, refresh };
}
