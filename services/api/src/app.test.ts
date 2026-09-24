import { HealthResponse } from '@promptgenius/api-contract';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('api', () => {
  const app = createApp();

  it('GET /api/health matches the contract', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(HealthResponse.safeParse(await res.json()).success).toBe(true);
  });

  it('sets security headers', async () => {
    const res = await app.request('/api/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});
