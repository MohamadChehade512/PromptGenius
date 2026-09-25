import type { ScoreBand } from '@promptgenius/core';

export type ScoreTone = 'good' | 'warn' | 'bad';

/** Traffic-light tone for a band; always shown next to the band label, never color alone. */
export const BAND_TONES: Record<ScoreBand, ScoreTone> = {
  excellent: 'good',
  good: 'good',
  'needs-work': 'warn',
  weak: 'bad',
};
