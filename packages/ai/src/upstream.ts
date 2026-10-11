import Anthropic from '@anthropic-ai/sdk';

export class UpstreamError extends Error {
  constructor(
    readonly code:
      'upstream_auth' | 'upstream_rate_limited' | 'upstream_bad_request' | 'upstream_error',
    message: string,
  ) {
    super(message);
  }
}

/** Maps an SDK failure to a short, safe message (never the request, headers or key). */
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
