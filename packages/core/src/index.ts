/**
 * @promptgenius/core
 *
 * Pure TypeScript engine shared by the web app and the API. It must stay free of
 * UI, network, and Node/browser-specific APIs so it runs identically in both.
 *
 * Planned modules (see PLAN.md §3.4): platforms/, estimation/, cost/, scoring/, config/.
 */

export const PLATFORMS = ['claude', 'openai', 'gemini'] as const;
export type PlatformId = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<PlatformId, string> = {
  claude: 'Claude',
  openai: 'ChatGPT',
  gemini: 'Gemini',
};
