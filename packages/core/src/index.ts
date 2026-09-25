/**
 * @promptgenius/core
 *
 * Pure TypeScript engine shared by the web app and the API. It must stay free of
 * UI, network, and Node/browser-specific APIs so it runs identically in both.
 */
export * from './types';
export * from './config';
export * from './text/analyze';
export * from './estimation/tokens';
export * from './estimation/output';
export * from './cost/cost';
export * from './cost/session';
export * from './attachments';
export * from './scoring/types';
export * from './scoring/sources';
export * from './scoring/engine';
export * from './scoring/weights';
export { ALL_RULES } from './scoring/rules';
export * from './platforms';
export * from './analyze';

import { PLATFORMS, type PlatformId } from './types';
import { MODELS_CONFIG } from './config';

export const PLATFORM_LABELS: Record<PlatformId, string> = Object.fromEntries(
  PLATFORMS.map((p) => [p, MODELS_CONFIG.platforms[p].label]),
) as Record<PlatformId, string>;
