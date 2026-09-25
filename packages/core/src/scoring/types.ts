import type { Attachment } from '../attachments';
import type { ModelSpec } from '../config';
import type { Source } from './sources';
import type { TextFeatures } from '../text/analyze';
import type { EffortLevel, PlatformId, UseCase } from '../types';

export const DIMENSIONS = [
  'clarity',
  'context',
  'output',
  'structure',
  'examples',
  'economy',
  'platformFit',
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<Dimension, string> = {
  clarity: 'Task clarity',
  context: 'Context & intent',
  output: 'Output specification',
  structure: 'Structure',
  examples: 'Examples',
  economy: 'Token economy',
  platformFit: 'Platform fit',
};

export interface RuleContext {
  features: TextFeatures;
  platform: PlatformId;
  model: ModelSpec;
  effort: EffortLevel;
  useCase: UseCase;
  /** Prompt tokens (best available count). */
  tokens: number;
  /** True when the selected model/effort will reason before answering. */
  reasoning: boolean;
  /** Tokens already in the conversation. A follow-up can lean on that context. */
  historyTokens: number;
  /** Files attached to this message. They can supply context, but only if the prompt uses them. */
  attachments: readonly Attachment[];
  /** Input tokens the attachments cost on the selected model. */
  attachmentTokens: number;
}

export interface RuleHit {
  /** Fraction (0–1) of the rule's dimension that this finding costs. */
  penalty: number;
  /** What is wrong, in one sentence. */
  message: string;
  /** What to do instead: concrete and actionable. */
  suggestion: string;
  evidence?: string[];
}

export interface Rule {
  id: string;
  dimension: Dimension;
  title: string;
  sources: readonly Source[];
  platforms?: readonly PlatformId[];
  useCases?: readonly UseCase[];
  evaluate(ctx: RuleContext): RuleHit | null;
}

export interface Finding extends RuleHit {
  ruleId: string;
  dimension: Dimension;
  title: string;
  sources: readonly Source[];
  /** Score points recovered by fixing this finding. */
  points: number;
}

export interface DimensionScore {
  id: Dimension;
  label: string;
  max: number;
  score: number;
}

export type ScoreBand = 'excellent' | 'good' | 'needs-work' | 'weak';

export interface ScoreResult {
  total: number;
  band: ScoreBand;
  dimensions: DimensionScore[];
  /** Sorted by points recoverable, highest first. */
  findings: Finding[];
}
