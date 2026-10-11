import {
  StudioRefineRequest,
  type StudioRefineResponse,
  type StudioStatusResponse,
} from '@promptgenius/api-contract';
import { estimateTokens } from '@promptgenius/core';
import { Hono } from 'hono';
import { RATE_LIMITS, type AppDeps } from '../deps';
import { rewriteModelSpec, usageCostUsd, worstCaseCostUsd } from '../rewrite/pricing';
import { STUDIO_SYSTEM_PROMPT, buildStudioUserMessage } from '../studio/prompt';
import { StudioError } from '../studio/types';
import { clientKey, jsonError, parseJson } from './util';

const DISABLED_MODEL = 'claude-haiku-4-5';
/** A typical dictation and its refined prompt, for the price shown before switching it on. */
const TYPICAL = { transcriptTokens: 120, outputTokens: 130 };

const STATUS: Record<StudioError['code'], 400 | 422 | 502 | 503> = {
  refused: 422,
  truncated: 502,
  invalid_output: 502,
  aborted: 400,
  upstream_auth: 502,
  upstream_rate_limited: 503,
  upstream_bad_request: 502,
  upstream_error: 502,
};

export function studioRoutes(deps: AppDeps) {
  const model = rewriteModelSpec(deps.studio?.model ?? DISABLED_MODEL);
  const overheadTokens = estimateTokens(
    STUDIO_SYSTEM_PROMPT +
      buildStudioUserMessage({ platform: 'claude', transcript: 'x', gaps: [] }),
    model,
  );
  const typicalCostUsd =
    ((overheadTokens + TYPICAL.transcriptTokens) * model.pricing.input +
      TYPICAL.outputTokens * model.pricing.output) /
    1_000_000;

  return new Hono()
    .get('/studio/status', async (c) => {
      const spend = await deps.spend.status();
      return c.json({
        enabled: !!deps.studio,
        model: model.id,
        modelLabel: model.label,
        typicalCostUsd,
        capUsd: spend.capUsd,
        remainingUsd: spend.remainingUsd,
      } satisfies StudioStatusResponse);
    })
    .post('/studio/refine', async (c) => {
      const refiner = deps.studio;
      if (!refiner)
        return jsonError(
          c,
          503,
          'not_configured',
          'Studio refine needs ANTHROPIC_API_KEY on the server.',
        );
      const limit = deps.limiter.hit(
        `studio:${clientKey(c)}`,
        RATE_LIMITS.studio.max,
        RATE_LIMITS.studio.windowMs,
      );
      if (!limit.ok)
        return jsonError(
          c,
          429,
          'rate_limited',
          'Too many refines. Try again shortly.',
          limit.retryAfterSec,
        );

      const body = await parseJson(c, StudioRefineRequest);
      if (!body.ok) return body.response;
      const req = body.data;

      // Reserve the worst case before spending anything (same daily cap as the AI rewrite).
      const inputTokens = estimateTokens(STUDIO_SYSTEM_PROMPT + buildStudioUserMessage(req), model);
      const reservation = await deps.spend.reserve(
        worstCaseCostUsd(model, inputTokens, refiner.maxOutputTokens),
      );
      if (!reservation) {
        const s = await deps.spend.status();
        return jsonError(
          c,
          429,
          'daily_cap_reached',
          `Daily AI budget reached ($${s.spentUsd.toFixed(2)} of $${s.capUsd.toFixed(2)}). Resets at ${s.resetsAt}.`,
        );
      }

      try {
        const outcome = await refiner.refine(req, c.req.raw.signal);
        const costUsd = usageCostUsd(outcome.usage, outcome.model, model);
        await deps.spend.settle(reservation, costUsd);
        return c.json({
          result: outcome.result,
          usage: outcome.usage,
          costUsd,
          model: outcome.model,
        } satisfies StudioRefineResponse);
      } catch (err) {
        const e =
          err instanceof StudioError
            ? err
            : new StudioError('upstream_error', 'The refine failed unexpectedly.');
        // Bill what was actually consumed; release the reservation if nothing was.
        const costUsd = e.usage ? usageCostUsd(e.usage, model.id, model) : 0;
        if (costUsd > 0) await deps.spend.settle(reservation, costUsd);
        else await deps.spend.release(reservation);
        if (!(err instanceof StudioError)) console.error(err);
        return jsonError(c, STATUS[e.code], e.code, e.message);
      }
    });
}
