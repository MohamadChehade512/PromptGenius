import { describe, expect, it } from 'vitest';
import { analyzePrompt } from './analyze';
import { getDefaultModel, listConsumerPlans } from './config';

const prompt = 'Explain how vaccines work to a 10-year-old in 3 short paragraphs.';

describe('analyzePrompt', () => {
  it('uses the consumer plan window in Simple mode and the model window in Advanced mode', () => {
    const simple = analyzePrompt({
      platform: 'gemini',
      useCase: 'qa',
      mode: 'simple',
      prompt,
      planId: 'gemini-free',
    });
    expect(simple.context.windowTokens).toBe(listConsumerPlans('gemini')[0]!.contextWindow);
    const adv = analyzePrompt({ platform: 'gemini', useCase: 'qa', mode: 'advanced', prompt });
    expect(adv.context.windowTokens).toBe(getDefaultModel('gemini').contextWindow);
  });

  it('prefers an exact token count over the estimate', () => {
    const r = analyzePrompt({
      platform: 'claude',
      useCase: 'qa',
      mode: 'simple',
      prompt,
      exactPromptTokens: { tokens: 42, method: 'vendor-api' },
    });
    expect(r.promptTokens).toEqual({ tokens: 42, method: 'vendor-api' });
  });

  it('adds the system prompt and attachments only in Advanced mode', () => {
    const extra = { systemPrompt: 'You are a pediatric nurse.', attachmentTokens: 1000 };
    const simple = analyzePrompt({
      platform: 'claude',
      useCase: 'qa',
      mode: 'simple',
      prompt,
      ...extra,
    });
    const adv = analyzePrompt({
      platform: 'claude',
      useCase: 'qa',
      mode: 'advanced',
      prompt,
      ...extra,
    });
    expect(simple.fixedTokens).toBe(0);
    expect(adv.fixedTokens).toBeGreaterThan(1000);
    expect(adv.cost.mid).toBeGreaterThan(simple.cost.mid);
  });

  it('projects a session only for multi-turn Advanced analyses', () => {
    expect(
      analyzePrompt({ platform: 'openai', useCase: 'qa', mode: 'advanced', prompt, turns: 1 })
        .session,
    ).toBeNull();
    const s = analyzePrompt({
      platform: 'openai',
      useCase: 'qa',
      mode: 'advanced',
      prompt,
      turns: 20,
    }).session;
    expect(s?.turns).toHaveLength(20);
  });

  it('falls back to the default model and effort for unknown values', () => {
    const r = analyzePrompt({
      platform: 'openai',
      useCase: 'qa',
      mode: 'simple',
      prompt,
      modelId: 'nope',
      effort: 'max',
    });
    expect(r.model.id).toBe(getDefaultModel('openai').id);
    expect(r.effort).toBe('max');
    const astra = analyzePrompt({
      platform: 'openai',
      useCase: 'qa',
      mode: 'simple',
      prompt,
      modelId: 'gpt-6-astra',
      effort: 'none',
    });
    expect(astra.effort).toBe(astra.model.reasoning!.default);
  });

  it('expresses cost relative to a typical message', () => {
    const r = analyzePrompt({ platform: 'claude', useCase: 'qa', mode: 'simple', prompt });
    expect(r.typicalMessages).toBeGreaterThan(0);
  });
});

describe('conversation history', () => {
  const base = { platform: 'claude' as const, useCase: 'qa' as const, prompt };

  it('adds earlier messages to input tokens, context use and cost', () => {
    const fresh = analyzePrompt({ ...base, mode: 'advanced' });
    const ongoing = analyzePrompt({ ...base, mode: 'advanced', historyTokens: 14_000 });
    expect(ongoing.inputTokens).toBe(fresh.inputTokens + 14_000);
    expect(ongoing.context.used.mid).toBe(fresh.context.used.mid + 14_000);
    expect(ongoing.cost.mid).toBeGreaterThan(fresh.cost.mid);
  });

  it('prices the resent history at the cache rate when it is cacheable', () => {
    const r = analyzePrompt({ ...base, mode: 'advanced', historyTokens: 14_000 });
    expect(r.cost.cacheApplies).toBe(true);
    expect(r.cost.midWithCache).toBeLessThan(r.cost.mid);
    const tiny = analyzePrompt({ ...base, mode: 'advanced', historyTokens: 100 });
    expect(tiny.cost.cacheApplies).toBe(false);
  });

  it('counts history in Simple mode too (chat usage limits)', () => {
    const fresh = analyzePrompt({ ...base, mode: 'simple' });
    const ongoing = analyzePrompt({ ...base, mode: 'simple', historyTokens: 35_000 });
    expect(ongoing.typicalMessages).toBeGreaterThan(fresh.typicalMessages * 5);
  });

  it('starts the session projection from the existing history', () => {
    const r = analyzePrompt({ ...base, mode: 'advanced', historyTokens: 20_000, turns: 5 });
    expect(r.session!.turns[0]!.inputTokens).toBeGreaterThan(20_000);
  });

  it('warns about context rot and overflow', () => {
    expect(
      analyzePrompt({ ...base, mode: 'simple', historyTokens: 40_000 }).warnings.map((w) => w.id),
    ).toContain('context-rot');
    const over = analyzePrompt({
      ...base,
      mode: 'simple',
      planId: 'claude-paid',
      historyTokens: 250_000,
    });
    expect(over.warnings.map((w) => w.id)).toContain('overflow');
    expect(analyzePrompt({ ...base, mode: 'simple' }).warnings).toHaveLength(0);
  });
});
