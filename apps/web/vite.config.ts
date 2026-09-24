import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const apiPort = process.env.API_PORT ?? '8787';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Same-origin /api in dev, mirroring CloudFront routing in production (PLAN.md §3.3).
    proxy: { '/api': `http://127.0.0.1:${apiPort}` },
  },
  build: {
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
  },
});
