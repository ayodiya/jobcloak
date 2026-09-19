import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.FIXTURE_PORT ?? 8787);

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node tests/server.mjs',
    url: `http://127.0.0.1:${PORT}/health`,
    reuseExistingServer: true,
    timeout: 20_000,
  },
});
