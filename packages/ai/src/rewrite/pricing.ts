import type { RewriteUsage } from '@promptgenius/api-contract';
import { callCost, estimateTokens, findModelAnywhere, type ModelSpec } from '@promptgenius/core';
import { REWRITE_SYSTEM_PROMPT, buildRewriteUserMessage } from './prompt';

export function rewriteModelSpec(modelId: string): ModelSpec {
  const model = findModelAnywhere(modelId);
  if (!model) throw new Error(`Rewrite model ${modelId} is not in models.json`);
  return model;
}

/** Tokens the rewrite wraps around the user's prompt: system prompt + request framing. */
export function rewriteOverheadTokens(model: ModelSpec): number {
  const framing = buildRewriteUserMessage({
    platform: 'claude',
    targetModel: 'x',
    useCase: 'qa',
    prompt: '',
    findings: [],
  });
  return estimateTokens(REWRITE_SYSTEM_PROMPT + framing, model);
}

/** Actual cost from API usage. A fallback model is priced at its own rates when known. */
export function usageCostUsd(usage: RewriteUsage, servedBy: string, requested: ModelSpec): number {
  const model = findModelAnywhere(servedBy) ?? requested;
  return callCost(model, {
    inputTokens: usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheWriteTokens: usage.cacheWriteTokens,
    outputTokens: usage.outputTokens,
  }).total;
}

/**
 * Worst case for the reservation: every input token written to cache (the priciest input
 * rate) with 20% estimation margin, plus the full max_tokens of output.
 */
export function worstCaseCostUsd(
  model: ModelSpec,
  inputTokens: number,
  maxOutputTokens: number,
): number {
  const writeRate = model.pricing.cacheWrite ?? model.pricing.input;
  return (
    (Math.ceil(inputTokens * 1.2) * writeRate + maxOutputTokens * model.pricing.output) / 1_000_000
  );
}
