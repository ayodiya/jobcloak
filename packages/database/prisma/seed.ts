import { prisma } from '../src/client.js';

const SEED_EMAIL = 'alex.rivera@example.com';

/**
 * Development seed. All data is fictional. Idempotent: it seeds one candidate
 * only when no profile carries the seed marker email, and seeds the job/
 * match/material/application domain only when no jobs exist yet.
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
// Phase 4/5/6/8 seed: jobs, matches, materials and applications (fictional).
// ---------------------------------------------------------------------------

const DIMENSIONS = [
  { key: 'tech', weight: 30 },
  { key: 'experience', weight: 20 },
  { key: 'seniority', weight: 15 },
  { key: 'role', weight: 15 },
  { key: 'location', weight: 10 },
  { key: 'domain', weight: 5 },
  { key: 'salary', weight: 5 },
] as const;

const DIMENSION_DETAILS: Record<string, string> = {
  tech: 'Strong overlap with required skills',
  experience: 'Meets the required years of experience',
  seniority: 'Title aligns with the candidate seniority',
  role: 'Role fits the candidate profile',
  location: 'Remote-friendly location',
  domain: 'Domain overlaps with candidate background',
  salary: 'Salary within the expected range',
};

interface SeedJob {
  company: string;
  title: string;
  location: string | null;
  remote: boolean;
  url: string;
  salaryMin: number | null;
  salaryMax: number | null;
  status: 'Active' | 'Closed' | 'Unknown';
  scores: Record<string, number>;
  requirements: Array<{
    kind: 'Required' | 'Preferred' | 'NiceToHave';
    category: 'Skill' | 'Experience' | 'Education' | 'Certification' | 'Language' | 'Other';
    key: string;
    name: string;
    minYears?: number;
  }>;
  application?: 'verified' | 'in-progress' | 'failed';
}

const SEED_JOBS: SeedJob[] = [
  {
    company: 'Acme',
    title: 'Senior Backend Engineer',
    location: 'Berlin',
    remote: true,
    url: 'https://apply.example/jobs/acme',
    salaryMin: 95000,
    salaryMax: 125000,
    status: 'Active',
    scores: {
      tech: 0.9,
      experience: 0.85,
      seniority: 0.9,
      role: 0.95,
      location: 0.9,
      domain: 0.7,
      salary: 0.8,
    },
    requirements: [
      {
        kind: 'Required',
        category: 'Skill',
        key: 'typescript',
        name: 'TypeScript',
        minYears: 4,
      },
      {
        kind: 'Required',
        category: 'Skill',
        key: 'postgresql',
        name: 'PostgreSQL',
        minYears: 3,
      },
      { kind: 'Required', category: 'Experience', key: 'backend', name: 'Backend engineering' },
      { kind: 'Preferred', category: 'Skill', key: 'redis', name: 'Redis' },
      { kind: 'Preferred', category: 'Skill', key: 'kubernetes', name: 'Kubernetes' },
    ],
    application: 'verified',
  },
  {
    company: 'Globex',
    title: 'Staff Engineer',
    location: 'Berlin',
    remote: false,
    url: 'https://apply.example/jobs/globex',
    salaryMin: 110000,
    salaryMax: 140000,
    status: 'Active',
    scores: {
      tech: 0.8,
      experience: 0.8,
      seniority: 0.75,
      role: 0.8,
      location: 0.7,
      domain: 0.65,
      salary: 0.75,
    },
    requirements: [
      { kind: 'Required', category: 'Skill', key: 'typescript', name: 'TypeScript' },
      {
        kind: 'Required',
        category: 'Experience',
        key: 'backend',
        name: 'Backend engineering',
        minYears: 7,
      },
      { kind: 'Preferred', category: 'Skill', key: 'kubernetes', name: 'Kubernetes' },
    ],
    application: 'in-progress',
  },
  {
    company: 'Initech',
    title: 'Platform Engineer',
    location: 'Remote (EU)',
    remote: true,
    url: 'https://apply.example/jobs/initech',
    salaryMin: 80000,
    salaryMax: 105000,
    status: 'Active',
    scores: {
      tech: 0.75,
      experience: 0.7,
      seniority: 0.6,
      role: 0.65,
      location: 0.9,
      domain: 0.6,
      salary: 0.85,
    },
    requirements: [
      { kind: 'Required', category: 'Skill', key: 'kubernetes', name: 'Kubernetes' },
      {
        kind: 'Required',
        category: 'Experience',
        key: 'platform',
        name: 'Platform engineering',
      },
      { kind: 'Preferred', category: 'Skill', key: 'redis', name: 'Redis' },
    ],
  },
  {
    company: 'Umbrella',
    title: 'DevOps Engineer',
    location: 'Remote (EU)',
    remote: true,
    url: 'https://apply.example/jobs/umbrella',
    salaryMin: 75000,
    salaryMax: 95000,
    status: 'Active',
    scores: {
      tech: 0.7,
      experience: 0.6,
      seniority: 0.5,
      role: 0.6,
      location: 0.9,
      domain: 0.55,
      salary: 0.9,
    },
    requirements: [
      { kind: 'Required', category: 'Skill', key: 'kubernetes', name: 'Kubernetes' },
      { kind: 'Preferred', category: 'Skill', key: 'postgresql', name: 'PostgreSQL' },
    ],
    application: 'failed',
  },
  {
    company: 'Vandelay',
    title: 'Backend Engineer',
    location: 'Berlin',
    remote: false,
    url: 'https://apply.example/jobs/vandelay',
    salaryMin: null,
    salaryMax: null,
    status: 'Closed',
    scores: {
      tech: 0.65,
      experience: 0.6,
      seniority: 0.5,
      role: 0.7,
      location: 0.7,
      domain: 0.5,
      salary: 0.5,
    },
    requirements: [{ kind: 'Required', category: 'Skill', key: 'node.js', name: 'Node.js' }],
  },
];

async function seedDomain(): Promise<{ jobsSeeded: boolean }> {
  if ((await prisma.job.count()) > 0) return { jobsSeeded: false };
  const profile = await prisma.candidateProfile.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!profile) return { jobsSeeded: false };

  const now = new Date();
  const DAY = 86_400_000;
  const daysAgo = (n: number): Date => new Date(now.valueOf() - n * DAY);

  const jobIds: Record<string, string> = {};
  for (const [index, seedJob] of SEED_JOBS.entries()) {
    const job = await prisma.job.create({
      data: {
        sourceName: 'fixture',
        sourceKind: 'Fixture',
        fingerprint: `seed:${seedJob.company.toLowerCase()}`,
        url: seedJob.url,
        normalizedUrl: seedJob.url,
        title: seedJob.title,
        company: seedJob.company,
        location: seedJob.location,
        remote: seedJob.remote,
        description: `We are hiring a ${seedJob.title} to ${seedJob.remote ? ' work remotely across the EU' : ` join us in ${seedJob.location}`}.\n\nSkills: TypeScript, Node.js, PostgreSQL.`,
        salaryMin: seedJob.salaryMin,
        salaryMax: seedJob.salaryMax,
        salaryCurrency: 'EUR',
        postedAt: daysAgo(index * 2 + 4),
        status: seedJob.status,
      },
    });
    jobIds[seedJob.company] = job.id;

    await prisma.jobRequirement.createMany({
      data: seedJob.requirements.map((requirement) => ({
        jobId: job.id,
        kind: requirement.kind,
        category: requirement.category,
        key: requirement.key,
        name: requirement.name,
        ...(requirement.minYears !== undefined ? { minYears: requirement.minYears } : {}),
      })),
    });

    const match = await prisma.jobMatch.create({
      data: {
        jobId: job.id,
        jobTitle: seedJob.title,
        company: seedJob.company,
        totalScore: average(seedJob.scores),
        eligible: true,
        confidence: 0.9,
        createdAt: now,
        updatedAt: now,
      },
    });
    await prisma.jobMatchDimension.createMany({
      data: DIMENSIONS.map((dim) => ({
        matchId: match.id,
        key: dim.key,
        weight: dim.weight,
        score: seedJob.scores[dim.key] ?? 0.5,
        applicable: true,
        status:
          (seedJob.scores[dim.key] ?? 0.5) >= 0.8
            ? 'matched'
            : (seedJob.scores[dim.key] ?? 0.5) >= 0.5
              ? 'partial'
              : 'missing',
        detail: DIMENSION_DETAILS[dim.key] ?? null,
      })),
    });

    if (seedJob.application) {
      const application = await prisma.application.create({
        data: {
          profileId: profile.id,
          jobId: job.id,
          status: appStatus(seedJob.company),
          mode: 'review',
          sourceName: 'fixture',
          url: seedJob.url,
          submissionKey: `seed:${seedJob.company.toLowerCase()}`,
          submittedAt: seedJob.application === 'verified' ? daysAgo(2) : null,
          verifiedAt:
            seedJob.application === 'verified'
              ? new Date(daysAgo(2).valueOf() + 2 * 60_000)
              : null,
          createdAt: now,
          updatedAt: now,
          events: {
            create: appEvents(seedJob.application, now),
          },
        },
      });
      await prisma.auditLog.create({
        data: {
          action: 'application.created',
          entityType: 'application',
          entityId: application.id,
          metadata: { seed: true, jobId: job.id },
          createdAt: now,
        },
      });
    }
  }

  await prisma.sourceHealth.createMany({
    data: [
      {
        sourceName: 'fixture',
        healthy: true,
        consecutiveFailures: 0,
        lastCheckedAt: now,
        lastSuccessAt: now,
      },
      {
        sourceName: 'greenhouse',
        healthy: true,
        consecutiveFailures: 0,
        lastCheckedAt: now,
        lastSuccessAt: now,
      },
    ],
  });

  // Materials for the candidate (general CV + tailored CV for the Acme job).
  await prisma.applicationMaterial.create({
    data: {
      profileId: profile.id,
      kind: 'Cv',
      jobId: '',
      key: '',
      version: 1,
      status: 'Ready',
      versions: {
        create: {
          version: 1,
          content:
            'Alex Rivera — Senior Backend Engineer\nTypeScript · Node.js · PostgreSQL · Redis · Kubernetes',
          promptId: 'documents.cv',
          promptVersion: 1,
          aiModel: 'mock',
          createdAt: now,
        },
      },
    },
  });

  if (jobIds['Acme']) {
    await prisma.applicationMaterial.create({
      data: {
        profileId: profile.id,
        kind: 'Cv',
        jobId: jobIds['Acme'],
        key: '',
        version: 1,
        status: 'Ready',
        versions: {
          create: {
            version: 1,
            content:
              'Alex Rivera — Senior Backend Engineer\nTailored for Senior Backend Engineer at Acme.',
            promptId: 'documents.cv',
            promptVersion: 1,
            aiModel: 'mock',
            createdAt: now,
          },
        },
      },
    });
  }

  return { jobsSeeded: true };
}

function average(scores: Record<string, number>): number {
  const values = Object.values(scores);
  return (
    Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
  );
}

function appStatus(
  company: string,
): 'Prepared' | 'InProgress' | 'Submitted' | 'Verified' | 'Failed' | 'Cancelled' | 'Rejected' {
  switch (company) {
    case 'Acme':
      return 'Verified';
    case 'Globex':
      return 'InProgress';
    case 'Umbrella':
      return 'Failed';
    default:
      return 'Prepared';
  }
}

function appEvents(
  kind: 'verified' | 'in-progress' | 'failed',
  now: Date,
): Array<{
  type: string;
  stage: string | null;
  at: Date;
  payload?: Record<string, string | number | boolean | string[] | null>;
}> {
  const base: Array<{
    type: string;
    stage: string | null;
    at: Date;
    payload?: Record<string, string | number | boolean | string[] | null>;
  }> = [
    { type: 'application.preparing', stage: 'idle', at: now },
    { type: 'session.opened', stage: 'opening', at: add(now, 1000), payload: { seed: true } },
    { type: 'form.mapped', stage: 'mapping', at: add(now, 2000), payload: { count: 6 } },
    {
      type: 'form.filled',
      stage: 'filling',
      at: add(now, 3000),
      payload: { filled: 6, unresolved: 0 },
    },
  ];
  switch (kind) {
    case 'verified':
      return [
        ...base,
        {
          type: 'application.in_progress',
          stage: 'filling',
          at: add(now, 4000),
          payload: { from: 'Prepared' },
        },
        {
          type: 'application.submitted',
          stage: 'submitted',
          at: add(now, 8000),
          payload: { from: 'InProgress' },
        },
        {
          type: 'application.verified',
          stage: 'submitted',
          at: add(now, 9000),
          payload: { from: 'Submitted' },
        },
      ];
    case 'in-progress':
      return [
        ...base,
        {
          type: 'application.in_progress',
          stage: 'filling',
          at: add(now, 4000),
          payload: { from: 'Prepared' },
        },
      ];
    case 'failed':
      return [
        ...base,
        {
          type: 'gate.detected',
          stage: 'waiting-approval',
          at: add(now, 4000),
          payload: { count: 1, kinds: ['captcha'] },
        },
        {
          type: 'submission.blocked',
          stage: 'waiting-approval',
          at: add(now, 4500),
          payload: { reason: 'security gate', kinds: ['captcha'] },
        },
        {
          type: 'application.failed',
          stage: 'waiting-approval',
          at: add(now, 5000),
          payload: { from: 'InProgress' },
        },
      ];
  }
}

function add(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

async function main(): Promise<void> {
  const seeded = await seedCandidate();
  const { jobsSeeded } = await seedDomain();

  await prisma.auditLog.create({
    data: {
      action: 'seed.run',
      entityType: 'system',
      metadata: {
        candidateSeeded: seeded,
        jobsSeeded,
        note: 'development seed (fictional data only)',
      },
    },
  });

  console.log(
    seeded ? 'Seeded fictional candidate Alex Rivera.' : 'Candidate already seeded; skipped.',
  );
  console.log(
    jobsSeeded
      ? 'Seeded fictional jobs, matches, materials and applications.'
      : 'Jobs domain already seeded; skipped.',
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
