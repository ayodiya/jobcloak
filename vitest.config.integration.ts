import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    include: [
      'packages/*/integration.test.ts',
      'packages/**/src/**/*.integration.test.ts',
      'apps/**/test/**/*.integration.test.ts',
    ],
    environment: 'node',
    pool: 'threads',
    testTimeout: 30000,
    hookTimeout: 60000,
    setupFiles: ['./vitest.setup.integration.ts'],
  },
  resolve: {
    alias: {
      '@jobs-app/config': fileURLToPath(new URL('./packages/config/src/index.ts', import.meta.url)),
      '@jobs-app/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)),
      '@jobs-app/database': fileURLToPath(new URL('./packages/database/src/index.ts', import.meta.url)),
      '@jobs-app/ai': fileURLToPath(new URL('./packages/ai/src/index.ts', import.meta.url)),
      '@jobs-app/ai/testing': fileURLToPath(new URL('./packages/ai/src/testing/index.ts', import.meta.url)),
      '@jobs-app/jobs': fileURLToPath(new URL('./packages/jobs/src/index.ts', import.meta.url)),
      '@jobs-app/matching': fileURLToPath(new URL('./packages/matching/src/index.ts', import.meta.url)),
      '@jobs-app/candidate': fileURLToPath(new URL('./packages/candidate/src/index.ts', import.meta.url)),
      '@jobs-app/documents': fileURLToPath(new URL('./packages/documents/src/index.ts', import.meta.url)),
      '@jobs-app/browser': fileURLToPath(new URL('./packages/browser/src/index.ts', import.meta.url)),
      '@jobs-app/applications': fileURLToPath(new URL('./packages/applications/src/index.ts', import.meta.url)),
      '@jobs-app/notifications': fileURLToPath(new URL('./packages/notifications/src/index.ts', import.meta.url)),
    },
  },
});