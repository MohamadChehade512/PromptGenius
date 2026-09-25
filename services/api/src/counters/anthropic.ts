import Anthropic from '@anthropic-ai/sdk';
import { type TokenCounter, UpstreamError } from './types';

export function toUpstreamError(err: unknown): UpstreamError {
  if (
    err instanceof Anthropic.AuthenticationError ||
    err instanceof Anthropic.PermissionDeniedError
  ) {
    return new UpstreamError('upstream_auth', 'The Anthropic API key was rejected.');
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new UpstreamError(
      'upstream_rate_limited',
      'Anthropic rate limit reached. Try again shortly.',
    );
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new UpstreamError('upstream_bad_request', 'Anthropic rejected the request.');
  }
  return new UpstreamError('upstream_error', 'Anthropic API error.');
}

/** POST /v1/messages/count_tokens: counts the text as a single user message. */
export class AnthropicTokenCounter implements TokenCounter {
  constructor(private readonly client: Anthropic) {}

  async count(model: string, text: string, signal?: AbortSignal): Promise<number> {
    try {
      const res = await this.client.messages.countTokens(
        { model, messages: [{ role: 'user', content: text }] },
        { signal, timeout: 10_000, maxRetries: 1 },
      );
      return res.input_tokens;
    } catch (err) {
      throw toUpstreamError(err);
    }
  }
}
