import { describe, expect, it } from 'vitest';
import { analyzePrompt } from '../analyze';
import { cleanSpeech, guessUseCase, refineSpeech } from './refine';

describe('cleanSpeech: spoken slips', () => {
  const cases: [string, string][] = [
    // The user's example.
    ['Draft an email to Roger.. um I mean Michael', 'Draft an email to Michael.'],
    [
      'draft an email to Roger um I mean Michael about the budget',
      'Draft an email to Michael about the budget.',
    ],
    ['make it formal no wait casual', 'Make it casual.'],
    ['send it to my boss I mean my manager', 'Send it to my manager.'],
    ['write an email I mean a letter to the landlord', 'Write a letter to the landlord.'],
    [
      'schedule it for Tuesday, sorry, I mean Wednesday morning',
      'Schedule it for Wednesday morning.',
    ],
    ['give me five or rather ten ideas', 'Give me ten ideas.'],
    [
      'Write a poem about cats. Scratch that. Write a haiku about dogs',
      'Write a haiku about dogs.',
    ],
    ['um so uh write a you know summary of the the report', 'So write a summary of the report.'],
  ];
  for (const [said, expected] of cases)
    it(`"${said}"`, () => expect(cleanSpeech(said)).toBe(expected));

  it('leaves ordinary uses of "no" and "actually" alone', () => {
    expect(cleanSpeech('Keep it friendly, no hype, and say what actually changed')).toBe(
      'Keep it friendly, no hype, and say what actually changed.',
    );
  });

  it('returns nothing for silence', () => {
    expect(cleanSpeech('   ')).toBe('');
    expect(refineSpeech('').prompt).toBe('');
  });
});

describe('refineSpeech: assembling the prompt', () => {
  it('lifts spoken context into labeled lines', () => {
    const r = refineSpeech(
      'hey could you please draft an email to Roger um I mean Michael about the budget meeting the tone should be friendly and keep it under 120 words the purpose is to get his approval by Friday',
    );
    expect(r.prompt).toBe(
      [
        'Draft an email to Michael about the budget meeting.',
        'Purpose: To get his approval by Friday',
        'Tone: Friendly',
        'Length: Under 120 words',
      ].join('\n'),
    );
  });

  it('understands "add a tone: …" style additions, and the latest one wins', () => {
    const r = refineSpeech(
      'Write a product update. Add a tone: formal. Add a purpose: announce the new pricing. Actually no, the tone should be casual.',
    );
    expect(r.slots.tone).toBe('casual');
    expect(r.slots.purpose).toBe('announce the new pricing');
    expect(r.task).toBe('Write a product update.');
  });

  it('reads "in a friendly tone" inline', () => {
    const r = refineSpeech('write a thank you note to my team in a warm tone');
    expect(r.slots.tone).toBe('warm');
    expect(r.task).toBe('Write a thank you note to my team.');
  });

  it('strips politeness padding from the task', () => {
    expect(
      refineSpeech('Hi Claude, can you please summarize this article, thanks so much').task,
    ).toBe('Summarize this article.');
  });

  it('scores higher as context is added', () => {
    const score = (said: string) =>
      analyzePrompt({
        platform: 'claude',
        useCase: 'writing',
        mode: 'simple',
        prompt: refineSpeech(said).prompt,
      }).score!.total;
    const base = 'draft an email to Michael about moving the budget meeting to Thursday';
    const withTone = `${base} the tone should be friendly`;
    const withAll = `${withTone} the purpose is to get his approval by Friday keep it under 120 words`;
    expect(score(withTone)).toBeGreaterThan(score(base));
    expect(score(withAll)).toBeGreaterThan(score(withTone));
  });
});

describe('guessUseCase', () => {
  const cases: [string, string][] = [
    ['Draft an email to Michael about the budget.', 'writing'],
    ['Fix the bug in my login function.', 'coding'],
    ['Summarize this article in five bullet points.', 'summarization'],
    ['Brainstorm names for a coffee shop.', 'brainstorming'],
    ['Compare renting and buying in Toronto.', 'analysis'],
    ['What is the capital of Australia?', 'qa'],
  ];
  for (const [said, expected] of cases)
    it(`"${said}" → ${expected}`, () => expect(guessUseCase(said)).toBe(expected));
});

describe('refineSpeech: showing its work', () => {
  it('reports each change it made, in order', () => {
    const r = refineSpeech(
      'hey could you please draft an email to Roger um I mean Michael about the the budget the tone should be friendly',
    );
    expect(r.changes).toEqual([
      { kind: 'correction', from: 'Roger', to: 'Michael' },
      { kind: 'fillers', count: 1 },
      { kind: 'politeness' },
      { kind: 'context', slot: 'tone' },
    ]);
  });

  it('reports a retraction, and nothing for clean speech', () => {
    expect(refineSpeech('Write a poem. Scratch that. Write a haiku about dogs').changes).toEqual([
      { kind: 'retraction' },
    ]);
    expect(refineSpeech('Write a haiku about dogs.').changes).toEqual([]);
  });
});
