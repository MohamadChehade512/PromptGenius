/** A vendor token-count endpoint (free to call, but needs an API key). */
export interface TokenCounter {
  count(model: string, text: string, signal?: AbortSignal): Promise<number>;
}

export class UpstreamError extends Error {
  constructor(
    readonly code:
      'upstream_auth' | 'upstream_rate_limited' | 'upstream_bad_request' | 'upstream_error',
    message: string,
  ) {
    super(message);
  }
}
