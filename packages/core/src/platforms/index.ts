import { getDefaultModel, getPlatformConfig, type ModelSpec } from '../config';
import { estimateTokens } from '../estimation/tokens';
import { claudeRules, geminiRules, openaiRules } from '../scoring/rules/platform';
import type { Rule } from '../scoring/types';
import type { PlatformId } from '../types';

/**
 * Everything platform-specific lives behind this interface. Adding a platform means
 * adding a config block in models.json and one adapter here; the UI doesn't change.
 */
export interface PlatformAdapter {
  id: PlatformId;
  label: string;
  models: ModelSpec[];
  defaultModel: ModelSpec;
  /** Instant local estimate (always available). */
  estimateTokens(text: string, model: ModelSpec): number;
  /** Where an exact count comes from: a tokenizer in the browser, or the vendor's count API. */
  exactCount: 'local' | 'server';
  platformRules: readonly Rule[];
}

function makeAdapter(
  id: PlatformId,
  exactCount: 'local' | 'server',
  platformRules: Rule[],
): PlatformAdapter {
  const config = getPlatformConfig(id);
  return {
    id,
    label: config.label,
    models: config.models,
    defaultModel: getDefaultModel(id),
    estimateTokens,
    exactCount,
    platformRules,
  };
}

export const ADAPTERS: Record<PlatformId, PlatformAdapter> = {
  claude: makeAdapter('claude', 'server', claudeRules),
  openai: makeAdapter('openai', 'local', openaiRules),
  gemini: makeAdapter('gemini', 'server', geminiRules),
};

export { loadOpenAITokenizer } from './openai-tokenizer';
