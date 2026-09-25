import { describe, expect, it } from 'vitest';
import { analyzePrompt } from '../analyze';
import { PLATFORMS, USE_CASES, type PlatformId, type UseCase } from '../types';
import { ALL_RULES } from './rules';
import { dimensionWeights } from './weights';

function score(
  prompt: string,
  platform: PlatformId = 'claude',
  useCase: UseCase = 'qa',
  modelId?: string,
  effort?: 'none' | 'medium',
) {
  return analyzePrompt({ platform, useCase, mode: 'simple', prompt, modelId, effort }).score!;
}
const ruleIds = (r: ReturnType<typeof score>) => r.findings.map((f) => f.ruleId);

describe('dimensionWeights', () => {
  it('sums to 100 for every platform and use case', () => {
    for (const p of PLATFORMS) {
      for (const u of USE_CASES) {
        const total = Object.values(dimensionWeights(p, u)).reduce((s, w) => s + w, 0);
        expect(total).toBeCloseTo(100);
      }
    }
  });
});

describe('scorePrompt', () => {
  it('returns no score for an empty prompt', () => {
    expect(
      analyzePrompt({ platform: 'claude', useCase: 'qa', mode: 'simple', prompt: '  ' }).score,
    ).toBeNull();
  });

  it('explains every lost point: findings add up to 100 − total', () => {
    for (const prompt of [
      'ideas?',
      'Could you please maybe write something nice? Thanks!!',
      'Summarize this',
    ]) {
      const r = score(prompt, 'gemini', 'writing');
      const lost = r.findings.reduce((s, f) => s + f.points, 0);
      expect(Math.abs(100 - r.total - lost)).toBeLessThan(1);
    }
  });

  it('sorts concrete findings by points recoverable, with the substance gate last', () => {
    const f = score('help me with my essay', 'claude', 'writing').findings;
    expect(f.at(-1)!.ruleId).toBe('engine.substance-gate');
    const concrete = f.slice(0, -1);
    for (let i = 1; i < concrete.length; i++)
      expect(concrete[i - 1]!.points).toBeGreaterThanOrEqual(concrete[i]!.points);
  });

  it('flags aggressive emphasis on Claude only', () => {
    const prompt = 'CRITICAL: you MUST always answer in JSON. NEVER add prose. List three fruits.';
    expect(ruleIds(score(prompt, 'claude'))).toContain('claude.aggressive-emphasis');
    expect(ruleIds(score(prompt, 'openai'))).not.toContain('claude.aggressive-emphasis');
  });

  it('flags "think step by step" only when a reasoning model is selected', () => {
    const prompt = 'Think step by step and explain why the sky is blue in 3 sentences.';
    expect(ruleIds(score(prompt, 'openai', 'qa', 'gpt-6-sol', 'medium'))).toContain(
      'openai.reasoning-micromanaged',
    );
    expect(ruleIds(score(prompt, 'openai', 'qa', 'gpt-6-sol', 'none'))).not.toContain(
      'openai.reasoning-micromanaged',
    );
  });

  it('flags a question placed before long material on Gemini', () => {
    const material =
      'The quarterly figures show steady growth across regions with notable variance in retail. '.repeat(
        40,
      );
    const r = score(`What are the main trends?\n\n${material}`, 'gemini', 'analysis');
    expect(ruleIds(r)).toContain('gemini.question-last');
    expect(
      ruleIds(score(`${material}\n\nWhat are the main trends?`, 'gemini', 'analysis')),
    ).not.toContain('gemini.question-last');
  });

  it('flags filler and missing material', () => {
    const r = score(
      'Can you please give me a summary of the article, thank you so much in advance!',
      'openai',
      'summarization',
    );
    expect(ruleIds(r)).toEqual(
      expect.arrayContaining(['economy.filler', 'context.missing-material']),
    );
  });

  it('does not reward a near-empty prompt for being short', () => {
    expect(score('ideas?', 'openai', 'brainstorming').total).toBeLessThan(50);
  });
});

describe('missing-referent rule', () => {
  it('flags a bare pronoun only in very short prompts', () => {
    expect(ruleIds(score('tell me about it'))).toContain('clarity.missing-referent');
    const longer =
      'Write a warm intro for our pet-shop newsletter so it feels personal to local dog owners.';
    expect(ruleIds(score(longer, 'claude', 'writing'))).not.toContain('clarity.missing-referent');
  });

  it('flags a named document that is not included', () => {
    expect(ruleIds(score('Summarize the article for me', 'claude', 'summarization'))).toContain(
      'clarity.missing-referent',
    );
  });
});

