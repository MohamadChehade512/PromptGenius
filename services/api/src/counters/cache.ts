import { createHash } from 'node:crypto';
import type { TokenCounter } from './types';

/**
 * Memoizes counts by a hash of (model, text). Prompts are never stored in the clear:
 * only the digest is kept as the key (PLAN.md §3.5, privacy).
 */
export class CachingCounter implements TokenCounter {
  private readonly cache = new Map<string, number>();

  constructor(
    private readonly inner: TokenCounter,
    private readonly maxEntries = 1_000,
  ) {}

  async count(model: string, text: string, signal?: AbortSignal): Promise<number> {
    const key = createHash('sha256').update(model).update('\0').update(text).digest('hex');
    const hit = this.cache.get(key);
    if (hit !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, hit); // refresh LRU position
      return hit;
    }
    const tokens = await this.inner.count(model, text, signal);
    this.cache.set(key, tokens);
    if (this.cache.size > this.maxEntries) this.cache.delete(this.cache.keys().next().value!);
    return tokens;
  }
}
