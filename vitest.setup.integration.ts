import { spawnSync } from 'node:child_process';

/**
 * Integration test bootstrap:
 * 1. Load environment from `.env.test` / `.env.test.example` / `.env` if present
 *    (first file to define a key wins — Node's loadEnvFile never overrides, and
 *    pre-existing process.env from CI always takes precedence).
 * 2. Apply migrations via Prisma migrate deploy against DATABASE_URL.
 *
 * Integration tests must never touch the development database, so the test
 * environment files are loaded before `.env`.
 */
for (const file of ['.env.test', '.env.test.example', '.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // file absent — CI provides env directly
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for integration tests');
}

const migrate = spawnSync(
  'npx',
  ['prisma', 'migrate', 'deploy', '--schema', 'packages/database/prisma/schema.prisma'],
  { stdio: 'inherit', shell: false, encoding: 'utf-8' },
);
if (migrate.status !== 0) {
  throw new Error(
    `Integration test DB migrations failed (status ${migrate.status}). ` +
      `Is PostgreSQL running? Try 'docker compose up -d postgres'.`,
  );
}

export {};