import { HealthResponse } from '@promptgenius/api-contract';
import { describe, expect, it } from 'vitest';
import { FakeCounter, makeApp, postJson } from './test-helpers';

describe('api basics', () => {
  it('GET /api/health matches the contract and reports configured features', async () => {
    const { app } = makeApp({ counters: { claude: new FakeCounter() } });
    const res = await app.request('/api/health');
    const body = HealthResponse.parse(await res.json());
    expect(body.features).toEqual({ countClaude: true, countGemini: false, rewrite: false });
  });

  it('sets security headers', async () => {
    const { app } = makeApp();
    const res = await app.request('/api/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('returns JSON 404 for unknown routes', async () => {
    const { app } = makeApp();
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'not_found' });
  });

  it('rejects oversized bodies with 413', async () => {
    const { app } = makeApp();
    const res = await postJson(app, '/api/count-tokens', { text: 'x'.repeat(600 * 1024) });
    expect(res.status).toBe(413);
  });
});
