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

describe('round-2 rules (coding / writing / Q&A calibration, 2026-09-30)', () => {
  it('flags a bug report with nothing to diagnose, less so with an exact error', () => {
    const bare = score('why is my react app slow', 'gemini', 'coding');
    expect(ruleIds(bare)).toContain('context.no-repro');
    const withError = score(
      'My Flask app throws "TypeError: Object of type datetime is not JSON serializable". How do I fix it?',
      'openai',
      'coding',
    );
    const f = withError.findings.find((x) => x.ruleId === 'context.no-repro')!;
    expect(f.message).toContain('error message');
    expect(withError.total).toBeGreaterThan(bare.total + 25);
  });

  it("doesn't ask for a language on a conceptual question", () => {
    const r = score('What is the difference between a process and a thread?', 'gemini', 'coding');
    expect(ruleIds(r)).not.toContain('context.coding-stack');
    expect(ruleIds(score('Write a function that sorts a list.', 'claude', 'coding'))).toContain(
      'context.coding-stack',
    );
  });

  it('treats shouting as a clarity problem', () => {
    const r = score(
      'I NEED A COVER LETTER NOW!!! MAKE IT PERFECT AND PROFESSIONAL!!!',
      'openai',
      'writing',
    );
    expect(ruleIds(r)).toContain('clarity.shouting');
    expect(r.total).toBeLessThan(50);
  });

  it('asks for the specific question behind "tell me everything"', () => {
    const r = score('Tell me absolutely everything you know about history, leave nothing out.');
    expect(ruleIds(r)).toContain('clarity.no-focus');
    expect(r.total).toBeLessThan(50);
  });

  it('needs personal facts for personal pieces, less when the person is named', () => {
    const detail = (p: string) =>
      score(p, 'claude', 'writing').findings.find((f) => f.ruleId === 'context.no-details');
    expect(detail('can u write me a speech for the wedding')!.penalty).toBeCloseTo(0.7);
    expect(detail('Write a eulogy for my grandmother.')!.penalty).toBeCloseTo(0.4);
  });

  it('reads first-person situations and named audiences as context', () => {
    const r = score(
      "I'm the best man at my brother Sam's wedding. Write a 3-minute toast for a mixed crowd of family and college friends, funny but kind.",
      'openai',
      'writing',
    );
    expect(ruleIds(r)).not.toContain('context.no-purpose');
    expect(ruleIds(r)).not.toContain('context.no-audience');
  });

  it("doesn't treat a dummy 'it' as a missing reference", () => {
    expect(ruleIds(score('Is it better to rent or buy a house?'))).not.toContain(
      'clarity.missing-referent',
    );
    expect(ruleIds(score('Which one should I pick?'))).toContain('clarity.missing-referent');
  });

  it('ignores greetings and hype when looking for a topic', () => {
    expect(
      ruleIds(
        score(
          'hi can you please answer a question for me thank you so much i really appreciate it',
        ),
      ),
    ).toContain('clarity.no-subject');
    expect(
      ruleIds(
        score(
          'Write me a really really good and amazing social media post that will go viral and get tons of likes',
          'openai',
          'writing',
        ),
      ),
    ).toContain('clarity.no-subject');
  });
});

describe('project access (workspace) mode', () => {
  const run = (prompt: string, workspace: boolean, useCase: UseCase = 'coding') =>
    analyzePrompt({ platform: 'claude', useCase, mode: 'simple', prompt, workspace }).score!;

  it('stops asking for code and stack the tool can already read', () => {
    const prompt =
      'Refactor the checkout handler in src/payments/checkout.ts to use the new PaymentClient. Keep the public API unchanged and make sure pnpm test passes.';
    const chat = ruleIds(run(prompt, false));
    const agent = ruleIds(run(prompt, true));
    expect(chat).toContain('context.coding-stack');
    for (const id of [
      'context.coding-stack',
      'clarity.missing-referent',
      'context.missing-material',
    ])
      expect(agent).not.toContain(id);
  });

  it("scores Anthropic's Claude Code before/after examples in the right order", () => {
    const before = run('fix the login bug', true);
    const after = run(
      'users report that login fails after session timeout. check the auth flow in src/auth/, especially token refresh. write a failing test that reproduces the issue, then fix it',
      true,
    );
    // "the login" names the area; what's missing is the symptom and a way to verify.
    expect(ruleIds(before)).toEqual(
      expect.arrayContaining(['agent.no-symptom', 'agent.no-verification']),
    );
    expect(after.total).toBeGreaterThanOrEqual(85);
    expect(after.total - before.total).toBeGreaterThan(30);
  });

  it('asks how to verify a change, but not a question about the code', () => {
    expect(ruleIds(run('Add a dark mode toggle to the settings page.', true))).toContain(
      'agent.no-verification',
    );
    expect(ruleIds(run('How does logging work in this repo?', true, 'qa'))).not.toContain(
      'agent.no-verification',
    );
  });

  it("doesn't treat a long question as a change request", () => {
    const question =
      'There are many cases where I am working on a coding project and refer to files it does not have. Is there any way I can set a toggle to say it has the context and files required? Inside the tool this would not make sense without the code.';
    const ids = ruleIds(run(question, true, 'qa'));
    expect(ids.some((id) => id.startsWith('agent.'))).toBe(false);
  });

  it('never applies the agent checks without the toggle', () => {
    const ids = ruleIds(run('Add a dark mode toggle to the settings page.', false));
    expect(ids.some((id) => id.startsWith('agent.'))).toBe(false);
  });
});

