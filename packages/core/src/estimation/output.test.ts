import { describe, expect, it } from 'vitest';
import { getDefaultModel, listModels } from '../config';
import { BRIEF_WORD, detectExplicitLength, estimateOutput } from './output';

const sonnet = getDefaultModel('claude');

function estimate(prompt: string, effort: Parameters<typeof estimateOutput>[0]['effort'] = 'none') {
  return estimateOutput({
    instructionLower: prompt.toLowerCase(),
    inputTokens: 50,
    dataTokens: 0,
    useCase: 'writing',
    model: sonnet,
    effort,
  });
}

describe('detectExplicitLength', () => {
  it.each([
    ['answer in under 200 words', 200 * 1.35],
    ['give me 5 bullet points', 5 * 35],
    ['write three paragraphs', 3 * 110],
    ['reply in one sentence', 30],
    ['answer yes or no', 10],
  ])('"%s" ≈ %d tokens', (prompt, expected) => {
    const r = detectExplicitLength(prompt);
    expect(r).not.toBeNull();
    expect(r!.range.mid).toBeGreaterThan(expected * 0.6);
    expect(r!.range.mid).toBeLessThan(expected * 1.5);
  });

  it('returns null when no length is stated', () => {
    expect(detectExplicitLength('write a blog post about dogs')).toBeNull();
  });
});

describe('BRIEF_WORD', () => {
  const re = new RegExp(`\\b(?:${BRIEF_WORD})\\b`);
  it.each([
    ['give a brief summary', true],
    ['be brief', true],
    ['explain briefly', true],
    ['write the essay described in the attached assignment brief', false],
    ['follow the brief', false],
    ['the brief says 800 words', false],
  ])('%s → %s', (text, brevity) => {
    expect(re.test(text)).toBe(brevity);
  });
});

describe('estimateOutput', () => {
  it('prefers an explicit length over the use-case baseline', () => {
    expect(estimate('write 50 words about cats').source).toBe('explicit');
    expect(estimate('write about cats').source).toBe('use-case');
  });

  it('shortens for "brief" and lengthens for "detailed"', () => {
    const base = estimate('write about cats').visible.mid;
    expect(estimate('briefly write about cats').visible.mid).toBeLessThan(base);
    expect(estimate('write a detailed piece about cats').visible.mid).toBeGreaterThan(base);
  });

  it('adds no thinking tokens when reasoning is off, more at higher effort', () => {
    expect(estimate('write about cats', 'none').thinking.mid).toBe(0);
    expect(estimate('write about cats', 'high').thinking.mid).toBeGreaterThan(
      estimate('write about cats', 'low').thinking.mid,
    );
  });

  it('never exceeds the model max output', () => {
    const haiku = listModels('claude').find((m) => m.id === 'claude-haiku-4-5')!;
    const r = estimateOutput({
      instructionLower: 'write 900 pages',
      inputTokens: 10,
      dataTokens: 0,
      useCase: 'writing',
      model: haiku,
      effort: 'none',
    });
    expect(r.visible.high).toBeLessThanOrEqual(haiku.maxOutput);
  });
});

describe('detectExplicitLength with several cues', () => {
  it('uses the largest stated length, not the first match', () => {
    const r = detectExplicitLength(
      'write a 120-word intro, ending with one sentence inviting readers',
    );
    expect(r!.detail).toBe('120 words');
  });
});
