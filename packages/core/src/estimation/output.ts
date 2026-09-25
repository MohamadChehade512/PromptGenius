import type { ModelSpec } from '../config';
import type { EffortLevel, Range, UseCase } from '../types';

/** Typical visible-output size per use case, in tokens (heuristic, tuned in calibration). */
export const USE_CASE_OUTPUT: Record<UseCase, Range> = {
  qa: { low: 120, mid: 300, high: 700 },
  writing: { low: 400, mid: 800, high: 1600 },
  coding: { low: 400, mid: 1200, high: 3000 },
  analysis: { low: 600, mid: 1400, high: 3000 },
  extraction: { low: 80, mid: 300, high: 900 },
  brainstorming: { low: 300, mid: 700, high: 1300 },
  summarization: { low: 150, mid: 400, high: 900 },
};

/** How much a use case tends to make the model reason before answering. */
const REASONING_FACTOR: Record<UseCase, number> = {
  qa: 0.6,
  writing: 0.6,
  coding: 1.4,
  analysis: 1.3,
  extraction: 0.4,
  brainstorming: 0.6,
  summarization: 0.4,
};

/** Thinking tokens as a multiple of visible output, per effort level (heuristic). */
const EFFORT_FACTOR: Record<EffortLevel, number> = {
  none: 0,
  minimal: 0.15,
  low: 0.35,
  medium: 1,
  high: 2,
  xhigh: 3,
  max: 4.5,
};

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  single: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  fifty: 50,
  hundred: 100,
};
const NUM = `(\\d[\\d,]*|${Object.keys(NUMBER_WORDS).join('|')})`;

/** Explicit length cues and their token cost per unit. */
const UNIT_TOKENS: { re: RegExp; perUnit: number; label: string }[] = [
  {
    re: new RegExp(`${NUM}(?:\\s*(?:-|to)\\s*${NUM})?[\\s-]+words?\\b`, 'g'),
    perUnit: 1.35,
    label: 'words',
  },
  {
    re: new RegExp(`${NUM}(?:\\s*(?:-|to)\\s*${NUM})?[\\s-]+tokens?\\b`, 'g'),
    perUnit: 1,
    label: 'tokens',
  },
  {
    re: new RegExp(`${NUM}(?:\\s*(?:-|to)\\s*${NUM})?[\\s-]+(?:characters?|chars?)\\b`, 'g'),
    perUnit: 0.25,
    label: 'characters',
  },
  {
    re: new RegExp(`${NUM}(?:\\s*(?:-|to)\\s*${NUM})?[\\s-]+sentences?\\b`, 'g'),
    perUnit: 25,
    label: 'sentences',
  },
  {
    re: new RegExp(`${NUM}(?:\\s*(?:-|to)\\s*${NUM})?[\\s-]+(?:short\\s+)?paragraphs?\\b`, 'g'),
    perUnit: 110,
    label: 'paragraphs',
  },
  {
    re: new RegExp(`${NUM}(?:\\s*(?:-|to)\\s*${NUM})?[\\s-]+pages?\\b`, 'g'),
    perUnit: 600,
    label: 'pages',
  },
  {
    re: new RegExp(`${NUM}(?:\\s*(?:-|to)\\s*${NUM})?[\\s-]+lines?\\b`, 'g'),
    perUnit: 12,
    label: 'lines',
  },
  {
    re: new RegExp(
      `${NUM}(?:\\s*(?:-|to)\\s*${NUM})?[\\s-]+(?:[\\w-]+\\s+){0,2}(?:bullets?|bullet points|points|items|ideas|examples|options|tips|steps|questions|names|titles|taglines|headlines|suggestions|reasons|facts|changes|edits|fixes|improvements|recommendations|issues|problems|mistakes|risks|takeaways|lessons)\\b`,
      'g',
    ),
    perUnit: 35,
    label: 'list items',
  },
];

const TINY_ANSWER_RE =
  /\b(?:yes or no|true or false|one word|single word|a number only|only the number|just the (?:number|answer|name))\b/;
/**
 * "brief" as in "be brief", not the noun ("the assignment brief", "the brief says").
 * Shared with the output-spec rules so both read the same words the same way.
 */
export const BRIEF_WORD =
  '(?<!\\b(?:the|this|that|attached|assignment|creative|design|project|my|our)\\s)brief(?:ly)?(?!\\s+(?:describes|says|asks|document|file))';

const BRIEF_RE = new RegExp(
  `\\b(?:${BRIEF_WORD}|short|concise(?:ly)?|succinct(?:ly)?|tl;?dr|quick(?:ly)?|in a nutshell)\\b`,
);
const LONG_RE =
  /\b(?:detailed|comprehensive|in[- ]depth|thorough(?:ly)?|exhaustive|extensive(?:ly)?|everything|complete guide|full (?:implementation|guide|report))\b/;