describe('context and topic detection', () => {
  it('scores a deliverable with no topic as weak on every use case', () => {
    for (const useCase of ['writing', 'qa', 'coding'] as const) {
      const r = score('write an essay', 'claude', useCase);
      expect(r.total).toBeLessThan(35);
      expect(ruleIds(r)).toContain('clarity.no-subject');
    }
  });

  it('ranks topic < topic + context', () => {
    const bare = score('write an essay', 'claude', 'writing').total;
    const topic = score('Write an essay about climate change.', 'claude', 'writing').total;
    const full = score(
      'Write a 600-word persuasive essay for my high-school debate class arguing that cities should expand bike lanes. Use two real examples (Copenhagen and Montreal) and end with a call to action.',
      'claude',
      'writing',
    ).total;
    expect(bare).toBeLessThan(topic);
    expect(topic).toBeLessThan(full);
    expect(full).toBeGreaterThanOrEqual(80);
  });

  it('treats pasted material as the topic', () => {
    const report =
      'Revenue grew 12% quarter over quarter driven by enterprise renewals and lower churn. '.repeat(
        8,
      );
    expect(
      ruleIds(score(`Summarize this report:\n\n${report}`, 'gemini', 'summarization')),
    ).not.toContain('clarity.no-subject');
  });

  it('asks for concrete details only when producing something', () => {
    expect(ruleIds(score('How does compound interest work?', 'openai', 'qa'))).not.toContain(
      'context.no-details',
    );
    expect(ruleIds(score('Write a blog post about productivity.', 'openai', 'writing'))).toContain(
      'context.no-details',
    );
  });
});

describe('new checks from non-Anthropic guidance', () => {
  it('flags contradictory length instructions (OpenAI GPT-5 guide)', () => {
    expect(ruleIds(score('Be brief but give a detailed explanation of DNS caching.'))).toContain(
      'clarity.contradiction',
    );
    expect(
      ruleIds(score('Explain DNS caching in under 100 words but at least 300 words.')),
    ).toContain('clarity.contradiction');
    expect(
      ruleIds(
        score('Write a detailed short story about a lighthouse keeper.', 'claude', 'writing'),
      ),
    ).not.toContain('clarity.contradiction');
  });

  it('asks for an "out" when answering from provided text (Microsoft)', () => {
    const doc =
      'The warranty covers parts and labour for 24 months from delivery, excluding accidental damage and wear. '.repeat(
        5,
      );
    const prompt = `${doc}\n\nWhat does the warranty say about batteries?`;
    expect(ruleIds(score(prompt, 'openai', 'qa'))).toContain('output.no-fallback');
    expect(
      ruleIds(score(`${prompt} If it isn't covered in the text, say "not found".`, 'openai', 'qa')),
    ).not.toContain('output.no-fallback');
  });

  it('flags wasted whitespace but not code indentation (Microsoft)', () => {
    const padded =
      'Summarize     the     meeting     notes     below     for     the     team     in     three     bullets.     ';
    expect(ruleIds(score(padded.repeat(3)))).toContain('economy.whitespace');
    const code = 'Explain this function:\n```\nfunction f() {\n        return 1;\n}\n```';
    expect(ruleIds(score(code, 'openai', 'coding'))).not.toContain('economy.whitespace');
  });
});

describe('follow-ups in an ongoing conversation', () => {
  it('softens context checks for a short follow-up, but not for a fresh chat', () => {
    const fresh = analyzePrompt({
      platform: 'claude',
      useCase: 'writing',
      mode: 'simple',
      prompt: 'make it shorter',
    });
    const followUp = analyzePrompt({
      platform: 'claude',
      useCase: 'writing',
      mode: 'simple',
      prompt: 'make it shorter',
      historyTokens: 14_000,
    });
    expect(followUp.score!.total).toBeGreaterThan(fresh.score!.total + 30);
    expect(fresh.score!.total).toBeLessThan(35);
  });

  it('does not flag "it" as a missing referent in an ongoing chat', () => {
    const r = analyzePrompt({
      platform: 'claude',
      useCase: 'qa',
      mode: 'simple',
      prompt: 'tell me more about it',
      historyTokens: 3500,
    });
    expect(r.score!.findings.map((f) => f.ruleId)).not.toContain('clarity.missing-referent');
  });
});

describe('sources', () => {
  it('gives every rule at least one source, and cites more than one publisher overall', () => {
    const publishers = new Set<string>();
    let anthropicOnly = 0;
    for (const rule of ALL_RULES) {
      expect(rule.sources.length).toBeGreaterThan(0);
      for (const s of rule.sources) publishers.add(s.publisher);
      if (rule.sources.every((s) => s.publisher === 'Anthropic')) anthropicOnly++;
    }
    expect(publishers).toEqual(
      new Set(['Anthropic', 'OpenAI', 'Google', 'Microsoft', 'DAIR.AI', 'Research']),
    );
    // Only Claude-specific rules should rest on Anthropic alone.
    const claudeRules = ALL_RULES.filter((r) => r.platforms?.includes('claude')).length;
    expect(anthropicOnly).toBeLessThanOrEqual(claudeRules);
  });
});
