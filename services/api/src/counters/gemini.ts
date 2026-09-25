import type { GoogleGenAI } from '@google/genai';
import { type TokenCounter, UpstreamError } from './types';

/** Gemini `countTokens`: free, needs an API key. */
export class GeminiTokenCounter implements TokenCounter {
  constructor(private readonly client: GoogleGenAI) {}

  async count(model: string, text: string, signal?: AbortSignal): Promise<number> {
    try {
      const res = await this.client.models.countTokens({
        model,
        contents: text,
        config: { abortSignal: signal },
      });
      return res.totalTokens ?? 0;
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401 || status === 403)
        throw new UpstreamError('upstream_auth', 'The Gemini API key was rejected.');
      if (status === 429)
        throw new UpstreamError(
          'upstream_rate_limited',
          'Gemini rate limit reached. Try again shortly.',
        );
      if (status === 400 || status === 404)
        throw new UpstreamError('upstream_bad_request', 'Gemini rejected the request.');
      throw new UpstreamError('upstream_error', 'Gemini API error.');
    }
  }
}
