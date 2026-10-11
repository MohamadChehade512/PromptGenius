import type Anthropic from '@anthropic-ai/sdk';
import { toUpstreamError } from '@promptgenius/ai';
import type { TokenCounter } from './types';

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
