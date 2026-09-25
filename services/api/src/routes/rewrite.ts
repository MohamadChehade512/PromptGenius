import {
  RewriteRequest,
  type RewriteEvent,
  type RewriteStatusResponse,
} from '@promptgenius/api-contract';
import { estimateTokens } from '@promptgenius/core';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { RATE_LIMITS, type AppDeps } from '../deps';
import {
  rewriteModelSpec,
  rewriteOverheadTokens,
  usageCostUsd,
  worstCaseCostUsd,
} from '../rewrite/pricing';
import { RewriteError } from '../rewrite/types';
import { clientKey, jsonError, parseJson } from './util';

const DISABLED_MODEL = 'claude-opus-5';

export function rewriteRoutes(deps: AppDeps) {
  const modelId = deps.rewriter?.model ?? DISABLED_MODEL;
  const model = rewriteModelSpec(modelId);
  const overheadTokens = rewriteOverheadTokens(model);

  return new Hono()
    .get('/rewrite/status', async (c) => {
      const spend = await deps.spend.status();
      const p = model.pricing;
      return c.json({
        enabled: !!deps.rewriter,
        model: model.id,
        modelLabel: model.label,
        pricing: {
          input: p.input,
          output: p.output,
          cacheRead: p.cacheRead ?? p.input * 0.1,
          cacheWrite: p.cacheWrite ?? p.input,
        },
        overheadTokens,
        ...spend,
      } satisfies RewriteStatusResponse);
    })
    .post('/rewrite', async (c) => {
      const rewriter = deps.rewriter;
      if (!rewriter) {
        return jsonError(
          c,
          503,
          'not_configured',
          'AI rewrite needs ANTHROPIC_API_KEY on the server.',
        );
      }
      const limit = deps.limiter.hit(
        `rewrite:${clientKey(c)}`,
        RATE_LIMITS.rewrite.max,
        RATE_LIMITS.rewrite.windowMs,
      );
      if (!limit.ok)
        return jsonError(
          c,
          429,
          'rate_limited',
          'Too many rewrites. Try again later.',
          limit.retryAfterSec,
        );

      const body = await parseJson(c, RewriteRequest);
      if (!body.ok) return body.response;
      const req = body.data;

      // Reserve the worst case before spending anything (PLAN.md §3.6 rule 7).
      const promptTokens = estimateTokens(req.prompt, model);
      const reserveUsd = worstCaseCostUsd(
        model,
        overheadTokens + promptTokens,
        rewriter.maxOutputTokens(promptTokens),
      );
      const reservation = await deps.spend.reserve(reserveUsd);
      if (!reservation) {
        const s = await deps.spend.status();
        return jsonError(
          c,
          429,
          'daily_cap_reached',
          `Daily rewrite budget reached ($${s.spentUsd.toFixed(2)} of $${s.capUsd.toFixed(2)}). Resets at ${s.resetsAt}.`,
        );
      }

      return streamSSE(c, async (stream) => {
        const controller = new AbortController();
        stream.onAbort(() => controller.abort());
        const send = (event: RewriteEvent) => stream.writeSSE({ data: JSON.stringify(event) });

        await send({ type: 'started', reservedUsd: reserveUsd });
        try {
          const outcome = await rewriter.rewrite(
            req,
            (p) => void send({ type: 'progress', stage: p.stage, outputTokens: p.outputTokens }),
            controller.signal,
          );
          const costUsd = usageCostUsd(outcome.usage, outcome.model, model);
          await deps.spend.settle(reservation, costUsd);
          await send({
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
          // Bill what was actually consumed; release the reservation if nothing was.
          const costUsd = e.partialUsage
            ? usageCostUsd(e.partialUsage, e.model ?? model.id, model)
            : 0;
          if (costUsd > 0) await deps.spend.settle(reservation, costUsd);
          else await deps.spend.release(reservation);
          if (!(err instanceof RewriteError)) console.error(err);
          await send({ type: 'error', error: e.code, message: e.message, costUsd });
        }
      });
    });
}
