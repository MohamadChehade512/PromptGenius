import { describe, expect, it } from 'vitest';
import { CountTokensRequest, HealthResponse, RewriteEvent, RewriteRequest } from './index';

describe('api contract', () => {
  it('rejects unexpected health status values', () => {
    const features = { countClaude: false, countGemini: false, rewrite: false };
    expect(HealthResponse.safeParse({ status: 'down', version: '0', features }).success).toBe(
      false,
    );
  });

  it('rejects unknown request fields', () => {
    expect(
      CountTokensRequest.safeParse({ platform: 'claude', model: 'm', text: 'hi', extra: 1 })
        .success,
    ).toBe(false);
  });

  it('only counts on platforms that need a server (not OpenAI)', () => {
    expect(
      CountTokensRequest.safeParse({ platform: 'openai', model: 'm', text: 'hi' }).success,
    ).toBe(false);
  });

  it('caps rewrite prompt size', () => {
    const base = { platform: 'claude', targetModel: 'm', useCase: 'qa', findings: [] };
    expect(RewriteRequest.safeParse({ ...base, prompt: 'x'.repeat(20_001) }).success).toBe(false);
    expect(RewriteRequest.safeParse({ ...base, prompt: '   ' }).success).toBe(false);
  });

  it('parses stream events by type', () => {
    expect(RewriteEvent.parse({ type: 'progress', stage: 'writing', outputTokens: 10 }).type).toBe(
      'progress',
    );
  });
});
