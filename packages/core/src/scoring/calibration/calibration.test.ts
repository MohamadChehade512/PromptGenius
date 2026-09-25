import { describe, expect, it } from 'vitest';
import { runCalibration } from './calibrate';

/**
 * Guards the scorer against regressions (PLAN.md §2.7). Run `pnpm --filter
 * @promptgenius/core calibrate` for the full table when tuning rules or weights.
 */
describe('calibration', () => {
  const report = runCalibration();

  it('places at least 90% of labeled prompts in their band', () => {
    expect(report.accuracy).toBeGreaterThanOrEqual(0.9);
  });

  it('ranks prompts consistently with the labels', () => {
    expect(report.spearman).toBeGreaterThanOrEqual(0.85);
  });

  it('keeps label means clearly separated', () => {
    expect(report.means.ok - report.means.weak).toBeGreaterThan(15);
    expect(report.means.strong - report.means.ok).toBeGreaterThan(15);
  });
});
