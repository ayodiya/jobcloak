import { prisma } from '../src/client.js';

const SEED_EMAIL = 'alex.rivera@example.com';

/**
 * Development seed. It creates one candidate profile (a working stand-in
 * profile for matching; edit it in the candidate page with your real data).
 * Job listings, matches, materials and applications are NOT seeded — they
 * arrive from live board discovery and deterministic matching. Any fictional
 * `fixture`-source rows left behind by older seed versions are purged so the
 * match page shows only real data. Idempotent.
 */
async function seedCandidate(): Promise<boolean> {
  const existing = await prisma.candidateProfile.findFirst({
    where: { emails: { path: ['0'], equals: SEED_EMAIL } },
    select: { id: true },
  });
  if (existing) return false;

  const profile = await prisma.candidateProfile.create({
    data: {
      firstName: 'Alex',
      lastName: 'Rivera',
      title: 'Senior Backend Engineer',
      emails: [SEED_EMAIL],
      phones: ['+49 170 0000000'],
      city: 'Berlin',
      country: 'Germany',
      languages: ['English (C1)', 'German (B1)'],
      workAuthorization: 'EU Blue Card',
      remotePreferred: true,
      relocationWilling: false,
      preferredLocations: ['Berlin', 'Remote (EU)'],
      targetRoles: ['Senior Backend Engineer', 'Staff Engineer'],
      expectedSalaryMin: 90000,
      expectedSalaryMax: 115000,
      currency: 'EUR',
      skills: {
        create: [
          {
            name: 'TypeScript',
            key: 'typescript',
            category: 'Language',
            level: 'Expert',
            years: 8,
            lastUsedYear: 2026,
          },
          {
            name: 'Node.js',
            key: 'node.js',
            category: 'Runtime',
            level: 'Expert',
            years: 8,
            lastUsedYear: 2026,
          },
          {
            name: 'PostgreSQL',
            key: 'postgresql',
            category: 'Database',
            level: 'Advanced',
            years: 7,
            lastUsedYear: 2026,
          },
          {
            name: 'Redis',
            key: 'redis',
            category: 'Database',
            level: 'Advanced',
            years: 5,
            lastUsedYear: 2025,
          },
          {
            name: 'Kubernetes',
            key: 'kubernetes',
            category: 'Platform',
            level: 'Intermediate',
            years: 3,
            lastUsedYear: 2025,
          },
        ],
      },
    },
  });

  const latencyEvidence = await prisma.evidenceRecord.create({
    data: {
      profileId: profile.id,
      source: 'UserProvided',
      summary: 'p99 latency reduction on checkout API',
      rawText:
        'Grafana dashboard (Jan 2025): checkout p99 fell from 120ms to 72ms after the async ' +
        'persistence change. Dashboard link and query export attached in the private notes.',
      claims: ['Reduced checkout API p99 latency by 40%'],
    },
  });

  const mentoringEvidence = await prisma.evidenceRecord.create({
    data: {
      profileId: profile.id,
      source: 'CVImport',
      summary: 'Mentoring program participation',
      rawText:
        'Acme GmbH performance review 2024: "Alex mentored four mid-level engineers; three were ' +
        'promoted within 18 months."',
      claims: ['Mentored four engineers, three promoted within 18 months'],
    },
  });

  await prisma.experienceEntry.create({
    data: {
      profileId: profile.id,
      organization: 'Acme GmbH',
      title: 'Senior Backend Engineer',
      startDate: new Date('2020-03-01'),
      current: true,
      location: 'Berlin',
      remote: true,
      summary: 'Owns the checkout and payments backend for a B2C marketplace.',
      technologies: ['TypeScript', 'Node.js', 'PostgreSQL', 'Redis', 'Kubernetes'],
      responsibilities: [
        'Design and operate event-driven payment services handling 4M requests/day',
        'Set and review the backend on-call and incident-response practices',
      ],
      achievements: [
        'Reduced checkout API p99 latency by 40%',
        'Mentored four engineers, three promoted within 18 months',
      ],
      evidenceId: latencyEvidence.id,
      sortOrder: 0,
    },
  });

  await prisma.projectEntry.create({
    data: {
      profileId: profile.id,
      name: 'Ledger reconciliation service',
      role: 'Tech lead',
      description:
        'Built a reconciliation pipeline that closes the daily ledger within 15 minutes.',
      technologies: ['TypeScript', 'PostgreSQL', 'Redis'],
      achievements: ['Cut daily reconciliation window from 6 hours to 15 minutes'],
      startDate: new Date('2023-01-01'),
      endDate: new Date('2023-09-30'),
      evidenceId: mentoringEvidence.id,
      sortOrder: 0,
    },
  });

  await prisma.educationEntry.create({
    data: {
      profileId: profile.id,
      institution: 'Technische Universität Berlin',
      degree: 'M.Sc.',
      field: 'Computer Science',
      startDate: new Date('2012-10-01'),
      endDate: new Date('2015-09-30'),
      gpa: '1.7',
      sortOrder: 0,
    },
  });

  await prisma.certificationEntry.create({
    data: {
      profileId: profile.id,
      name: 'AWS Certified Solutions Architect – Associate',
      issuer: 'Amazon Web Services',
      issueDate: new Date('2021-06-01'),
      expiryDate: new Date('2027-06-01'),
      verificationStatus: 'unverified',
      sortOrder: 0,
    },
  });

  await prisma.achievementEntry.create({
    data: {
      profileId: profile.id,
      title: 'Speaker at NodeConf EU',
      category: 'Speaking',
      date: new Date('2024-11-05'),
      description: 'Talk on operating event-driven payment systems under backpressure.',
      evidenceId: mentoringEvidence.id,
      sortOrder: 0,
    },
  });

  await prisma.cvImport.create({
    data: {
      profileId: profile.id,
      rawText:
        'Alex Rivera — Senior Backend Engineer\n\nSkills\nTypeScript, Node.js, PostgreSQL',
      status: 'Imported',
      sourceNote: 'Seed placeholder; replace with a real CV import.',
      parseSummary: {
        sectionCount: 2,
        skillKeywordCount: 3,
        contactEmails: [SEED_EMAIL],
        contactPhones: [],
        headings: ['Skills'],
      },
    },
  });

  return true;
}

// ---------------------------------------------------------------------------
// Domain data arrives from board discovery + matching, never from the seed.
// Older seed versions created fictional `fixture` jobs/matches/applications;
// those rows are removed (cascading) so UIs show only real listings.
// ---------------------------------------------------------------------------

async function purgeFixtureData(): Promise<{ deleted: number }> {
  const result = await prisma.job.deleteMany({ where: { sourceName: 'fixture' } });
  await prisma.sourceHealth.deleteMany({
    where: { sourceName: { in: ['fixture', 'greenhouse'] } },
  });
  return { deleted: result.count };
}

async function main(): Promise<void> {
  const seeded = await seedCandidate();
  const { deleted } = await purgeFixtureData();

  await prisma.auditLog.create({
    data: {
      action: 'seed.run',
      entityType: 'system',
      metadata: {
        candidateSeeded: seeded,
        fixtureJobsRemoved: deleted,
        note: 'development seed — candidate only; jobs/matches come from discovery & matching',
      },
    },
  });

  console.log(
    seeded ? 'Seeded working candidate profile.' : 'Candidate already present; skipped.',
  );
  console.log(
    deleted > 0
      ? `Removed ${deleted} fictional fixture jobs (and their matches/applications).`
      : 'No fictional fixture data to remove.',
  );
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
