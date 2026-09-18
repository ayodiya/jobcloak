import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from './src/client.js';

/**
 * Real-PostgreSQL round trip: proves the applied migrations (AuditLog table)
 * and the shared Prisma client against the integration test database.
 */
describe('database (integration)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('writes and reads an audit log row', async () => {
    const marker = `integration-${Date.now()}`;

    await prisma.auditLog.create({
      data: {
        action: 'integration.test',
        entityType: 'system',
        metadata: { marker },
      },
    });

    const rows = await prisma.auditLog.findMany({
      where: { metadata: { path: ['marker'], equals: marker } },
      take: 1,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]!.action).toBe('integration.test');
  });
});