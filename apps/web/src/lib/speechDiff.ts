import type { SpeechChange } from '@promptgenius/core';
import { SLOT_LABELS } from '@promptgenius/core';

export interface SpokenWord {
  text: string;
  /** Said, but not kept: a filler, a stutter, or a slip that was corrected. */
  removed: boolean;
}

const key = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, '');

/**
 * Marks which spoken words didn't survive the clean-up, by aligning what was said with what
 * was kept (longest common subsequence over words). Cleaning only ever removes words, so
 * anything unmatched was dropped.
 */
export function markRemoved(said: string, kept: string): SpokenWord[] {
  const a = said.split(/\s+/).filter(Boolean);
  const b = kept.split(/\s+/).filter(Boolean).map(key);
  const ak = a.map(key);
  const n = a.length;
  const m = b.length;
  // lcs[i][j] = length of the LCS of a[i..] and b[j..]
  const lcs: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i]![j] =
        ak[i] && ak[i] === b[j]
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  const out: SpokenWord[] = [];
  let i = 0;
  let j = 0;
  while (i < n) {
    if (j < m && ak[i] && ak[i] === b[j]) {
      out.push({ text: a[i]!, removed: false });
      i++;
      j++;
    } else if (j < m && lcs[i]![j + 1]! > lcs[i + 1]![j]!) {
      j++; // this kept word has no spoken counterpart here (e.g. re-cased or added punctuation)
    } else {
      out.push({ text: a[i]!, removed: true });
      i++;
    }
  }
  return out;
}

/** A change as a short note for the "what changed" strip. */
export function describeChange(c: SpeechChange): string {
  switch (c.kind) {
    case 'correction':
      return `${c.from} → ${c.to}`;
    case 'retraction':
      return 'Dropped what you took back';
    case 'fillers':
      return c.count === 1 ? 'Removed 1 filler' : `Removed ${c.count} fillers`;
    case 'politeness':
      return 'Trimmed politeness';
    case 'context':
      return `${SLOT_LABELS[c.slot]} → its own line`;
  }
}

export interface SaidWord {
  text: string;
  /**
   * kept: in the prompt as said. cut: a slip, filler or stutter that was dropped.
   * folded: not needed as words ("could you please", "the tone should be") because the prompt
   * says it more directly.
   */
  state: 'kept' | 'cut' | 'folded';
}

/** What was said, word by word, marked against the cleaned speech and the finished prompt. */
export function markSaid(said: string, cleaned: string, prompt: string): SaidWord[] {
  const cut = markRemoved(said, cleaned);
  const folded = markRemoved(said, prompt);
  return cut.map((w, i) => ({
    text: w.text,
    state: w.removed ? 'cut' : folded[i]?.removed ? 'folded' : 'kept',
  }));
}
