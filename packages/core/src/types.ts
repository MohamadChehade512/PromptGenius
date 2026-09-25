export const PLATFORMS = ['claude', 'openai', 'gemini'] as const;
export type PlatformId = (typeof PLATFORMS)[number];

export const USE_CASES = [
  'qa',
  'writing',
  'coding',
  'analysis',
  'extraction',
  'brainstorming',
  'summarization',
] as const;
export type UseCase = (typeof USE_CASES)[number];

export const USE_CASE_LABELS: Record<UseCase, string> = {
  qa: 'Q&A / Chat',
  writing: 'Writing',
  coding: 'Coding',
  analysis: 'Analysis / Research',
  extraction: 'Data extraction',
  brainstorming: 'Brainstorming',
  summarization: 'Summarization',
};

/** Superset of reasoning-effort levels across vendors; each model lists the ones it supports. */
export const EFFORT_LEVELS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

export type Mode = 'simple' | 'advanced';

/** Low / most likely / high estimate. Output length is inherently uncertain, so we never show one number. */
export interface Range {
  low: number;
  mid: number;
  high: number;
}
