import type { RewriteEvent, RewriteRequest } from '@promptgenius/api-contract';
import { createApp } from './app';
import type { TokenCounter } from './counters/types';
import type { AppDeps } from './deps';
import { MemoryRateLimiter } from './ratelimit/memory';
import { RewriteError, type RewriteOutcome, type Rewriter } from './rewrite/types';
import type { Reservation, SpendStatus, SpendStore } from './spend/types';

export class FakeCounter implements TokenCounter {
  calls = 0;
  constructor(private readonly impl: (text: string) => number | Error = (t) => t.length) {}
  count(_model: string, text: string) {
    this.calls++;
    const r = this.impl(text);
    return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
  }
}

export class MemorySpendStore implements SpendStore {
  spent = 0;
  settled: number[] = [];
  released = 0;
  private reserved = new Map<string, number>();
  constructor(private readonly cap = 2) {}
  status(): Promise<SpendStatus> {
    const reservedUsd = [...this.reserved.values()].reduce((s, v) => s + v, 0);
    return Promise.resolve({
      capUsd: this.cap,
      spentUsd: this.spent,
      reservedUsd,
      remainingUsd: Math.max(0, this.cap - this.spent - reservedUsd),
      resetsAt: '2026-09-24T00:00:00.000Z',
    });
  }
  async reserve(amountUsd: number) {
    const s = await this.status();
    if (amountUsd > s.remainingUsd) return null;
    const r = { id: String(this.reserved.size + 1), amountUsd };
    this.reserved.set(r.id, amountUsd);
    return r;
  }
  settle(r: Reservation, actual: number) {
    this.reserved.delete(r.id);
    this.spent += actual;
    this.settled.push(actual);
    return Promise.resolve();
  }
  release(r: Reservation) {
    this.reserved.delete(r.id);
    this.released++;
    return Promise.resolve();
  }
}

export class FakeRewriter implements Rewriter {
  readonly model = 'claude-opus-5';
  lastRequest?: RewriteRequest;
  constructor(private readonly behavior: () => RewriteOutcome | RewriteError) {}
  maxOutputTokens() {
    return 4_000;
  }
  rewrite(
    req: RewriteRequest,
    onProgress: (p: { stage: 'thinking' | 'writing'; outputTokens: number }) => void,
  ) {
    this.lastRequest = req;
    onProgress({ stage: 'thinking', outputTokens: 0 });
    const r = this.behavior();
    return r instanceof RewriteError ? Promise.reject(r) : Promise.resolve(r);
  }
}

export function makeApp(overrides: Partial<AppDeps> = {}) {
  const deps: AppDeps = {
    counters: {},
    spend: new MemorySpendStore(),
    limiter: new MemoryRateLimiter(),
    ...overrides,
  };
  return { app: createApp(deps), deps };
}

export function postJson(app: ReturnType<typeof createApp>, path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function readEvents(res: Response): Promise<RewriteEvent[]> {
  const text = await res.text();
  return text
    .split('\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => JSON.parse(l.slice(6)) as RewriteEvent);
}
