import {
  ApiError,
  CountTokensResponse,
  HealthResponse,
  RewriteEvent,
  RewriteStatusResponse,
  StudioRefineResponse,
  StudioStatusResponse,
  type CountTokensRequest,
  type RewriteRequest,
  type StudioRefineRequest,
} from '@promptgenius/api-contract';

/** Every API response is validated against the shared contract before use. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function failure(res: Response): Promise<ApiRequestError> {
  const body = ApiError.safeParse(await res.json().catch(() => null));
  return new ApiRequestError(
    res.status,
    body.success ? body.data.error : 'http_error',
    (body.success && body.data.message) || `Request failed (${res.status})`,
  );
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch('/api/health', { signal });
  if (!res.ok) throw await failure(res);
  return HealthResponse.parse(await res.json());
}

export async function countTokens(
  req: CountTokensRequest,
  signal?: AbortSignal,
): Promise<CountTokensResponse> {
  const res = await fetch('/api/count-tokens', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok) throw await failure(res);
  return CountTokensResponse.parse(await res.json());
}

export async function getRewriteStatus(signal?: AbortSignal): Promise<RewriteStatusResponse> {
  const res = await fetch('/api/rewrite/status', { signal });
  if (!res.ok) throw await failure(res);
  return RewriteStatusResponse.parse(await res.json());
}

/**
 * PAID: POST /api/rewrite and read the server-sent event stream. Only ever called from
 * an explicit user click (PLAN.md §3.6 rule 5).
 */
export async function streamRewrite(
  req: RewriteRequest,
  onEvent: (e: RewriteEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/rewrite', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) throw await failure(res);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const data = frame
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n');
      if (data) onEvent(RewriteEvent.parse(JSON.parse(data)));
    }
  }
}

export async function getStudioStatus(signal?: AbortSignal): Promise<StudioStatusResponse> {
  const res = await fetch('/api/studio/status', { signal });
  if (!res.ok) throw await failure(res);
  return StudioStatusResponse.parse(await res.json());
}

/**
 * PAID: POST /api/studio/refine. Only ever called while the person has switched on
 * "Refine with Claude" in Prompt Studio, which states the price.
 */
export async function refineStudio(
  req: StudioRefineRequest,
  signal: AbortSignal,
): Promise<StudioRefineResponse> {
  const res = await fetch('/api/studio/refine', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok) throw await failure(res);
  return StudioRefineResponse.parse(await res.json());
}
