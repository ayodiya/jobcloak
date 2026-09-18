import { spawnSync } from 'node:child_process';

/**
 * Integration test bootstrap:
 * 1. Load environment from `.env` / `.env.test` / `.env.test.example` if present.
 * 2. Apply migrations via Prisma migrate deploy against DATABASE_URL.
 *
 * CI provides DATABASE_URL via workflow env and runs `db:migrate` in the job;
 * this bootstrap makes local runs deterministic too.
 */
for (const file of ['.env', '.env.test', '.env.test.example']) {
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