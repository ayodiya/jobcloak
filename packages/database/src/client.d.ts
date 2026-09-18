import { PrismaClient } from '@prisma/client';
export declare function createPrismaClient(): PrismaClient;
/** Drop-in default export for convenience. */
export declare const prisma: PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
export * from '@prisma/client';
