import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  StudioRefineResult,
  type RewriteUsage,
  type StudioRefineRequest,
} from '@promptgenius/api-contract';
import { z } from 'zod';
import { toUpstreamError } from '../upstream';
import { STUDIO_SYSTEM_PROMPT, buildStudioUserMessage } from './prompt';
import { StudioError, type StudioOutcome, type StudioRefiner } from './types';

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * What the model writes. "given" comes first so it lists what the speaker said before it
 * writes the prompt, which stops details being dropped or invented; it never leaves the server.
 */
const ModelOutput = z.object({ given: z.array(z.string()), ...StudioRefineResult.shape });

/**
 * The question is put to the speaker, so "Should I include examples?" (the model talking about
 * itself) reads as if the speaker were asking. Rephrase it about the answer instead.
 */
export function asSpokenToSpeaker(question: string): string {
  return question.trim().replace(/^(should|shall|can|could|do|would) i\b/i, (_, verb: string) => {
    const v = verb.toLowerCase() === 'do' ? 'Should' : verb[0]!.toUpperCase() + verb.slice(1);
    return `${v} it`;
  });
}

/**
 * Prompt Studio's paid step: one small, non-streaming call per refine. No extended thinking
 * and a tight output ceiling keep it fast and cheap; the result is structured JSON, validated
 * before it leaves the server.
 */
export class ClaudeStudioRefiner implements StudioRefiner {
  /** A refined prompt is a few short lines; this leaves generous room without inviting essays. */
  readonly maxOutputTokens = 1_500;

  constructor(
    private readonly client: Anthropic,
    readonly model: string,
  ) {}

  async refine(req: StudioRefineRequest, signal: AbortSignal): Promise<StudioOutcome> {
    let usage: RewriteUsage | undefined;
    try {
      const message = await this.client.messages.parse(
        {
          model: this.model,
          max_tokens: this.maxOutputTokens,
          system: STUDIO_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildStudioUserMessage(req) }],
          output_config: { format: zodOutputFormat(ModelOutput) },
        },
        // Someone is mid-sentence waiting on this: fail fast rather than queue behind retries.
        { signal, maxRetries: 1, timeout: REQUEST_TIMEOUT_MS },
      );
      usage = {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
      };
      if (message.stop_reason === 'refusal')
        throw new StudioError('refused', 'Claude declined to refine this.', usage);
      if (message.stop_reason === 'max_tokens')
        throw new StudioError('truncated', 'The refined prompt was cut off.', usage);
      const result = StudioRefineResult.safeParse(message.parsed_output);
      if (!result.success || !result.data.prompt.trim())
        throw new StudioError(
          'invalid_output',
          'The refined prompt came back in an unexpected format.',
          usage,
        );
      return {
        result: { ...result.data, question: asSpokenToSpeaker(result.data.question) },
        usage,
        model: message.model,
      };
    } catch (err) {
      if (err instanceof StudioError) throw err;
      if (signal.aborted || err instanceof Anthropic.APIUserAbortError)
        throw new StudioError('aborted', 'The refine was cancelled.', usage);
      const upstream = toUpstreamError(err);
      throw new StudioError(upstream.code, upstream.message, usage);
    }
  }
}
