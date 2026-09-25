import type { HealthResponse } from '@promptgenius/api-contract';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import type { AppDeps } from './deps';
import { countRoutes } from './routes/count';
import { rewriteRoutes } from './routes/rewrite';
import { jsonError } from './routes/util';

export const API_VERSION = '0.1.0';

/** Runtime-agnostic app: served by Node locally (server.ts) and by Lambda in Phase 3. */
export function createApp(deps: AppDeps) {
  const app = new Hono().basePath('/api');

  app.use(secureHeaders());
  app.use(
    bodyLimit({
      maxSize: 512 * 1024,
      onError: (c) => jsonError(c, 413, 'payload_too_large', 'Request body is too large.'),
    }),
  );

  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      version: API_VERSION,
      features: {
        countClaude: !!deps.counters.claude,
        countGemini: !!deps.counters.gemini,
        rewrite: !!deps.rewriter,
      },
    } satisfies HealthResponse),
  );
  app.route('/', countRoutes(deps));
  app.route('/', rewriteRoutes(deps));

  // Never leak internals (stack traces, upstream errors) to the client.
  app.onError((err, c) => {
    console.error(err);
    return jsonError(c, 500, 'internal_error');
  });
  app.notFound((c) => jsonError(c, 404, 'not_found'));

  return app;
}
