import { describe, expect, it } from 'vitest';
import { FakeCounter } from '../test-helpers';
import { CachingCounter } from './cache';

describe('CachingCounter', () => {
  it('calls the vendor once per unique (model, text)', async () => {
    const inner = new FakeCounter();
    const c = new CachingCounter(inner);
    await c.count('m', 'hello');
    await c.count('m', 'hello');
    await c.count('other', 'hello');
    expect(inner.calls).toBe(2);
  });

  it('evicts the least recently used entry', async () => {
    const inner = new FakeCounter();
    const c = new CachingCounter(inner, 2);
    await c.count('m', 'a');
    await c.count('m', 'b');
    await c.count('m', 'a'); // refresh a
    await c.count('m', 'c'); // evicts b
    await c.count('m', 'a');
    expect(inner.calls).toBe(3);
    await c.count('m', 'b');
    expect(inner.calls).toBe(4);
  });
});
