import { attachmentTokens, type Attachment, type AttachmentTokens } from './attachments';
import {
  findModel,
  getMedia,
  getDefaultModel,
  listConsumerPlans,
  MODELS_CONFIG,
  type ModelSpec,
} from './config';
import { callCost, type CostBreakdown } from './cost/cost';
import { projectSession, type SessionProjection } from './cost/session';
import { estimateOutput, type OutputEstimate } from './estimation/output';
import { estimateTokens, type TokenCount } from './estimation/tokens';
import { scorePrompt } from './scoring/engine';
import { S, type Source } from './scoring/sources';
import type { ScoreResult } from './scoring/types';
import { analyzeText } from './text/analyze';
import type { EffortLevel, Mode, PlatformId, Range, UseCase } from './types';

export interface AnalysisInput {
  platform: PlatformId;
  useCase: UseCase;
  mode: Mode;
  prompt: string;
  modelId?: string;
  effort?: EffortLevel;
  /** Advanced: resent every turn along with attachments. */
  systemPrompt?: string;
  attachmentTokens?: number;
  turns?: number;
  /** Simple mode: which consumer plan's context window to compare against. */
  planId?: string;
  /**
   * Tokens already in this conversation (earlier messages and answers). Every new message
   * resends them, so they count toward input cost, usage limits and the context window.
   */
  historyTokens?: number;
  /** Files attached to this message, summarized in the browser (see summarizeAttachment). */
  attachments?: readonly Attachment[];
  /** Exact counts, when a tokenizer or vendor API has provided them. */
  exactPromptTokens?: TokenCount;
  exactSystemTokens?: number;
}

/** A tokens-per-exchange rule of thumb: ~150-token message + ~550-token answer. */
export const EXCHANGE_TOKENS = 700;

export const CONVERSATION_PRESETS = [
  { id: 'new', label: 'New chat', tokens: 0 },
  { id: 'few', label: 'A few messages in (~5 exchanges)', tokens: 5 * EXCHANGE_TOKENS },
  { id: 'some', label: 'Ongoing chat (~20 exchanges)', tokens: 20 * EXCHANGE_TOKENS },
  { id: 'long', label: 'Long chat (~50 exchanges)', tokens: 50 * EXCHANGE_TOKENS },
  { id: 'very-long', label: 'Very long chat (~150 exchanges)', tokens: 150 * EXCHANGE_TOKENS },
] as const;

export interface AnalysisWarning {
  id: 'context-rot' | 'near-full' | 'overflow';
  message: string;
  sources: readonly Source[];
}

/** Past this much context, recall measurably degrades for long-context models (Context Rot). */
const LONG_CONTEXT_TOKENS = 32_000;

export interface AnalysisResult {
  model: ModelSpec;
  effort: EffortLevel;
  reasoning: boolean;
  chars: number;
  words: number;
  promptTokens: TokenCount;
  systemTokens: number;
  /** System prompt + manually entered attachment tokens (Advanced): resent on every turn. */
  fixedTokens: number;
  /** Per-file token estimates for the attached files. */
  files: AttachmentTokens[];
  /** Sum of `files`: sent with this message and resent on every later turn. */
  fileTokens: number;
  /** Earlier conversation resent with this message. */
  historyTokens: number;
  /** Everything sent with this message: fixed + history + files + prompt. */
  inputTokens: number;
  output: OutputEstimate;
  context: {
    windowTokens: number;
    windowLabel: string;
    windowVerified: boolean;
    used: Range;
    usedPct: Range;
  };
  cost: {
    low: number;
    mid: number;
    high: number;
    breakdown: CostBreakdown;
    /** Same call when the resent prefix (system + history) is served from the prompt cache. */
    midWithCache: number;
    cacheApplies: boolean;
  };
  /** Simple mode: this call ≈ N "typical messages" on the same model. */
  typicalMessages: number;
  session: SessionProjection | null;
  score: ScoreResult | null;
  warnings: AnalysisWarning[];
}

export function resolveModel(platform: PlatformId, modelId?: string): ModelSpec {
  return (modelId && findModel(platform, modelId)) || getDefaultModel(platform);
}

export function resolveEffort(model: ModelSpec, effort?: EffortLevel): EffortLevel {
  if (!model.reasoning) return 'none';
  return effort && model.reasoning.levels.includes(effort) ? effort : model.reasoning.default;
}

