import Anthropic from '@anthropic-ai/sdk';
import {
  ClaudeRewriter,
  ClaudeStudioRefiner,
  RewriteError,
  STUDIO_SYSTEM_PROMPT,
  StudioError,
  buildStudioUserMessage,
  rewriteModelSpec,
  rewriteOverheadTokens,
  toUpstreamError,
  usageCostUsd,
  worstCaseCostUsd,
} from '@promptgenius/ai';
import type {
  RewriteEvent,
  RewriteRequest,
  RewriteStatusResponse,
  StudioRefineRequest,
  StudioRefineResponse,
  StudioStatusResponse,
} from '@promptgenius/api-contract';
import { estimateTokens } from '@promptgenius/core';
import { ApiRequestError } from './apiError';
import { readStorage, writeStorage } from './storage';

/**
 * The paid Claude features, called straight from this browser with the person's own API key
 * (no Prompt IQ server involved). Loaded only when a key has been added.
 */
const REWRITE_MODEL = 'claude-opus-5';
const REWRITE_EFFORT = 'medium';
const STUDIO_MODEL = 'claude-haiku-4-5';
/** A typical dictation and its refined prompt, for the price shown before switching it on. */
const TYPICAL = { transcriptTokens: 120, outputTokens: 130 };

/**
 * A spending guard, kept in this browser. It stops Prompt IQ making further paid calls today
 * once reached; a hard limit belongs on the key itself, in the Anthropic Console.
 */
const DAILY_CAP_USD = 2;
const SPEND_KEY = 'pg.aiSpend';

const today = () => new Date().toISOString().slice(0, 10);

function spentToday(): number {
  const s = readStorage<{ day?: string; usd?: number }>('local', SPEND_KEY, {});
  return s.day === today() && typeof s.usd === 'number' && s.usd > 0 ? s.usd : 0;
}

function addSpend(usd: number): void {
  if (usd > 0) writeStorage('local', SPEND_KEY, { day: today(), usd: spentToday() + usd });
}

function spendStatus() {
  const spentUsd = spentToday();
  const reset = new Date();
  reset.setUTCHours(24, 0, 0, 0);
  return {
    capUsd: DAILY_CAP_USD,
    spentUsd,
    reservedUsd: 0,
    remainingUsd: Math.max(0, DAILY_CAP_USD - spentUsd),
    resetsAt: reset.toISOString(),
  };
}

function capReached(): ApiRequestError {
  const s = spendStatus();
  return new ApiRequestError(
    429,
    'daily_cap_reached',
    `Daily AI budget reached ($${s.spentUsd.toFixed(2)} of $${s.capUsd.toFixed(2)}). Resets at midnight UTC.`,
  );
}

const client = (apiKey: string) =>
  new Anthropic({
    apiKey,
    // The key belongs to the person at this browser, who chose to use it here.
    dangerouslyAllowBrowser: true,
  });

/** Asks Anthropic whether the key works (free). Throws a short, safe message if it doesn't. */
export async function verifyKey(apiKey: string): Promise<void> {
  try {
    await client(apiKey).models.list({ limit: 1 }, { maxRetries: 0, timeout: 10_000 });
  } catch (err) {
    const upstream = toUpstreamError(err);
    throw new ApiRequestError(
      upstream.code === 'upstream_auth' ? 401 : 502,
      upstream.code,
      upstream.code === 'upstream_auth'
        ? 'Anthropic didn’t accept that key. Check it was copied in full and is still active.'
        : 'Couldn’t reach Anthropic to check the key. Try again in a moment.',
    );
  }
}

export function rewriteStatus(): RewriteStatusResponse {
  const model = rewriteModelSpec(REWRITE_MODEL);
  const p = model.pricing;
  return {
    enabled: true,
    model: model.id,
    modelLabel: model.label,
    pricing: {
      input: p.input,
      output: p.output,
      cacheRead: p.cacheRead ?? p.input * 0.1,
      cacheWrite: p.cacheWrite ?? p.input,
    },
    overheadTokens: rewriteOverheadTokens(model),
    ...spendStatus(),
  };
}

export async function streamRewrite(
  apiKey: string,
  req: RewriteRequest,
  onEvent: (e: RewriteEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const model = rewriteModelSpec(REWRITE_MODEL);
  const rewriter = new ClaudeRewriter(client(apiKey), {
    model: model.id,
    effort: REWRITE_EFFORT,
  });
  // Refuse before spending anything if the worst case wouldn't fit in today's guard.
  const promptTokens = estimateTokens(req.prompt, model);
  const reserveUsd = worstCaseCostUsd(
    model,
    rewriteOverheadTokens(model) + promptTokens,
    rewriter.maxOutputTokens(promptTokens),
  );
  if (reserveUsd > spendStatus().remainingUsd) throw capReached();

  onEvent({ type: 'started', reservedUsd: reserveUsd });
  try {
    const outcome = await rewriter.rewrite(
      req,
      (p) => onEvent({ type: 'progress', stage: p.stage, outputTokens: p.outputTokens }),
      signal,
    );
    const costUsd = usageCostUsd(outcome.usage, outcome.model, model);
    addSpend(costUsd);
    onEvent({
      type: 'result',
      result: outcome.result,
      usage: outcome.usage,
      costUsd,
      model: outcome.model,
    });
  } catch (err) {
    const e =
      err instanceof RewriteError
        ? err
        : new RewriteError('upstream_error', 'The rewrite failed unexpectedly.');
    const costUsd = e.partialUsage ? usageCostUsd(e.partialUsage, e.model ?? model.id, model) : 0;
    addSpend(costUsd);
    onEvent({ type: 'error', error: e.code, message: e.message, costUsd });
  }
}

export function studioStatus(): StudioStatusResponse {
  const model = rewriteModelSpec(STUDIO_MODEL);
  const overheadTokens = estimateTokens(
    STUDIO_SYSTEM_PROMPT +
      buildStudioUserMessage({ platform: 'claude', transcript: 'x', gaps: [] }),
    model,
  );
  const spend = spendStatus();
  return {
    enabled: true,
    model: model.id,
    modelLabel: model.label,
    typicalCostUsd:
      ((overheadTokens + TYPICAL.transcriptTokens) * model.pricing.input +
        TYPICAL.outputTokens * model.pricing.output) /
      1_000_000,
    capUsd: spend.capUsd,
    remainingUsd: spend.remainingUsd,
  };
}

export async function refineStudio(
  apiKey: string,
  req: StudioRefineRequest,
  signal: AbortSignal,
): Promise<StudioRefineResponse> {
  const model = rewriteModelSpec(STUDIO_MODEL);
  const refiner = new ClaudeStudioRefiner(client(apiKey), model.id);
  const inputTokens = estimateTokens(STUDIO_SYSTEM_PROMPT + buildStudioUserMessage(req), model);
  if (worstCaseCostUsd(model, inputTokens, refiner.maxOutputTokens) > spendStatus().remainingUsd)
    throw capReached();

  try {
    const outcome = await refiner.refine(req, signal);
    const costUsd = usageCostUsd(outcome.usage, outcome.model, model);
    addSpend(costUsd);
    return { result: outcome.result, usage: outcome.usage, costUsd, model: outcome.model };
  } catch (err) {
    const e =
      err instanceof StudioError
        ? err
        : new StudioError('upstream_error', 'The refine failed unexpectedly.');
    if (e.usage) addSpend(usageCostUsd(e.usage, model.id, model));
    throw new ApiRequestError(502, e.code, e.message);
  }
}
