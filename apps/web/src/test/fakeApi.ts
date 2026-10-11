import type {
  HealthResponse,
  RewriteEvent,
  RewriteStatusResponse,
  StudioRefineResult,
} from '@promptgenius/api-contract';
import { vi } from 'vitest';

export interface FakeApiOptions {
  features?: Partial<HealthResponse['features']>;
  rewriteEnabled?: boolean;
  countTokens?: number;
  rewriteEvents?: RewriteEvent[];
  /** Prompt Studio's Claude refine: on when set; called with each request's transcript. */
  studioRefine?: (transcript: string) => StudioRefineResult | { error: string; status: number };
}

export function rewriteStatus(enabled: boolean): RewriteStatusResponse {
  return {
    enabled,
    model: 'claude-opus-5',
    modelLabel: 'Claude Opus 5',
    pricing: { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
    overheadTokens: 900,
    capUsd: 2,
    spentUsd: 0,
    reservedUsd: 0,
    remainingUsd: 2,
    resetsAt: '2026-09-24T00:00:00.000Z',
  };
}

function sse(events: RewriteEvent[]): Response {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

/** Routes fetch calls to canned responses and records every call. */
export function installFakeApi(opts: FakeApiOptions = {}) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/health') {
      return Promise.resolve(
        Response.json({
          status: 'ok',
          version: 'test',
          features: {
            countClaude: false,
            countGemini: false,
            rewrite: !!opts.rewriteEnabled,
            studio: !!opts.studioRefine,
            ...opts.features,
          },
        }),
      );
    }
    if (url === '/api/rewrite/status')
      return Promise.resolve(Response.json(rewriteStatus(!!opts.rewriteEnabled)));
    if (url === '/api/count-tokens')
      return Promise.resolve(Response.json({ tokens: opts.countTokens ?? 5, model: 'x' }));
    if (url === '/api/rewrite' && init?.method === 'POST')
      return Promise.resolve(sse(opts.rewriteEvents ?? []));
    if (url === '/api/studio/status')
      return Promise.resolve(
        Response.json({
          enabled: !!opts.studioRefine,
          model: 'claude-haiku-4-5',
          modelLabel: 'Claude Haiku 4.5',
          typicalCostUsd: 0.0009,
          capUsd: 2,
          remainingUsd: 2,
        }),
      );
    if (url === '/api/studio/refine' && init?.method === 'POST' && opts.studioRefine) {
      const { transcript } = JSON.parse(init.body as string) as { transcript: string };
      const out = opts.studioRefine(transcript);
      return Promise.resolve(
        'error' in out
          ? Response.json({ error: out.error, message: 'Refine failed.' }, { status: out.status })
          : Response.json({
              result: out,
              usage: {
                inputTokens: 550,
                outputTokens: 40,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
              },
              costUsd: 0.0008,
              model: 'claude-haiku-4-5',
            }),
      );
    }
    return Promise.resolve(Response.json({ error: 'not_found' }, { status: 404 }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    fetchMock,
    calls: (path: string) => fetchMock.mock.calls.filter(([u]) => u === path),
  };
}
