import type { PlatformId } from '../types';
import raw from './models.json' with { type: 'json' };
import {
  ModelsConfigSchema,
  type ConsumerPlan,
  type MediaSpec,
  type ModelSpec,
  type ModelsConfig,
} from './schema';

export * from './schema';

/** Validated once at load: a malformed price table must fail loudly, not produce wrong numbers. */
export const MODELS_CONFIG: ModelsConfig = ModelsConfigSchema.parse(raw);

export function getPlatformConfig(platform: PlatformId) {
  return MODELS_CONFIG.platforms[platform];
}

export function listModels(platform: PlatformId): ModelSpec[] {
  return getPlatformConfig(platform).models;
}

export function getDefaultModel(platform: PlatformId): ModelSpec {
  const models = listModels(platform);
  return models.find((m) => m.default) ?? models[0]!;
}

export function findModel(platform: PlatformId, modelId: string): ModelSpec | undefined {
  return listModels(platform).find((m) => m.id === modelId);
}

/** Looks a model up across all platforms (e.g. to price a response that names its model). */
export function findModelAnywhere(modelId: string): ModelSpec | undefined {
  for (const platform of Object.values(MODELS_CONFIG.platforms)) {
    const model = platform.models.find((m) => m.id === modelId);
    if (model) return model;
  }
  return undefined;
}

export function listConsumerPlans(platform: PlatformId): ConsumerPlan[] {
  return getPlatformConfig(platform).consumerPlans;
}

/** Image and PDF token rules for a model: its own override, else its platform's. */
export function getMedia(platform: PlatformId, model: ModelSpec): MediaSpec {
  return model.media ?? getPlatformConfig(platform).media;
}
