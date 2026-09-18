import { PrismaClient } from '@prisma/client';

/**
 * Singleton PrismaClient shared by API and workers.
 * Prisma warns when many instances exist; this package is the single owner.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function createPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return globalForPrisma.prisma;
}

/** Drop-in default export for convenience. */
export const prisma = createPrismaClient();

export * from '@prisma/client';