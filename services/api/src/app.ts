import type { HealthResponse } from '@promptgenius/api-contract';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';

export const API_VERSION = '0.0.0';

/** Runtime-agnostic app: served by Node locally (server.ts) and by Lambda later. */
export function createApp() {
  const app = new Hono().basePath('/api');

  app.use(secureHeaders());
  app.use(bodyLimit({ maxSize: 256 * 1024 }));

  app.get('/health', (c) =>
    c.json({ status: 'ok', version: API_VERSION } satisfies HealthResponse),
  );

  // Never leak internals (stack traces, upstream errors) to the client.
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'internal_error' }, 500);
  });
  app.notFound((c) => c.json({ error: 'not_found' }, 404));

  return app;
}
