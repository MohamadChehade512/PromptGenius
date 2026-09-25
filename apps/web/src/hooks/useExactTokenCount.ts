import { loadOpenAITokenizer, type PlatformId, type TokenCount } from '@promptgenius/core';
import { useEffect, useMemo, useState } from 'react';
import { countTokens } from '../lib/api';

export type ExactStatus = 'idle' | 'pending' | 'exact' | 'unavailable' | 'error';

const cache = new Map<string, number>();
function remember(key: string, tokens: number) {
  cache.set(key, tokens);
  if (cache.size > 300) cache.delete(cache.keys().next().value!);
}

/**
 * Exact token count, replacing the instant estimate (PLAN.md §2.2):
 * - OpenAI: local o200k tokenizer (lazy-loaded), after a short debounce.
 * - Claude / Gemini: free vendor count API via our server, after ~800 ms idle.
 * Results are keyed by (platform, model, text), so a stale count never shows for new text.
 */
export function useExactTokenCount(params: {
  platform: PlatformId;
  model: string;
  text: string;
  serverAvailable: boolean;
}): { count: TokenCount | undefined; status: ExactStatus } {
  const { platform, model, text, serverAvailable } = params;
  const key = `${platform}\0${model}\0${text}`;
  const hasText = text.trim().length > 0;
  const cached = cache.get(key);
  const canCount = platform === 'openai' || serverAvailable;
  const needsCount = hasText && cached === undefined && canCount;
  const [result, setResult] = useState<{ key: string; tokens?: number; failed?: boolean }>({
    key: '',
  });

  useEffect(() => {
    if (!needsCount) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        const work =
          platform === 'openai'
            ? loadOpenAITokenizer().then((count) => count(text))
            : countTokens({ platform, model, text }, controller.signal).then((r) => r.tokens);
        work
          .then((tokens) => {
            remember(key, tokens);
            if (!controller.signal.aborted) setResult({ key, tokens });
          })
          .catch(() => {
            if (!controller.signal.aborted) setResult({ key, failed: true });
          });
      },
      platform === 'openai' ? 150 : 800,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, needsCount, platform, model, text]);

  const current = result.key === key ? result : undefined;
  const tokens = cached ?? current?.tokens;
  const count = useMemo<TokenCount | undefined>(
    () =>
      tokens === undefined
        ? undefined
        : { tokens, method: platform === 'openai' ? 'local-tokenizer' : 'vendor-api' },
    [tokens, platform],
  );

  let status: ExactStatus;
  if (!hasText) status = 'idle';
  else if (tokens !== undefined) status = 'exact';
  else if (!canCount) status = 'unavailable';
  else if (current?.failed) status = 'error';
  else status = 'pending';

  return { count: hasText ? count : undefined, status };
}
