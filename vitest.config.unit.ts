import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    include: ['packages/**/src/**/*.test.ts', 'apps/api/test/**/*.test.ts', 'apps/worker/test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.ts'],
    environment: 'node',
    pool: 'threads',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/dist/**', '**/node_modules/**', '**/*.test.ts', '**/prisma/**'],
    },
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