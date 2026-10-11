import { describe, expect, it } from 'vitest';
import { describeChange, markRemoved, markSaid } from './speechDiff';

const removed = (said: string, kept: string) =>
  markRemoved(said, kept)
    .filter((w) => w.removed)
    .map((w) => w.text);

describe('markRemoved', () => {
  it('marks fillers and corrected slips as removed', () => {
    expect(
      removed('draft an email to Roger um I mean Michael', 'Draft an email to Michael.'),
    ).toEqual(['Roger', 'um', 'I', 'mean']);
  });

  it('marks stutters, and nothing when all words were kept', () => {
    expect(removed('write a summary of the the report', 'Write a summary of the report.')).toEqual([
      'the',
    ]);
    expect(removed('write a haiku', 'Write a haiku.')).toEqual([]);
  });

  it('handles empty input', () => {
    expect(markRemoved('', '')).toEqual([]);
  });
});

describe('describeChange', () => {
  it('writes each change as a short note', () => {
    expect(describeChange({ kind: 'correction', from: 'Roger', to: 'Michael' })).toBe(
      'Roger → Michael',
    );
    expect(describeChange({ kind: 'fillers', count: 3 })).toBe('Removed 3 fillers');
    expect(describeChange({ kind: 'context', slot: 'tone' })).toBe('Tone → its own line');
  });
});

describe('markSaid', () => {
  it('separates dropped slips from words the prompt says more directly', () => {
    const words = markSaid(
      'hey could you please draft an email to Roger um I mean Michael the tone should be friendly',
      'Hey could you please draft an email to Michael the tone should be friendly.',
      'Draft an email to Michael.\nTone: Friendly',
    );
    const by = (state: string) => words.filter((w) => w.state === state).map((w) => w.text);
    expect(by('cut')).toEqual(['Roger', 'um', 'I', 'mean']);
    expect(by('folded')).toEqual(['hey', 'could', 'you', 'please', 'the', 'should', 'be']);
    expect(by('kept')).toEqual(['draft', 'an', 'email', 'to', 'Michael', 'tone', 'friendly']);
  });
});
