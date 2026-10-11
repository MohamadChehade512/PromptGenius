import type { Finding } from '@promptgenius/core';

export interface CoachTip {
  id: string;
  /** What to add, as a short instruction. */
  label: string;
  /** What to say out loud to add it. */
  say: string;
  points: number;
}

/** Spoken ways to fix the most common gaps. Anything else falls back to the finding's own text. */
const SPOKEN: Record<string, [label: string, say: string]> = {
  'context.no-purpose': ['Add a purpose', '“The purpose is…”'],
  'context.no-audience': ['Add a tone or audience', '“The tone should be…” or “The audience is…”'],
  'context.no-details': ['Add details', '“For context, …”'],
  'output.no-format': ['Add a format', '“Format: a short email with a subject line”'],
  'output.no-length': ['Add a length', '“Keep it under 120 words”'],
  'output.no-code-scope': ['Define the scope', '“Only…, no…”'],
  'output.no-criteria': ['Add must-haves', '“It must…”'],
  'clarity.too-short': ['Say more about what you need', 'Describe what a good answer looks like'],
  'clarity.no-task': ['Say what you want done', '“Write…”, “Summarize…”, “Explain…”'],
  'clarity.no-subject': ['Say what it’s about', 'Name the topic or the thing to work on'],
  'clarity.vague-words': ['Be more specific', 'Swap words like “good” for what you actually mean'],
  'clarity.generic-ask': [
    'Name what you want back',
    '“Give me three ways to…”, “Rewrite this to…”',
  ],
  'clarity.missing-referent': [
    'Describe the thing you mean',
    'Say what it is, or paste it in the Workshop',
  ],
  'examples.missing': ['Give an example', '“For example, …”'],
  'examples.too-few': ['Give another example', '“Another example is…”'],
};

/** The top things to say next, most valuable first. */
export function coachTips(findings: readonly Finding[], limit = 4): CoachTip[] {
  return findings
    .filter((f) => !f.ruleId.startsWith('engine.'))
    .slice(0, limit)
    .map((f) => {
      const spoken = SPOKEN[f.ruleId];
      return {
        id: f.ruleId,
        label: spoken?.[0] ?? f.title,
        say: spoken?.[1] ?? f.suggestion,
        points: Math.max(1, Math.round(f.points)),
      };
    });
}
