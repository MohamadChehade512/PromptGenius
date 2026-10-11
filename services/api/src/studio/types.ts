import type {
  RewriteUsage,
  StudioRefineRequest,
  StudioRefineResult,
} from '@promptgenius/api-contract';

export interface StudioOutcome {
  result: StudioRefineResult;
  usage: RewriteUsage;
  model: string;
}

export type StudioErrorCode =
  | 'refused'
  | 'truncated'
  | 'invalid_output'
  | 'aborted'
  | 'upstream_auth'
  | 'upstream_rate_limited'
  | 'upstream_bad_request'
  | 'upstream_error';

export class StudioError extends Error {
  constructor(
    readonly code: StudioErrorCode,
    message: string,
    /** Tokens already billed when the failure happened, if known. */
    readonly usage?: RewriteUsage,
  ) {
    super(message);
  }
}

export interface StudioRefiner {
  readonly model: string;
  /** Hard ceiling on output tokens (used for the spend reservation). */
  readonly maxOutputTokens: number;
  refine(req: StudioRefineRequest, signal: AbortSignal): Promise<StudioOutcome>;
}
