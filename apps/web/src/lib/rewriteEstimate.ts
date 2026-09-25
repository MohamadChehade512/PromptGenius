import type { RewriteStatusResponse } from '@promptgenius/api-contract';

/**
 * Pre-click price shown on the paid button (PLAN.md §3.6 rule 2). Uses the prompt's token
 * count, the fixed rewrite overhead, and the rewrite model's prices. The rewritten prompt
 * is typically ~1.3x the original plus a short change list, with about as much thinking again.
 */
export function estimateRewriteUsd(promptTokens: number, status: RewriteStatusResponse): number {
  const input = status.overheadTokens + promptTokens;
  const visible = Math.ceil(promptTokens * 1.3) + 250;
  const output = visible * 2;
  return (input * status.pricing.input + output * status.pricing.output) / 1_000_000;
}
