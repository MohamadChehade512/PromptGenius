import { CountTokensRequest, type CountTokensResponse } from '@promptgenius/api-contract';
import { findModel } from '@promptgenius/core';
import { Hono } from 'hono';
import { UpstreamError } from '../counters/types';
import { RATE_LIMITS, type AppDeps } from '../deps';
import { clientKey, jsonError, parseJson } from './util';

export function countRoutes(deps: AppDeps) {
  return new Hono().post('/count-tokens', async (c) => {
    const limit = deps.limiter.hit(
      `count:${clientKey(c)}`,
      RATE_LIMITS.count.max,
      RATE_LIMITS.count.windowMs,
    );
    if (!limit.ok)
      return jsonError(c, 429, 'rate_limited', 'Too many count requests.', limit.retryAfterSec);

    const body = await parseJson(c, CountTokensRequest);
    if (!body.ok) return body.response;
    const { platform, model, text } = body.data;

    if (!findModel(platform, model))
      return jsonError(c, 400, 'unknown_model', `Unknown ${platform} model.`);
    const counter = deps.counters[platform];
    if (!counter) {
      return jsonError(
        c,
        503,
        'not_configured',
        `Exact ${platform} counting needs an API key on the server.`,
      );
    }

    try {
      const tokens = await counter.count(model, text, c.req.raw.signal);
      return c.json({ tokens, model } satisfies CountTokensResponse);
    } catch (err) {
      if (err instanceof UpstreamError) {
        const status = err.code === 'upstream_rate_limited' ? 429 : 502;
        return jsonError(c, status, err.code, err.message);
      }
      throw err;
    }
  });
}
