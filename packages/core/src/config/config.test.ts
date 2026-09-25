import { describe, expect, it } from 'vitest';
import { PLATFORMS } from '../types';
import { getDefaultModel, listConsumerPlans, listModels, MODELS_CONFIG } from './index';

describe('models config', () => {
  it('has exactly one default model per platform', () => {
    for (const p of PLATFORMS) {
      expect(listModels(p).filter((m) => m.default)).toHaveLength(1);
      expect(getDefaultModel(p).default).toBe(true);
    }
  });

  it('keeps each default reasoning level within the supported levels', () => {
    for (const p of PLATFORMS) {
      for (const m of listModels(p)) {
        if (m.reasoning) expect(m.reasoning.levels).toContain(m.reasoning.default);
      }
    }
  });

  it('prices output above input for every model', () => {
    for (const p of PLATFORMS) {
      for (const m of listModels(p)) expect(m.pricing.output).toBeGreaterThan(m.pricing.input);
    }
  });

  it('lists at least one consumer plan per platform and a verification date', () => {
    for (const p of PLATFORMS) expect(listConsumerPlans(p).length).toBeGreaterThan(0);
    expect(MODELS_CONFIG.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
