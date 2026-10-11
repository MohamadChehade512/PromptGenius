/** A vendor token-count endpoint (free to call, but needs an API key). */
export interface TokenCounter {
  count(model: string, text: string, signal?: AbortSignal): Promise<number>;
}

export { UpstreamError } from '@promptgenius/ai';
