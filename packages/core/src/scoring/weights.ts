import type { PlatformId, UseCase } from '../types';
import type { Dimension } from './types';

const BASE: Record<Dimension, number> = {
  clarity: 20,
  context: 15,
  output: 15,
  structure: 10,
  examples: 10,
  economy: 20,
  platformFit: 10,
};

/** How much each dimension matters for a use case (1 = base weight). */
const USE_CASE_MULTIPLIERS: Record<UseCase, Partial<Record<Dimension, number>>> = {
  qa: { structure: 0.6, examples: 0.3, output: 0.8 },
  writing: { context: 1.3, output: 1.2, examples: 0.8 },
  coding: { context: 1.3, output: 1.1, examples: 0.5 },
  analysis: { context: 1.2, structure: 1.3, examples: 0.5 },
  extraction: { output: 1.5, examples: 1.5, context: 0.7 },
  brainstorming: { output: 0.6, examples: 0.4, structure: 0.7 },
  summarization: { output: 1.2, structure: 1.2, examples: 0.4 },
};

/** Gemini's guidance leans hardest on few-shot examples (PLAN.md §2.5). */
const PLATFORM_MULTIPLIERS: Record<PlatformId, Partial<Record<Dimension, number>>> = {
  claude: {},
  openai: {},
  gemini: { examples: 1.5, structure: 0.75 },
};

/** Dimension maxima for a platform + use case, normalized to sum to exactly 100. */
export function dimensionWeights(
  platform: PlatformId,
  useCase: UseCase,
): Record<Dimension, number> {
  const raw = {} as Record<Dimension, number>;
  let sum = 0;
  for (const [dim, base] of Object.entries(BASE) as [Dimension, number][]) {
    const w =
      base * (USE_CASE_MULTIPLIERS[useCase][dim] ?? 1) * (PLATFORM_MULTIPLIERS[platform][dim] ?? 1);
    raw[dim] = w;
    sum += w;
  }
  for (const dim of Object.keys(raw) as Dimension[]) raw[dim] = (raw[dim] / sum) * 100;
  return raw;
}