const TRANSFORM_RE =
  /\b(?:rewrite|rephrase|translate|proofread|paraphrase|fix (?:the )?grammar|edit this|convert this)\b/;

function toNumber(token: string | undefined): number | undefined {
  if (!token) return undefined;
  const n = NUMBER_WORDS[token] ?? Number(token.replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

export interface OutputEstimate {
  visible: Range;
  thinking: Range;
  /** 'explicit' when the prompt states a length; otherwise a use-case baseline. */
  source: 'explicit' | 'use-case' | 'input-proportional';
  detail: string;
}

function scale(r: Range, k: number): Range {
  return { low: Math.round(r.low * k), mid: Math.round(r.mid * k), high: Math.round(r.high * k) };
}

/** Detects an explicit length request ("in 3 bullets", "under 200 words", ...). */
export function detectExplicitLength(
  lowerInstructions: string,
): { range: Range; detail: string } | null {
  if (TINY_ANSWER_RE.test(lowerInstructions)) {
    return { range: { low: 2, mid: 10, high: 40 }, detail: 'a one-word / yes-no answer' };
  }
  let best: { range: Range; detail: string } | null = /\b(?:one|a|single) sentence\b/.test(
    lowerInstructions,
  )
    ? { range: { low: 15, mid: 30, high: 60 }, detail: 'one sentence' }
    : null;
  for (const unit of UNIT_TOKENS) {
    for (const m of lowerInstructions.matchAll(unit.re)) {
      const a = toNumber(m[1]);
      const b = toNumber(m[2]);
      if (a === undefined) continue;
      const hi = b ?? a;
      const lo = b !== undefined ? a : a * 0.7;
      const range = {
        low: Math.round(lo * unit.perUnit),
        mid: Math.round(((lo + hi) / 2 + (b ? 0 : a * 0.15)) * unit.perUnit),
        high: Math.round(hi * unit.perUnit * 1.2),
      };
      if (!best || range.mid > best.range.mid) {
        best = { range, detail: `${b ? `${a}–${b}` : a} ${unit.label}` };
      }
    }
  }
  return best;
}

export function estimateOutput(params: {
  instructionLower: string;
  inputTokens: number;
  /** Tokens of pasted data (fenced/XML blocks) — the material a summary or rewrite works on. */
  dataTokens: number;
  useCase: UseCase;
  model: ModelSpec;
  effort: EffortLevel;
}): OutputEstimate {
  const { instructionLower, useCase, model, effort } = params;
  let visible: Range;
  let source: OutputEstimate['source'];
  let detail: string;

  const explicit = detectExplicitLength(instructionLower);
  if (explicit) {
    visible = explicit.range;
    source = 'explicit';
    detail = `You asked for ${explicit.detail}.`;
  } else if (TRANSFORM_RE.test(instructionLower) && params.dataTokens > 50) {
    const n = params.dataTokens;
    visible = { low: Math.round(n * 0.8), mid: n, high: Math.round(n * 1.3) };
    source = 'input-proportional';
    detail = 'A rewrite/translation is about as long as its input.';
  } else if (useCase === 'summarization' && params.dataTokens > 200) {
    const mid = Math.min(1500, Math.max(150, Math.round(params.dataTokens * 0.2)));
    visible = { low: Math.round(mid * 0.5), mid, high: Math.round(mid * 2) };
    source = 'input-proportional';
    detail = 'A summary is typically ~20% of the source length.';
  } else {
    visible = USE_CASE_OUTPUT[useCase];
    source = 'use-case';
    detail = 'No length given, so this is a typical answer for this use case.';
    if (BRIEF_RE.test(instructionLower)) {
      visible = scale(visible, 0.5);
      detail += ' Shortened because you asked for brevity.';
    } else if (LONG_RE.test(instructionLower)) {
      visible = scale(visible, 1.8);
      detail += ' Lengthened because you asked for depth.';
    }
  }

  const cap = model.maxOutput;
  visible = {
    low: Math.min(visible.low, cap),
    mid: Math.min(visible.mid, cap),
    high: Math.min(visible.high, cap),
  };

  const k = model.reasoning ? EFFORT_FACTOR[effort] * REASONING_FACTOR[useCase] : 0;
  const thinking: Range = {
    low: Math.round(visible.low * k * 0.4),
    mid: Math.round(visible.mid * k),
    high: Math.round(visible.high * k * 2),
  };

  return { visible, thinking, source, detail };
}
