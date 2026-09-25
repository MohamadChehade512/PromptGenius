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
  // The file readers are imported only when a file is attached; pre-bundle them so the dev
  // server doesn't re-optimize (and break the in-flight import) on first use.
  optimizeDeps: { include: ['pdfjs-dist', 'mammoth'] },
  build: {
    sourcemap: false,
    // The o200k tokenizer (~2 MB) is its own lazily-loaded chunk, fetched only when the
    // ChatGPT platform is used; the app entry stays small.
    chunkSizeWarningLimit: 2_100,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
