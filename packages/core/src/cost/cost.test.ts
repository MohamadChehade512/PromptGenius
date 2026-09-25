import { describe, expect, it } from 'vitest';
import { listModels } from '../config';
import { callCost, formatUsd } from './cost';

const sol = listModels('openai').find((m) => m.id === 'gpt-6-sol')!; // $2 / $10, long ctx $4 / $15
const flash = listModels('gemini').find((m) => m.id === 'gemini-3.8-flash')!;

describe('callCost', () => {
  it('prices input, output and thinking per 1M tokens', () => {
    const c = callCost(sol, {
      inputTokens: 100_000,
      outputTokens: 1_000_000,
      thinkingTokens: 500_000,
    });
    expect(c.input).toBeCloseTo(0.2);
    expect(c.output).toBeCloseTo(10);
    expect(c.thinking).toBeCloseTo(5);
    expect(c.total).toBeCloseTo(15.2);
    expect(c.longContext).toBe(false);
  });

  it('switches the whole request to long-context rates above the threshold', () => {
    const c = callCost(sol, { inputTokens: 300_000, outputTokens: 1_000 });
    expect(c.longContext).toBe(true);
    expect(c.input).toBeCloseTo((300_000 * 4) / 1e6);
    expect(c.output).toBeCloseTo((1_000 * 15) / 1e6);
  });

  it('bills cache reads at the discounted rate and writes at the write rate', () => {
    const c = callCost(sol, {
      inputTokens: 10_000,
      cacheReadTokens: 8_000,
      cacheWriteTokens: 1_000,
      outputTokens: 0,
    });
    expect(c.cacheRead).toBeCloseTo((8_000 * 0.2) / 1e6);
    expect(c.cacheWrite).toBeCloseTo((1_000 * 2.5) / 1e6);
    expect(c.input).toBeCloseTo((1_000 * 2) / 1e6);
  });

  it('defaults cache writes to the input price when no premium is listed (Gemini)', () => {
    const c = callCost(flash, {
      inputTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
      outputTokens: 0,
    });
    expect(c.cacheWrite).toBeCloseTo(flash.pricing.input);
  });
});

describe('formatUsd', () => {
  it.each([
    [0, '$0'],
    [0.00005, '<$0.0001'],
    [0.0042, '$0.0042'],
    [0.123, '$0.123'],
    [12.5, '$12.50'],
  ])('%f → %s', (usd, text) => {
    expect(formatUsd(usd)).toBe(text);
  });
});
