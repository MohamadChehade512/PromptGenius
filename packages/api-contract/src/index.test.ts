import { describe, expect, it } from 'vitest';
import { HealthResponse } from './index';

describe('HealthResponse', () => {
  it('rejects unexpected status values', () => {
    expect(HealthResponse.safeParse({ status: 'down', version: '0.0.0' }).success).toBe(false);
  });
});
