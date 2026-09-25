import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileSpendStore } from './file-store';

function tempFile() {
  return join(mkdtempSync(join(tmpdir(), 'pg-spend-')), 'spend.json');
}

describe('FileSpendStore', () => {
  it('refuses a reservation that would exceed the cap', async () => {
    const store = new FileSpendStore(tempFile(), 2);
    expect(await store.reserve(1.5)).not.toBeNull();
    expect(await store.reserve(0.6)).toBeNull();
    expect((await store.status()).remainingUsd).toBeCloseTo(0.5);
  });

  it('settles the actual cost and frees the rest of the reservation', async () => {
    const store = new FileSpendStore(tempFile(), 2);
    const r = (await store.reserve(1.5))!;
    await store.settle(r, 0.1);
    const s = await store.status();
    expect(s.spentUsd).toBeCloseTo(0.1);
    expect(s.reservedUsd).toBe(0);
    expect(s.remainingUsd).toBeCloseTo(1.9);
  });

  it('never lets concurrent reservations overshoot the cap', async () => {
    const store = new FileSpendStore(tempFile(), 2);
    const results = await Promise.all(Array.from({ length: 10 }, () => store.reserve(0.45)));
    expect(results.filter(Boolean)).toHaveLength(4);
  });

  it('persists settled spend across restarts and resets at UTC midnight', async () => {
    const file = tempFile();
    let now = new Date('2026-09-23T23:00:00Z');
    const a = new FileSpendStore(file, 2, () => now);
    await a.settle((await a.reserve(0.5))!, 0.3);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({
      day: '2026-09-23',
      spentUsd: 0.3,
    });

    const b = new FileSpendStore(file, 2, () => now);
    expect((await b.status()).spentUsd).toBeCloseTo(0.3);
    now = new Date('2026-09-24T00:00:01Z');
    expect((await b.status()).spentUsd).toBe(0);
    expect((await b.status()).resetsAt).toBe('2026-09-25T00:00:00.000Z');
  });

  it('release returns the full reservation', async () => {
    const store = new FileSpendStore(tempFile(), 2);
    const r = (await store.reserve(2))!;
    await store.release(r);
    expect((await store.status()).remainingUsd).toBe(2);
  });
});
