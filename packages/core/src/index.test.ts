import { describe, expect, it } from 'vitest';
import { PLATFORMS, PLATFORM_LABELS } from './index';

describe('core', () => {
  it('has a label for every platform', () => {
    for (const id of PLATFORMS) {
      expect(PLATFORM_LABELS[id]).toBeTruthy();
    }
  });
});
