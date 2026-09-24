import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadLocalEnv } from './env';

const env = loadLocalEnv();

// Bind to loopback only: the local API is reachable from this machine, not the network.
serve({ fetch: createApp().fetch, hostname: '127.0.0.1', port: env.API_PORT }, (info) => {
  console.log(`API listening on http://127.0.0.1:${info.port}/api`);
});
