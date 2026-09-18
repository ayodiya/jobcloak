import { prisma } from '../src/client.js';

async function main(): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: 'seed.run',
      entityType: 'system',
      metadata: { note: 'development seed marker (fictional data only)' },
    },
  });
  console.log('Seed complete. This release contains no fictional seed domain data yet.');
  console.log('Candidate, jobs, matches and application seeds arrive with their phases.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });