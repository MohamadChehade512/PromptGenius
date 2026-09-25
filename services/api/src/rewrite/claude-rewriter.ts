import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { RewriteResult, type RewriteRequest, type RewriteUsage } from '@promptgenius/api-contract';
import { toUpstreamError } from '../counters/anthropic';
import { REWRITE_SYSTEM_PROMPT, buildRewriteUserMessage } from './prompt';
import { RewriteError, type RewriteOutcome, type RewriteProgress, type Rewriter } from './types';

const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export interface ClaudeRewriterOptions {
  model: string;
  effort: 'low' | 'medium' | 'high';
}

/**
 * The only paid call in the app (PLAN.md §2.6). Streams so long rewrites don't hit
 * request timeouts and the UI can show progress; the result is structured JSON that is
 * validated before it leaves the server.
 */
export class ClaudeRewriter implements Rewriter {
  readonly model: string;

  constructor(
    private readonly client: Anthropic,
    private readonly options: ClaudeRewriterOptions,
  ) {
    this.model = options.model;
  }

  maxOutputTokens(promptTokens: number): number {
    // Rewritten prompt (~1.5x the original) + change list + thinking headroom.
    return Math.min(16_000, 4_000 + Math.ceil(promptTokens * 2));
  }

  async rewrite(
    req: RewriteRequest,
    onProgress: (p: RewriteProgress) => void,
    signal: AbortSignal,
  ): Promise<RewriteOutcome> {
    const usage: RewriteUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
    let model = this.model;
    let outputChars = 0;
    let lastReport = 0;

    try {
      const stream = this.client.beta.messages.stream(
        {
          model: this.model,
          max_tokens: this.maxOutputTokens(Math.ceil(req.prompt.length / 3)),
          betas: [FALLBACK_BETA],
          // On a safety decline, re-run on Anthropic's recommended fallback model.
          fallbacks: 'default',
          thinking: { type: 'adaptive' },
          output_config: {
            effort: this.options.effort,
            format: betaZodOutputFormat(RewriteResult),
          },
          system: [
            { type: 'text', text: REWRITE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
          ],
          messages: [{ role: 'user', content: buildRewriteUserMessage(req) }],
        },
        { signal, maxRetries: 1 },
      );

      for await (const event of stream) {
        if (event.type === 'message_start') {
          const u = event.message.usage;
          model = event.message.model;
          usage.inputTokens = u.input_tokens;
          usage.cacheReadTokens = u.cache_read_input_tokens ?? 0;
          usage.cacheWriteTokens = u.cache_creation_input_tokens ?? 0;
          onProgress({ stage: 'thinking', outputTokens: 0 });
        } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          outputChars += event.delta.text.length;
          const approx = Math.round(outputChars / 4);
          if (approx - lastReport >= 25) {
            lastReport = approx;
            onProgress({ stage: 'writing', outputTokens: approx });
          }
        } else if (event.type === 'message_delta') {
          usage.outputTokens = event.usage.output_tokens;
        }
      }

      const message = await stream.finalMessage();
      model = message.model;
      usage.inputTokens = message.usage.input_tokens;
      usage.outputTokens = message.usage.output_tokens;
      usage.cacheReadTokens = message.usage.cache_read_input_tokens ?? 0;
      usage.cacheWriteTokens = message.usage.cache_creation_input_tokens ?? 0;

      if (message.stop_reason === 'refusal') {
        throw new RewriteError('refused', 'Claude declined to rewrite this prompt.', usage, model);
      }
      if (message.stop_reason === 'max_tokens') {
        throw new RewriteError(
          'truncated',
          'The rewrite was cut off before it finished.',
          usage,
          model,
        );
      }

      const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new RewriteError(
          'invalid_output',
          'The rewrite came back in an unexpected format.',
          usage,
          model,
        );
      }
      const result = RewriteResult.safeParse(parsed);
      if (!result.success) {
        throw new RewriteError(
          'invalid_output',
          'The rewrite came back in an unexpected format.',
          usage,
          model,
        );
      }
      return { result: result.data, usage, model };
    } catch (err) {
      if (err instanceof RewriteError) throw err;
      const partial = usage.inputTokens || usage.outputTokens ? usage : undefined;
      if (signal.aborted || err instanceof Anthropic.APIUserAbortError) {
        throw new RewriteError('aborted', 'The rewrite was cancelled.', partial, model);
      }
      const upstream = toUpstreamError(err);
      throw new RewriteError(upstream.code, upstream.message, partial, model);
    }
  }
}
