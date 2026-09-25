import type { TokenCount } from '@promptgenius/core';
import type { ExactStatus } from '../hooks/useExactTokenCount';

const LABELS: Record<TokenCount['method'], string> = {
  estimate: 'estimate',
  'local-tokenizer': 'tokenizer',
  'vendor-api': 'exact',
};

export function TokenBadge({ count, status }: { count: TokenCount; status: ExactStatus }) {
  let title = 'Instant local estimate (about ±10%).';
  if (count.method === 'vendor-api')
    title = "Exact count from the vendor's free token-counting API.";
  if (count.method === 'local-tokenizer') title = 'Counted locally with the o200k_base tokenizer.';
  if (count.method === 'estimate' && status === 'unavailable') {
    title += ' Exact counting needs an API key on the local server.';
  }
  if (count.method === 'estimate' && status === 'error')
    title += ' The exact count request failed.';
  return (
    <span className={`badge badge-${count.method}`} title={title}>
      {status === 'pending' && count.method === 'estimate' ? 'counting…' : LABELS[count.method]}
    </span>
  );
}
