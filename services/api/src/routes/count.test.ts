import { describe, expect, it } from 'vitest';
import { UpstreamError } from '../counters/types';
import { MemoryRateLimiter } from '../ratelimit/memory';
import { FakeCounter, makeApp, postJson } from '../test-helpers';

const valid = { platform: 'claude', model: 'claude-sonnet-5', text: 'Hello there' };

describe('POST /api/count-tokens', () => {
  it('returns the vendor count', async () => {
    const { app } = makeApp({ counters: { claude: new FakeCounter(() => 7) } });
    const res = await postJson(app, '/api/count-tokens', valid);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tokens: 7, model: 'claude-sonnet-5' });
  });

  it('validates the body and rejects unknown fields', async () => {
    const { app } = makeApp({ counters: { claude: new FakeCounter() } });
    expect((await postJson(app, '/api/count-tokens', { ...valid, extra: true })).status).toBe(400);
    expect((await postJson(app, '/api/count-tokens', { ...valid, text: '' })).status).toBe(400);
    const bad = await app.request('/api/count-tokens', { method: 'POST', body: 'not json' });
    expect(bad.status).toBe(400);
  });

  it('rejects models that are not in the config', async () => {
    const { app } = makeApp({ counters: { claude: new FakeCounter() } });
    const res = await postJson(app, '/api/count-tokens', { ...valid, model: 'claude-9000' });
    expect(res.status).toBe(400);
  });

  it('returns 503 not_configured when the platform has no key', async () => {
    const { app } = makeApp();
    const res = await postJson(app, '/api/count-tokens', valid);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'not_configured' });
  });

  it('maps upstream errors without leaking details', async () => {
    const counter = new FakeCounter(
      () => new UpstreamError('upstream_auth', 'The Anthropic API key was rejected.'),
    );
    const { app } = makeApp({ counters: { claude: counter } });
    const res = await postJson(app, '/api/count-tokens', valid);
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'upstream_auth' });
  });

  it('rate limits per client', async () => {
    let t = 0;
    const { app } = makeApp({
      counters: { claude: new FakeCounter() },
      limiter: new MemoryRateLimiter(() => t),
    });
    for (let i = 0; i < 120; i++) await postJson(app, '/api/count-tokens', valid);
    const res = await postJson(app, '/api/count-tokens', valid);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
    t = 61_000;
    expect((await postJson(app, '/api/count-tokens', valid)).status).toBe(200);
  });
});