export function analyzePrompt(input: AnalysisInput): AnalysisResult {
  const model = resolveModel(input.platform, input.modelId);
  const effort = resolveEffort(model, input.effort);
  const reasoning = effort !== 'none';
  const advanced = input.mode === 'advanced';

  const features = analyzeText(input.prompt);
  const promptTokens: TokenCount = input.exactPromptTokens ?? {
    tokens: estimateTokens(input.prompt, model),
    method: 'estimate',
  };
  const systemTokens = advanced
    ? (input.exactSystemTokens ?? estimateTokens(input.systemPrompt ?? '', model))
    : 0;
  const fixedTokens = systemTokens + (advanced ? (input.attachmentTokens ?? 0) : 0);
  const historyTokens = Math.max(0, Math.floor(input.historyTokens ?? 0));
  const prefixTokens = fixedTokens + historyTokens;
  const attachments = input.attachments ?? [];
  const media = getMedia(input.platform, model);
  const files = attachments.map((a) => attachmentTokens(a, model, media));
  const fileTokens = files.reduce((sum, f) => sum + f.tokens, 0);
  const inputTokens = prefixTokens + fileTokens + promptTokens.tokens;

  // Material to work on (pasted data + attached files) drives summary/extraction length.
  const dataTokens =
    Math.max(
      0,
      estimateTokens(input.prompt, model) - estimateTokens(features.instructionText, model),
    ) + files.reduce((sum, f) => sum + f.textTokens + f.visualTokens / 4, 0);
  const output = estimateOutput({
    instructionLower: features.instructionLower,
    inputTokens,
    dataTokens,
    useCase: input.useCase,
    model,
    effort,
  });

  // Context window: the API model's window (Advanced) or the chat plan's window (Simple).
  const plans = listConsumerPlans(input.platform);
  const plan = plans.find((p) => p.id === input.planId) ?? plans[plans.length - 1]!;
  const windowTokens = advanced ? model.contextWindow : plan.contextWindow;
  const used: Range = {
    low: inputTokens + output.visible.low + output.thinking.low,
    mid: inputTokens + output.visible.mid + output.thinking.mid,
    high: inputTokens + output.visible.high + output.thinking.high,
  };
  const pct = (n: number) => (n / windowTokens) * 100;

  const costAt = (k: keyof Range) =>
    callCost(model, {
      inputTokens,
      outputTokens: output.visible[k],
      thinkingTokens: output.thinking[k],
    });
  const breakdown = costAt('mid');
  const cacheApplies = prefixTokens >= model.cacheMinTokens && historyTokens > 0;
  const midWithCache = cacheApplies
    ? callCost(model, {
        inputTokens,
        cacheReadTokens: prefixTokens,
        outputTokens: output.visible.mid,
        thinkingTokens: output.thinking.mid,
      }).total
    : breakdown.total;

  const typical = MODELS_CONFIG.typicalMessage;
  const typicalCost = callCost(model, {
    inputTokens: typical.inputTokens,
    outputTokens: typical.outputTokens,
  }).total;

  const session =
    advanced && (input.turns ?? 1) > 1
      ? projectSession({
          model,
          fixedTokens: prefixTokens + fileTokens,
          firstTurnNewTokens: fileTokens,
          userTokensPerTurn: promptTokens.tokens,
          assistantTokensPerTurn: output.visible.mid,
          thinkingTokensPerTurn: output.thinking.mid,
          turns: input.turns ?? 1,
          prefixCached: historyTokens > 0,
        })
      : null;

  const score = input.prompt.trim()
    ? scorePrompt({
        features,
        platform: input.platform,
        model,
        effort,
        useCase: input.useCase,
        tokens: promptTokens.tokens,
        reasoning,
        historyTokens,
        attachments,
        attachmentTokens: fileTokens,
      })
    : null;

  const warnings: AnalysisWarning[] = [];
  if (used.mid > windowTokens) {
    warnings.push({
      id: 'overflow',
      message: `This exceeds the ${windowLabelFor(advanced, model.label, plan.label)} context window. APIs reject it; chat apps silently drop or summarize earlier messages.`,
      sources: [S.anthropicContextWindows],
    });
  } else if (used.high > windowTokens * 0.9) {
    warnings.push({
      id: 'near-full',
      message: 'The context window is nearly full: the next few turns may push early messages out.',
      sources: [S.anthropicContextWindows],
    });
  }
  if (inputTokens > LONG_CONTEXT_TOKENS) {
    warnings.push({
      id: 'context-rot',
      message: `About ${Math.round(inputTokens / 1000)}k tokens are resent with this message. Accuracy drops as context grows, especially for details in the middle, and every turn costs more. Consider a new chat that starts with a short summary.`,
      sources: [S.contextRot, S.lostInMiddle, S.anthropicContextEng],
    });
  }

  return {
    model,
    effort,
    reasoning,
    chars: features.chars,
    words: features.words.length,
    promptTokens,
    systemTokens,
    fixedTokens,
    files,
    fileTokens,
    historyTokens,
    inputTokens,
    output,
    context: {
      windowTokens,
      windowLabel: advanced ? model.label : `${plan.label} plan`,
      windowVerified: advanced ? !model.unverified.includes('contextWindow') : plan.verified,
      used,
      usedPct: { low: pct(used.low), mid: pct(used.mid), high: pct(used.high) },
    },
    cost: {
      low: costAt('low').total,
      mid: breakdown.total,
      high: costAt('high').total,
      breakdown,
      midWithCache,
      cacheApplies,
    },
    typicalMessages: typicalCost > 0 ? breakdown.total / typicalCost : 0,
    session,
    score,
    warnings,
  };
}

function windowLabelFor(advanced: boolean, modelLabel: string, planLabel: string): string {
  return advanced ? modelLabel : `${planLabel} plan`;
}
