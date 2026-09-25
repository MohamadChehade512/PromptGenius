import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Reservation, SpendStatus, SpendStore } from './types';

interface Persisted {
  day: string;
  spentUsd: number;
  calls: number;
}

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function nextUtcMidnight(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return d.toISOString();
}

/**
 * Local implementation: settled spend persists to a JSON file (so restarts don't reset
 * the cap); in-flight reservations live in memory. All mutations run through a single
 * promise chain, so the check-and-reserve step is atomic within this process.
 * Phase 3 swaps this for a DynamoDB atomic counter behind the same interface.
 */
export class FileSpendStore implements SpendStore {
  private readonly reservations = new Map<string, number>();
  private state: Persisted | undefined;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly capUsd: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async load(): Promise<Persisted> {
    const day = utcDay(this.now());
    if (!this.state) {
      try {
        this.state = JSON.parse(await readFile(this.filePath, 'utf8')) as Persisted;
      } catch {
        this.state = { day, spentUsd: 0, calls: 0 };
      }
    }
    if (this.state.day !== day) this.state = { day, spentUsd: 0, calls: 0 };
    return this.state;
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(this.state), { mode: 0o600 });
    await rename(tmp, this.filePath);
  }

  private reservedTotal(): number {
    let sum = 0;
    for (const v of this.reservations.values()) sum += v;
    return sum;
  }

  private snapshot(s: Persisted): SpendStatus {
    const reservedUsd = this.reservedTotal();
    return {
      capUsd: this.capUsd,
      spentUsd: s.spentUsd,
      reservedUsd,
      remainingUsd: Math.max(0, this.capUsd - s.spentUsd - reservedUsd),
      resetsAt: nextUtcMidnight(this.now()),
    };
  }

  status(): Promise<SpendStatus> {
    return this.serialize(async () => this.snapshot(await this.load()));
  }

  reserve(amountUsd: number): Promise<Reservation | null> {
    return this.serialize(async () => {
      const s = await this.load();
      if (s.spentUsd + this.reservedTotal() + amountUsd > this.capUsd) return null;
      const reservation = { id: randomUUID(), amountUsd };
      this.reservations.set(reservation.id, amountUsd);
      return reservation;
    });
  }

  settle(reservation: Reservation, actualUsd: number): Promise<void> {
    return this.serialize(async () => {
      const s = await this.load();
      this.reservations.delete(reservation.id);
      s.spentUsd += Math.max(0, actualUsd);
      s.calls += 1;
      await this.persist();
    });
  }

  release(reservation: Reservation): Promise<void> {
    return this.serialize(() => {
      this.reservations.delete(reservation.id);
      return Promise.resolve();
    });
  }
}
