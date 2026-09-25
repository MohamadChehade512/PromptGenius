import { z } from 'zod';

/**
 * Every /api request and response, shared by the web app and the API server.
 * Requests are `.strict()`: unknown fields are rejected (PLAN.md §3.5).
 */

export const LIMITS = {
  /** Max characters sent for exact counting. */
  countChars: 100_000,
  /** Max prompt characters for the paid rewrite. */
  rewriteChars: 20_000,
} as const;

const PlatformId = z.enum(['claude', 'openai', 'gemini']);
const UseCase = z.enum([
  'qa',
  'writing',
  'coding',
  'analysis',
  'extraction',
  'brainstorming',
  'summarization',
]);

export const ApiError = z.object({
  error: z.string(),
  message: z.string().optional(),
  retryAfterSec: z.number().optional(),
});
export type ApiError = z.infer<typeof ApiError>;

/** GET /api/health */
export const HealthResponse = z.object({
  status: z.literal('ok'),
  version: z.string(),
  /** Which server-side features have keys configured. */
  features: z.object({
    countClaude: z.boolean(),
    countGemini: z.boolean(),
    rewrite: z.boolean(),
  }),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

/** POST /api/count-tokens: free vendor count endpoints (Claude, Gemini). */
export const CountTokensRequest = z
  .object({
    platform: z.enum(['claude', 'gemini']),
    model: z.string().min(1).max(100),
    text: z.string().min(1).max(LIMITS.countChars),
  })
  .strict();
export type CountTokensRequest = z.infer<typeof CountTokensRequest>;

export const CountTokensResponse = z.object({
  tokens: z.number().int().nonnegative(),
  model: z.string(),
});
export type CountTokensResponse = z.infer<typeof CountTokensResponse>;

/** GET /api/rewrite/status: everything the UI needs to price and gate the paid button. */
export const RewriteStatusResponse = z.object({
  enabled: z.boolean(),
  model: z.string(),
  modelLabel: z.string(),
  /** USD per 1M tokens. */
  pricing: z.object({
    input: z.number(),
    output: z.number(),
    cacheRead: z.number(),
    cacheWrite: z.number(),
  }),
  /** Tokens the rewrite adds around the user's prompt (system prompt + framing). */
  overheadTokens: z.number().int(),
  capUsd: z.number(),
  spentUsd: z.number(),
  reservedUsd: z.number(),
  remainingUsd: z.number(),
  resetsAt: z.iso.datetime(),
});
export type RewriteStatusResponse = z.infer<typeof RewriteStatusResponse>;

/** POST /api/rewrite: PAID. Streams RewriteEvent as server-sent events. */
export const RewriteRequest = z
  .object({
    platform: PlatformId,
    targetModel: z.string().min(1).max(100),
    useCase: UseCase,
    prompt: z.string().trim().min(1).max(LIMITS.rewriteChars),
    findings: z
      .array(z.object({ ruleId: z.string().max(100), suggestion: z.string().max(500) }).strict())
      .max(30),
    /**
     * Names and types of files the user will attach, so the rewrite can refer to them.
     * File contents are never sent: they stay in the browser.
     */
    attachments: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(200),
            kind: z.enum(['text', 'pdf', 'image']),
          })
          .strict(),
      )
      .max(10)
      .optional(),
  })
  .strict();
export type RewriteRequest = z.infer<typeof RewriteRequest>;

/** Structured output Claude must return (validated server-side before it reaches the UI). */
export const RewriteResult = z.object({
  rewritten_prompt: z.string().min(1),
  changes: z.array(z.object({ change: z.string(), reason: z.string() })).max(12),
});
export type RewriteResult = z.infer<typeof RewriteResult>;

export const RewriteUsage = z.object({
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  cacheReadTokens: z.number().int(),
  cacheWriteTokens: z.number().int(),
});
export type RewriteUsage = z.infer<typeof RewriteUsage>;

export const RewriteEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('started'), reservedUsd: z.number() }),
  z.object({
    type: z.literal('progress'),
    stage: z.enum(['thinking', 'writing']),
    outputTokens: z.number(),
  }),
  z.object({
    type: z.literal('result'),
    result: RewriteResult,
    usage: RewriteUsage,
    costUsd: z.number(),
    model: z.string(),
  }),
  z.object({
    type: z.literal('error'),
    error: z.string(),
    message: z.string(),
    costUsd: z.number(),
  }),
]);
export type RewriteEvent = z.infer<typeof RewriteEvent>;
