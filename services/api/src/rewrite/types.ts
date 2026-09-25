import type { RewriteRequest, RewriteResult, RewriteUsage } from '@promptgenius/api-contract';

export interface RewriteProgress {
  stage: 'thinking' | 'writing';
  outputTokens: number;
}

export interface RewriteOutcome {
  result: RewriteResult;
  usage: RewriteUsage;
  /** The model that actually served the request (may differ if a fallback ran). */
  model: string;
}

export type RewriteErrorCode =
  | 'refused'
  | 'truncated'
  | 'invalid_output'
  | 'aborted'
  | 'upstream_auth'
  | 'upstream_rate_limited'
  | 'upstream_bad_request'
  | 'upstream_error';

export class RewriteError extends Error {
  constructor(
    readonly code: RewriteErrorCode,
    message: string,
    /** Tokens already billed when the failure happened (e.g. mid-stream), if known. */
    readonly partialUsage?: RewriteUsage,
    readonly model?: string,
  ) {
    super(message);
  }
}

export interface Rewriter {
  readonly model: string;
  /** Upper bound on output tokens for a prompt of this size (used for the spend reservation). */
  maxOutputTokens(promptTokens: number): number;
  rewrite(
    req: RewriteRequest,
    onProgress: (p: RewriteProgress) => void,
    signal: AbortSignal,
  ): Promise<RewriteOutcome>;
}
