import type { ApiError } from '@promptgenius/api-contract';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { z } from 'zod';

export function jsonError(
  c: Context,
  status: ContentfulStatusCode,
  error: string,
  message?: string,
  retryAfterSec?: number,
) {
  if (retryAfterSec) c.header('Retry-After', String(retryAfterSec));
  return c.json({ error, message, retryAfterSec } satisfies ApiError, status);
}

/** Parses and validates a JSON body; never echoes the input back in errors. */
export async function parseJson<T extends z.ZodType>(
  c: Context,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return { ok: false, response: jsonError(c, 400, 'invalid_json', 'Body must be JSON.') };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.') || '(body)').join(', ');
    return {
      ok: false,
      response: jsonError(c, 400, 'invalid_request', `Invalid fields: ${fields}`),
    };
  }
  return { ok: true, data: parsed.data };
}

/** Rate-limit key. Locally everything is loopback; in AWS, WAF enforces per-IP limits. */
export function clientKey(c: Context): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}
