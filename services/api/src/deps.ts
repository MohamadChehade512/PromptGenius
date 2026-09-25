import type { RateLimiter } from './ratelimit/memory';
import type { Rewriter } from './rewrite/types';
import type { SpendStore } from './spend/types';
import type { TokenCounter } from './counters/types';

/**
 * Everything environment-specific, injected into the app (PLAN.md §3.3). Local dev wires
 * file/memory implementations; Phase 3 wires DynamoDB/Secrets Manager behind the same types.
 */
export interface AppDeps {
  counters: { claude?: TokenCounter; gemini?: TokenCounter };
  rewriter?: Rewriter;
  spend: SpendStore;
  limiter: RateLimiter;
}

export const RATE_LIMITS = {
  count: { max: 120, windowMs: 60_000 },
  rewrite: { max: 10, windowMs: 10 * 60_000 },
} as const;
