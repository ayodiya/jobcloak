import type { Env } from '@jobs-app/config';
import type { PrismaClient } from '@jobs-app/database';

/**
 * Shared dependencies for dashboard routes. `db` resolves lazily so that
 * non-database routes (health) never instantiate a Prisma client in tests.
 */
export interface RouteContext {
  db: () => Promise<PrismaClient>;
  config: Pick<Env, 'NODE_ENV' | 'API_HOST' | 'API_PORT' | 'WEB_ORIGIN'>;
}