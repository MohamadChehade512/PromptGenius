import type { ModelSpec, Pricing } from '../config';

const PER_MILLION = 1_000_000;

export interface CallTokens {
  /** All input tokens for the request, including any served from or written to cache. */
  inputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  /** Visible output. */
  outputTokens: number;
  /** Reasoning/thinking tokens: billed as output on all three platforms. */
  thinkingTokens?: number;
}

export interface CostBreakdown {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
  thinking: number;
  total: number;
  /** True when the long-context tier (whole request) applied. */
  longContext: boolean;
}

export function effectiveRates(pricing: Pricing, inputTokens: number) {
  const lc = pricing.longContext;
  const long = !!lc && inputTokens > lc.thresholdTokens;
  const input = long ? lc.input : pricing.input;
  const output = long ? lc.output : pricing.output;
  const scale = input / pricing.input;
  return {
    long,
    input,
    output,
    cacheRead: (pricing.cacheRead ?? pricing.input * 0.1) * scale,
    cacheWrite: (pricing.cacheWrite ?? pricing.input) * scale,
  };
}

export function callCost(model: Pick<ModelSpec, 'pricing'>, t: CallTokens): CostBreakdown {
  const rates = effectiveRates(model.pricing, t.inputTokens);
  const read = Math.min(t.cacheReadTokens ?? 0, t.inputTokens);
  const write = Math.min(t.cacheWriteTokens ?? 0, t.inputTokens - read);
  const uncached = t.inputTokens - read - write;

  const input = (uncached * rates.input) / PER_MILLION;
  const cacheRead = (read * rates.cacheRead) / PER_MILLION;
  const cacheWrite = (write * rates.cacheWrite) / PER_MILLION;
  const output = (t.outputTokens * rates.output) / PER_MILLION;
  const thinking = ((t.thinkingTokens ?? 0) * rates.output) / PER_MILLION;
  return {
    input,
    cacheRead,
    cacheWrite,
    output,
    thinking,
    total: input + cacheRead + cacheWrite + output + thinking,
    longContext: rates.long,
  };
}

/** "$0.0042", "$1.23", "<$0.0001": enough precision to compare tiny per-call costs. */
export function formatUsd(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.0001) return '<$0.0001';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
