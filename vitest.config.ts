import { defineConfig } from 'vitest/config';

// Each workspace package is its own Vitest project (web uses jsdom, the rest use node).
export default defineConfig({
  test: {
    projects: ['apps/*', 'packages/*', 'services/*'],
  },
});
