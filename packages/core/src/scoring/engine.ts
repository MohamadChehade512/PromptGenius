import { ALL_RULES } from './rules';
import { fileUse, isReviewTask } from './rules/helpers';
import { S } from './sources';
import type {
  Dimension,
  DimensionScore,
  Finding,
  Rule,
  RuleContext,
  ScoreBand,
  ScoreResult,
} from './types';
import { DIMENSION_LABELS, DIMENSIONS } from './types';
import { dimensionWeights } from './weights';

const CORE: readonly Dimension[] = ['clarity', 'context', 'output'];

/**
 * Efficiency is quality per token, so a prompt that barely says anything can't earn full
 * efficiency credit just for being short. Structure, examples, economy and platform fit
 * are scaled by how complete the core (clarity, context, output) is, along a curve
 * that stays near zero for an empty core and eases off quickly as substance rises. The withheld points become one finding, so they stay
 * explainable and recoverable.
 */
function applySubstanceGate(dimensions: DimensionScore[], findings: Finding[]): void {
  const core = dimensions.filter((d) => CORE.includes(d.id));
  const substance = core.reduce((s, d) => s + d.score, 0) / core.reduce((s, d) => s + d.max, 0);
  const factor = 0.05 + 0.95 * (1 - (1 - substance) ** 1.6);
  let withheld = 0;
  for (const d of dimensions) {
    if (CORE.includes(d.id)) continue;
    withheld += d.score * (1 - factor);
    d.score *= factor;
  }
  if (withheld >= 0.5) {
    findings.push({
      ruleId: 'engine.substance-gate',
      dimension: 'economy',
      title: 'Too little substance for full efficiency credit',
      sources: [S.vertexComponents, S.openaiBestPractices, S.anthropicContextEng],
      penalty: 1 - factor,
      points: withheld,
      message: `Efficiency credit is scaled to ${Math.round(factor * 100)}% because the task, context or output spec is incomplete.`,
      suggestion:
        'Fix the clarity, context and output suggestions; efficiency credit rises with them.',
    });
  }
}

export function scoreBand(total: number): ScoreBand {
  if (total >= 90) return 'excellent';
  if (total >= 75) return 'good';
  if (total >= 50) return 'needs-work';
  return 'weak';
}

/**
 * Rules whose concern is usually settled by earlier messages. A short message in an
 * ongoing chat ("make it shorter") inherits topic, audience, format and length from it.
 */
const FOLLOW_UP_SOFTENED = new Set([
  'clarity.too-short',
  'clarity.no-subject',
  'clarity.generic-ask',
  'context.no-purpose',
  'context.no-audience',
  'context.no-details',
  'context.coding-stack',
  'output.no-format',
  'output.no-length',
  'output.no-criteria',
  'examples.missing',
]);
const FOLLOW_UP_FACTOR = 0.45;

/**
 * Background an attached brief, spec or job description can supply when the prompt points
 * at it. Softened rather than dropped: the prompt should still say what matters.
 */
const FILE_SOFTENED = new Set([
  'context.no-purpose',
  'context.no-audience',
  'context.coding-stack',
]);
const FILE_FACTOR = 0.5;

export function isFollowUp(ctx: RuleContext): boolean {
  return ctx.historyTokens > 0 && ctx.features.instructionWords.length < 25;
}

function applies(rule: Rule, ctx: RuleContext): boolean {
  return (
    (!rule.platforms || rule.platforms.includes(ctx.platform)) &&
    (!rule.useCases || rule.useCases.includes(ctx.useCase))
  );
}

/**
 * Deterministic, explainable score: each dimension starts at its weight and loses the
 * fraction its findings claim (capped at the whole dimension). Every lost point maps to
 * a finding with a suggestion, so "points recoverable" always adds up to the gap.
 */
export function scorePrompt(ctx: RuleContext, rules: readonly Rule[] = ALL_RULES): ScoreResult {
  // Reviewing specific material is an analysis task even when filed under Q&A: it needs a
  // goal, a yardstick and an output shape, not just a question.
  const weightUseCase =
    ctx.useCase === 'qa' && isReviewTask(ctx.features) ? 'analysis' : ctx.useCase;
  const weights = dimensionWeights(ctx.platform, weightUseCase);
  const followUp = isFollowUp(ctx);
  // Only a brief, spec or job description can stand in for the prompt's own purpose/audience.
  const fileContext = fileUse(ctx).instructional;
  const findings: Finding[] = [];
  const dimensions: DimensionScore[] = [];

  for (const dim of DIMENSIONS) {
    const max = weights[dim];
    const hits = rules
      .filter((r) => r.dimension === dim && applies(r, ctx))
      .flatMap((rule) => {
        let hit = rule.evaluate(ctx);
        if (hit && followUp && FOLLOW_UP_SOFTENED.has(rule.id)) {
          hit = {
            ...hit,
            penalty: hit.penalty * FOLLOW_UP_FACTOR,
            message: `${hit.message} (Softened: in an ongoing chat, earlier messages may already cover this.)`,
          };
        }
        if (hit && fileContext && FILE_SOFTENED.has(rule.id)) {
          hit = {
            ...hit,
            penalty: hit.penalty * FILE_FACTOR,
            message: `${hit.message} (Softened: the attached file may cover this.)`,
          };
        }
        return hit && hit.penalty > 0 ? [{ rule, hit }] : [];
      });

    const totalPenalty = hits.reduce((sum, h) => sum + h.hit.penalty, 0);
    const scale = totalPenalty > 1 ? 1 / totalPenalty : 1;
    for (const { rule, hit } of hits) {
      findings.push({
        ...hit,
        ruleId: rule.id,
        dimension: dim,
        title: rule.title,
        sources: rule.sources,
        points: max * hit.penalty * scale,
      });
    }
    dimensions.push({
      id: dim,
      label: DIMENSION_LABELS[dim],
      max,
      score: max * (1 - Math.min(1, totalPenalty)),
    });
  }

  applySubstanceGate(dimensions, findings);

  const total = Math.round(dimensions.reduce((sum, d) => sum + d.score, 0));
  // Concrete findings first, by points recoverable. The substance gate goes last: its points
  // come back automatically as the concrete items are fixed.
  findings.sort(
    (a, b) =>
      Number(a.ruleId.startsWith('engine.')) - Number(b.ruleId.startsWith('engine.')) ||
      b.points - a.points,
  );
  return { total, band: scoreBand(total), dimensions, findings };
}