describe('project toggle never lowers a score (user report, 2026-09-30)', () => {
  const run = (prompt: string, workspace: boolean, useCase: UseCase = 'qa') =>
    analyzePrompt({ platform: 'claude', useCase, mode: 'simple', prompt, workspace }).score!;

  it('holds for every prompt in the calibration and holdout sets', async () => {
    const { TUNING_SET, HOLDOUT_SET } = await import('./calibration/calibrate');
    const drops = [...TUNING_SET, ...HOLDOUT_SET]
      .map((p) => ({
        id: p.id,
        off: run(p.prompt, false, p.useCase).total,
        on: run(p.prompt, true, p.useCase).total,
      }))
      .filter((r) => r.on < r.off);
    expect(drops).toEqual([]);
  });

  it.each([
    'can you add a button which exports the table as a CSV',
    'Can you add a dark mode toggle to the navbar so users can switch themes?',
    'Add pagination to the orders list, 20 per page.',
    'Fix the typo in the footer.',
  ])('%s', (prompt) => {
    expect(run(prompt, true).total).toBeGreaterThanOrEqual(run(prompt, false).total);
  });

  it('scores a code change the same under Q&A and Coding', () => {
    const p = 'Can you add a button that clears the search filters?';
    expect(run(p, false, 'qa').total).toBe(run(p, false, 'coding').total);
  });

  it('treats "the navbar" or "the orders list" as saying where', () => {
    expect(
      ruleIds(run('Add pagination to the orders list, 20 per page.', true, 'coding')),
    ).not.toContain('agent.no-location');
  });

  it('skips agent checks for small, clear edits', () => {
    const ids = ruleIds(run('Fix the typo in the footer.', true, 'coding'));
    expect(ids.some((id) => id.startsWith('agent.'))).toBe(false);
  });

  it('recognizes rename as a task and "can you" as a normal way to ask', () => {
    expect(ruleIds(run('Rename getUser to fetchUser everywhere.', false, 'coding'))).not.toContain(
      'clarity.no-task',
    );
    expect(
      ruleIds(run('Can you add a logout button to the header?', false, 'coding')),
    ).not.toContain('economy.filler');
    expect(
      ruleIds(run('Could you please kindly help me out here, thanks so much!!', false)),
    ).toContain('economy.filler');
  });
});

describe('coding prompts get coding advice (user report, 2026-10-02)', () => {
  const CALC = 'Code me a calculator using Java, and make input taken within the console.';
  const SCOPED =
    'Code me a simple calculator in Java with console input. Support + - * / only, one Calculator.java file, standard library only. It’s for a beginner Java course, so keep it readable. Handle invalid input and divide-by-zero without crashing.';

  it('asks for scope, not a word count', () => {
    const r = score(CALC, 'claude', 'coding');
    expect(ruleIds(r)).not.toContain('output.no-length');
    expect(ruleIds(r)).toContain('output.no-code-scope');
    for (const f of r.findings) expect(f.suggestion).not.toMatch(/words|bullet points|paragraph/);
  });

  it('accepts a scoped, specified coding prompt as excellent', () => {
    const r = score(SCOPED, 'claude', 'coding');
    expect(ruleIds(r)).not.toContain('output.no-code-scope');
    expect(ruleIds(r)).not.toContain('output.no-format');
    expect(r.total).toBeGreaterThanOrEqual(90);
  });

  it('reads "without crashing" as a requirement, not a bug report', () => {
    const r = analyzePrompt({
      platform: 'claude',
      useCase: 'coding',
      mode: 'simple',
      prompt: SCOPED,
      workspace: true,
    }).score!;
    expect(ruleIds(r)).not.toContain('agent.no-symptom');
  });

  it('never lists a suggestion worth less than half a point', () => {
    for (const p of [CALC, SCOPED, 'Fix the login bug'])
      for (const workspace of [false, true]) {
        const r = analyzePrompt({
          platform: 'claude',
          useCase: 'coding',
          mode: 'simple',
          prompt: p,
          workspace,
        }).score!;
        for (const f of r.findings) expect(f.points).toBeGreaterThanOrEqual(0.5);
      }
  });
});

describe('labeled prompts from Prompt Studio score on what they say', () => {
  const PROMPT = `Write an email to Michael (head of finance) about rescheduling the budget meeting to Thursday due to the board deck being delayed.
Tone: professional
Length: a few sentences`;

  it('counts "due to…" as a purpose and "a few sentences" as a length', () => {
    const r = score(PROMPT, 'claude', 'writing');
    expect(ruleIds(r)).not.toContain('context.no-purpose');
    expect(ruleIds(r)).not.toContain('output.no-length');
    expect(r.total).toBeGreaterThanOrEqual(90);
  });

  it('treats "about the board deck" as the topic, not a missing attachment', () => {
    expect(ruleIds(score(PROMPT, 'claude', 'writing'))).not.toContain('clarity.missing-referent');
    // …but "my deck" with nothing attached is still something the model can't see.
    expect(ruleIds(score('Give me feedback about my deck.', 'claude', 'writing'))).toContain(
      'clarity.missing-referent',
    );
  });
});
