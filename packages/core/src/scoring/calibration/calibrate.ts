import { analyzePrompt } from '../../analyze';
import { summarizeAttachment } from '../../attachments';
import { CALIBRATION_SET, type Label, type LabeledPrompt } from './prompts';

/** Score range each human label should land in. */
export const LABEL_RANGES: Record<Label, [number, number]> = {
  weak: [0, 49],
  ok: [50, 79],
  strong: [80, 100],
};

const LABEL_RANK: Record<Label, number> = { weak: 0, ok: 1, strong: 2 };

export interface CalibrationRow extends LabeledPrompt {
  score: number;
  inRange: boolean;
  topFindings: string[];
}

export interface CalibrationReport {
  rows: CalibrationRow[];
  /** Share of prompts whose score falls in their label's range. */
  accuracy: number;
  /** Rank correlation between labels and scores (1 = perfect ordering). */
  spearman: number;
  means: Record<Label, number>;
}

function ranks(values: number[]): number[] {
  const sorted = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(values.length);
  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1]![0] === sorted[i]![0]) j++;
    for (let k = i; k <= j; k++) out[sorted[k]![1]] = (i + j) / 2;
    i = j + 1;
  }
  return out;
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i]! - ma) * (b[i]! - mb);
    da += (a[i]! - ma) ** 2;
    db += (b[i]! - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}

export function runCalibration(set: LabeledPrompt[] = CALIBRATION_SET): CalibrationReport {
  const rows = set.map((p) => {
    const result = analyzePrompt({
      platform: p.platform,
      useCase: p.useCase,
      mode: 'simple',
      prompt: p.prompt,
      historyTokens: p.historyTokens,
      attachments: p.attachments?.map(summarizeAttachment),
    });
    const score = result.score?.total ?? 0;
    const [lo, hi] = LABEL_RANGES[p.label];
    return {
      ...p,
      score,
      inRange: score >= lo && score <= hi,
      topFindings: (result.score?.findings ?? [])
        .slice(0, 3)
        .map((f) => `${f.ruleId} (${f.points.toFixed(1)})`),
    };
  });

  const means = { weak: 0, ok: 0, strong: 0 } as Record<Label, number>;
  for (const label of ['weak', 'ok', 'strong'] as const) {
    const scores = rows.filter((r) => r.label === label).map((r) => r.score);
    means[label] = scores.reduce((s, x) => s + x, 0) / Math.max(1, scores.length);
  }

  return {
    rows,
    accuracy: rows.filter((r) => r.inRange).length / rows.length,
    spearman: pearson(ranks(rows.map((r) => LABEL_RANK[r.label])), ranks(rows.map((r) => r.score))),
    means,
  };
}
