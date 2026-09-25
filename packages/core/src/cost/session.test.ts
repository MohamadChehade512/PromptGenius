import { describe, expect, it } from 'vitest';
import { getDefaultModel } from '../config';
import { projectSession } from './session';

const model = getDefaultModel('claude');
const base = {
  model,
  fixedTokens: 2_000,
  userTokensPerTurn: 200,
  assistantTokensPerTurn: 500,
  thinkingTokensPerTurn: 0,
};

describe('projectSession', () => {
  it('resends history, so input grows every turn and total cost grows faster than linearly', () => {
    const s = projectSession({ ...base, turns: 30 });
    expect(s.turns[1]!.inputTokens - s.turns[0]!.inputTokens).toBe(700);
    const last = s.turns[29]!.cumulativeUncached;
    expect(last).toBeGreaterThan(30 * s.turns[0]!.costUncached * 2);
  });

  it('makes later turns cheaper with caching once the prefix is cacheable', () => {
    const s = projectSession({ ...base, turns: 10 });
    expect(s.turns[9]!.costCached).toBeLessThan(s.turns[9]!.costUncached);
    expect(s.turns[9]!.cumulativeCached).toBeLessThan(s.turns[9]!.cumulativeUncached);
  });

  it('gets no cache discount below the model minimum', () => {
    const s = projectSession({
      ...base,
      fixedTokens: 0,
      userTokensPerTurn: 10,
      assistantTokensPerTurn: 10,
      turns: 3,
    });
    for (const t of s.turns) expect(t.costCached).toBeCloseTo(t.costUncached);
    expect(s.cachingApplies).toBe(false);
  });

  it('reads an existing chat history from cache from the first turn', () => {
    const s = projectSession({ ...base, fixedTokens: 20_000, turns: 3, prefixCached: true });
    expect(s.turns[0]!.costCached).toBeLessThan(s.turns[0]!.costUncached);
  });

  it('computes how many turns fit in the context window', () => {
    const s = projectSession({ ...base, turns: 2 });
    expect(s.turnsUntilFull).toBe(Math.floor((model.contextWindow - 2_000) / 700));
  });
});
