import { prisma } from '../src/client.js';

const SEED_EMAIL = 'devayodiya@gmail.com';

const RESUME_RAW_TEXT = `Ayodeji Oludiya
Lagos, Nigeria | devayodiya@gmail.com | +234 810 680 1274 | linkedin.com/in/ayodiyah | ayodejioludiya.name.ng

SUMMARY
Software Engineer and Tech Team Lead with 4+ years building scalable web applications, SaaS platforms,
and e-commerce solutions using TypeScript, React, Next.js, Node.js, and cloud infrastructure.
Track record of improving application performance by 70% through backend optimization and caching,
driving 10% revenue growth via e-commerce platform redesign, and leading cross-functional engineering
teams to deliver secure, production-grade fintech and SaaS systems.

EXPERIENCE
Innovate One Company (Lagos, Nigeria) — Software Engineer (Tech Team Lead), January 2022 - Present
- Led architecture and end-to-end delivery of enterprise web applications including OneCultur, Fix234,
  and Nadisaa Meats and Poultry, using React, Next.js, Node.js, Express.js, and MongoDB.
- Oversaw and implemented the migration of the ICashRemit codebase from Lumen to Laravel, and upgraded
  its user interface to the latest version of Angular.
- Improved application performance by 70% by implementing Redis caching and optimizing backend services.
- Increased Shopify store revenue by 10% through a full e-commerce redesign for Hertunba.
- Designed and integrated secure payment, authentication, and subscription systems supporting fintech
  and SaaS products.
- Led and mentored a team of engineers, conducting architecture reviews and code reviews to uphold
  clean architecture and coding standards.
- Collaborated with product and design stakeholders in Agile sprints to translate business requirements
  into scalable technical solutions.

ZuriChat (Remote) — Frontend Software Engineer, August 2021 - December 2021
- Built and shipped production-grade React applications and reusable component libraries used across
  multiple product teams.
- Developed a blog platform feature, improving content publishing workflows for end users.
- Diagnosed and resolved production issues to maintain application stability and uptime.

Epower (Nigeria) — Frontend Developer, November 2020 - April 2021
- Built recruitment platform features and integrated REST APIs to support core hiring workflows.
- Converted Figma and Adobe XD designs into responsive, pixel-accurate frontend implementations.
- Implemented the admin dashboard for Grant Master using the Figma designs.

PROJECT
- Nadisaa Meats & Poultry — order.nadisaameatsandpoultry.com — End-to-end e-commerce platform covering
  catalog, checkout, and order management; invoice checkout with auto-send via WhatsApp, SMS and email;
  real-time payment status via provider webhooks.
- Hertunba — hertunba.com — Shopify store redesign that increased revenue by 10%; custom size features,
  announcement bar, popup, and order email automation.
- Icashremit — icashremit.com — Migrated codebase from Lumen to Laravel; upgraded UI to latest Angular;
  batched transaction processing; new queue system; account verification before sending; daily exchange
  rate feature for IMTOs.
- Fix234 — fix234.com — Rebuilt frontend with Next.js and Material UI; added Blog feature with auto
  sitemap indexing; corporate entity onboard flow from website to dashboard.
- OneCultur — onecultur.com — Full-stack platform with React, Express, and MongoDB; subscriber email
  feature; modern image gallery for managed farms.
- LidStores — Voucher system, subscription system, and hero section driven by the admin dashboard.

EDUCATION
B.Sc. Mass Communication — Bowen University (Awaiting Convocation, 2026)
Postgraduate Diploma — Chartered Institute of Customer Relationship Management (2017)
B.A. English Language — Obafemi Awolowo University (2014)

CERTIFICATIONS
AI Engineer Bootcamp (2025), Product Management (2024), Google Project Management (2024),
ALX Software Engineering (2022), FreeCodeCamp Full Stack (2020)

SKILLS
Backend: Node.js, Express.js, Laravel, Lumen, REST APIs, JWT, OAuth, Socket.IO, BullMQ, Redis, Microservices
Cloud & DevOps: Docker, Linux, Nginx, DigitalOcean, CI/CD, GitHub Actions
Databases: MongoDB, PostgreSQL, MySQL, Redis
Frontend: React, Next.js, Angular, Redux Toolkit, React Query, RTK Query, Zustand, MUI, Tailwind CSS
Languages: TypeScript, JavaScript, Python, PHP
Leadership: Agile, Mentoring, Team Leadership, System Design, Clean Architecture`;

/**
 * Development seed. It creates the candidate profile from the real resume
 * (`ayodeji_software_engineer.pdf`) — the single factual source that matching and
 * application material generation are built on. Job listings, matches, materials
 * and applications are NOT seeded — they arrive from live board discovery and
 * deterministic matching. Any fictional `fixture`-source rows left behind by old
 * seed versions are purged so the match page shows only real data. Idempotent.
 */
async function seedCandidate(): Promise<boolean> {
  const existing = await prisma.candidateProfile.findFirst({
    where: { emails: { path: ['0'], equals: SEED_EMAIL } },
    select: { id: true },
  });
  if (existing) return false;

  await prisma.candidateProfile.deleteMany({});

  const profile = await prisma.candidateProfile.create({
    data: {
      firstName: 'Ayodeji',
      lastName: 'Oludiya',
      title: 'Software Engineer',
      emails: [SEED_EMAIL],
      phones: ['+234 810 680 1274'],
      city: 'Lagos',
      country: 'Nigeria',
      languages: ['English'],
      remotePreferred: true,
      preferredLocations: ['Remote', 'Lagos'],
      targetRoles: [
        'Software Engineer',
        'Full Stack Developer',
        'Senior Software Engineer',
        'Tech Lead',
        'Frontend Engineer',
      ],
      skills: {
        create: [
          seedSkill('TypeScript', 'Language', 'Advanced', 4, 2026),
          seedSkill('JavaScript', 'Language', 'Advanced', 4, 2026),
          seedSkill('Python', 'Language', 'Intermediate', 1, 2025),
          seedSkill('PHP', 'Language', 'Intermediate', 1, 2025),
          seedSkill('Node.js', 'Runtime', 'Advanced', 4, 2026),
          seedSkill('Express.js', 'Framework', 'Advanced', 4, 2026),
          seedSkill('Laravel', 'Framework', 'Advanced', 1, 2025),
          seedSkill('Lumen', 'Framework', 'Intermediate', 1, 2025),
          seedSkill('Angular', 'Framework', 'Advanced', 1, 2025),
          seedSkill('Next.js', 'Framework', 'Advanced', 3, 2026),
          seedSkill('React', 'Framework', 'Expert', 4, 2026),
          seedSkill('Redux Toolkit', 'Library', 'Advanced', 3, 2026),
          seedSkill('React Query', 'Library', 'Advanced', 3, 2026),
          seedSkill('RTK Query', 'Library', 'Advanced', 2, 2026),
          seedSkill('Zustand', 'Library', 'Intermediate', 1, 2025),
          seedSkill('MUI', 'Library', 'Advanced', 3, 2026),
          seedSkill('Tailwind CSS', 'Styling', 'Advanced', 2, 2026),
          seedSkill('MongoDB', 'Database', 'Advanced', 4, 2026),
          seedSkill('PostgreSQL', 'Database', 'Advanced', 2, 2026),
          seedSkill('MySQL', 'Database', 'Intermediate', 1, 2025),
          seedSkill('Redis', 'Database', 'Advanced', 2, 2026),
          seedSkill('REST APIs', 'Backend', 'Advanced', 4, 2026),
          seedSkill('JWT', 'Security', 'Advanced', 3, 2026),
          seedSkill('OAuth', 'Security', 'Intermediate', 2, 2025),
          seedSkill('Socket.IO', 'Backend', 'Intermediate', 2, 2026),
          seedSkill('BullMQ', 'Backend', 'Advanced', 2, 2026),
          seedSkill('Microservices', 'Architecture', 'Intermediate', 2, 2025),
          seedSkill('Docker', 'DevOps', 'Advanced', 2, 2026),
          seedSkill('Linux', 'DevOps', 'Advanced', 3, 2026),
          seedSkill('Nginx', 'DevOps', 'Intermediate', 2, 2025),
          seedSkill('DigitalOcean', 'Cloud', 'Advanced', 3, 2026),
          seedSkill('CI/CD', 'DevOps', 'Advanced', 3, 2026),
          seedSkill('GitHub Actions', 'DevOps', 'Advanced', 3, 2026),
          seedSkill('Agile', 'Leadership', 'Advanced', 4, 2026),
          seedSkill('Mentoring', 'Leadership', 'Advanced', 4, 2026),
          seedSkill('Team Leadership', 'Leadership', 'Advanced', 4, 2026),
          seedSkill('System Design', 'Architecture', 'Advanced', 3, 2026),
          seedSkill('Clean Architecture', 'Architecture', 'Advanced', 3, 2026),
        ],
      },
    },
  });

  const performanceEvidence = await prisma.evidenceRecord.create({
    data: {
      profileId: profile.id,
      source: 'CVImport',
      summary: 'Application performance improved by 70%',
      rawText:
        'Resume bullet (Innovate One Company): "Improved application performance by 70% by ' +
        'implementing Redis caching and optimizing backend services."',
      claims: [
        'Improved application performance by 70% through Redis caching and backend optimization',
      ],
    },
  });

  const revenueEvidence = await prisma.evidenceRecord.create({
    data: {
      profileId: profile.id,
      source: 'CVImport',
      summary: 'Shopify revenue increased by 10%',
      rawText:
        'Resume bullet (Innovate One Company): "Increased Shopify store revenue by 10% through a full ' +
        'e-commerce redesign for Hertunba."',
      claims: ['Increased Shopify store revenue by 10% through an e-commerce redesign'],
    },
  });

  const leadershipEvidence = await prisma.evidenceRecord.create({
    data: {
      profileId: profile.id,
      source: 'CVImport',
      summary: 'Led and mentored an engineering team',
      rawText:
        'Resume bullet (Innovate One Company): "Led and mentored a team of engineers, conducting ' +
        'architecture reviews and code reviews to uphold clean architecture and coding standards."',
      claims: ['Led and mentored a team of engineers, running architecture and code reviews'],
    },
  });

  await prisma.experienceEntry.create({
    data: {
      profileId: profile.id,
      organization: 'Innovate One Company',
      title: 'Software Engineer (Tech Team Lead)',
      startDate: new Date('2022-01-01'),
      current: true,
      location: 'Lagos, Nigeria',
      remote: false,
      summary:
        'Leads architecture and end-to-end delivery of enterprise web applications — OneCultur, Fix234, ' +
        'and Nadisaa Meats and Poultry.',
      technologies: [
        'React',
        'Next.js',
        'Node.js',
        'Express.js',
        'MongoDB',
        'Redis',
        'Laravel',
        'Lumen',
        'Angular',
        'Shopify',
      ],
      responsibilities: [
        'Lead architecture and end-to-end delivery of enterprise web applications',
        'Migrate the ICashRemit codebase from Lumen to Laravel and upgrade its UI to the latest Angular',
        'Improve application performance through Redis caching and backend optimization',
        'Design and integrate secure payment, authentication, and subscription systems',
        'Lead and mentor a team of engineers via architecture and code reviews',
        'Collaborate with product and design stakeholders in Agile sprints',
      ],
      achievements: [
        'Improved application performance by 70%',
        'Increased Shopify store revenue by 10%',
        'Led and mentored a team of engineers',
      ],
      evidenceId: performanceEvidence.id,
      sortOrder: 0,
    },
  });

  await prisma.experienceEntry.create({
    data: {
      profileId: profile.id,
      organization: 'ZuriChat',
      title: 'Frontend Software Engineer',
      startDate: new Date('2021-08-01'),
      endDate: new Date('2021-12-31'),
      current: false,
      location: 'Remote',
      remote: true,
      summary:
        'Shipped production-grade React applications and reusable component libraries used across multiple product teams.',
      technologies: ['React', 'TypeScript', 'JavaScript'],
      responsibilities: [
        'Build and ship production-grade React applications and reusable component libraries',
        'Develop a blog platform feature improving content publishing workflows',
        'Diagnose and resolve production issues to maintain stability and uptime',
      ],
      achievements: ['Shipped reusable component libraries used across multiple product teams'],
      evidenceId: leadershipEvidence.id,
      sortOrder: 1,
    },
  });

  await prisma.experienceEntry.create({
    data: {
      profileId: profile.id,
      organization: 'Epower',
      title: 'Frontend Developer',
      startDate: new Date('2020-11-01'),
      endDate: new Date('2021-04-30'),
      current: false,
      location: 'Nigeria',
      remote: false,
      summary:
        'Built recruitment platform features and integrated REST APIs supporting core hiring workflows.',
      technologies: ['React', 'TypeScript', 'REST APIs'],
      responsibilities: [
        'Build recruitment platform features and integrate REST APIs',
        'Convert Figma and Adobe XD designs into responsive, pixel-accurate frontend implementations',
        'Implement the Grant Master admin dashboard from Figma designs',
      ],
      achievements: ['Shipped the Grant Master admin dashboard from Figma designs'],
      sortOrder: 2,
    },
  });

  await prisma.projectEntry.create({
    data: {
      profileId: profile.id,
      name: 'Nadisaa Meats & Poultry',
      role: 'Full-stack engineer',
      description:
        'End-to-end e-commerce platform covering catalog, checkout, and order management; invoice checkout ' +
        'with auto-send via WhatsApp, SMS and email; real-time payment status via provider webhooks.',
      technologies: ['Next.js', 'Node.js', 'MongoDB'],
      url: 'order.nadisaameatsandpoultry.com',
      startDate: new Date('2025-11-01'),
      current: true,
      achievements: [
        'Invoice checkout with auto-send via WhatsApp, SMS and email',
        'Real-time payment status via webhooks',
      ],
      evidenceId: performanceEvidence.id,
      sortOrder: 0,
    },
  });

  await prisma.projectEntry.create({
    data: {
      profileId: profile.id,
      name: 'Hertunba',
      role: 'Frontend engineer',
      description:
        'Shopify store redesign that increased revenue by 10%; custom size features, announcement bar, popup, ' +
        'and order email automation.',
      technologies: ['Shopify', 'Liquid'],
      url: 'hertunba.com',
      startDate: new Date('2023-12-01'),
      current: true,
      achievements: [
        'Increased Shopify store revenue by 10% through UX and conversion optimization',
      ],
      evidenceId: revenueEvidence.id,
      sortOrder: 1,
    },
  });

  await prisma.projectEntry.create({
    data: {
      profileId: profile.id,
      name: 'Icashremit',
      role: 'Full-stack engineer',
      description:
        'Migrated the codebase from Lumen to Laravel; upgraded the UI to the latest Angular; batched ' +
        'transaction processing; new queue system; account verification; daily exchange rate feature for IMTOs.',
      technologies: ['Laravel', 'Angular'],
      url: 'icashremit.com',
      startDate: new Date('2023-12-01'),
      current: true,
      achievements: [
        'Migrated codebase from Lumen to Laravel',
        'Increased transactions per batch from one to many',
        'Added account verification before sending transactions',
      ],
      evidenceId: leadershipEvidence.id,
      sortOrder: 2,
    },
  });

  await prisma.projectEntry.create({
    data: {
      profileId: profile.id,
      name: 'Fix234',
      role: 'Frontend engineer',
      description:
        'Rebuilt the frontend with Next.js and Material UI; added a Blog feature with auto sitemap indexing; ' +
        'corporate entity onboard flow from website to dashboard.',
      technologies: ['Next.js', 'Material UI'],
      url: 'fix234.com',
      startDate: new Date('2023-05-01'),
      current: true,
      achievements: [
        'Rebuilt frontend with Next.js and Material UI',
        'Added Blog with auto sitemap indexing',
      ],
      evidenceId: revenueEvidence.id,
      sortOrder: 3,
    },
  });

  await prisma.projectEntry.create({
    data: {
      profileId: profile.id,
      name: 'OneCultur',
      role: 'Full-stack engineer',
      description:
        'Full-stack platform supporting core product features end to end, including subscriber emails and a ' +
        'modern image gallery for managed farms.',
      technologies: ['React', 'Express.js', 'MongoDB'],
      url: 'onecultur.com',
      startDate: new Date('2022-12-01'),
      current: true,
      achievements: [
        'Shipped subscriber email feature',
        'Built modern image gallery for managed farms',
      ],
      evidenceId: performanceEvidence.id,
      sortOrder: 4,
    },
  });

  await prisma.projectEntry.create({
    data: {
      profileId: profile.id,
      name: 'LidStores',
      role: 'Software engineer',
      description:
        'E-commerce website improvements: voucher system, subscription system, and hero section driven by the ' +
        'admin dashboard.',
      technologies: ['Node.js', 'React', 'MongoDB'],
      startDate: new Date('2022-01-01'),
      endDate: new Date('2023-12-31'),
      current: false,
      achievements: [
        'Added voucher and subscription systems',
        'Moved hero section content into the admin dashboard',
      ],
      sortOrder: 5,
    },
  });

  await prisma.educationEntry.create({
    data: {
      profileId: profile.id,
      institution: 'Bowen University',
      degree: 'B.Sc.',
      field: 'Mass Communication',
      endDate: new Date('2026-06-30'),
      notes: 'Awaiting convocation',
      sortOrder: 0,
    },
  });

  await prisma.educationEntry.create({
    data: {
      profileId: profile.id,
      institution: 'Chartered Institute of Customer Relationship Management',
      degree: 'Postgraduate Diploma',
      endDate: new Date('2017-12-31'),
      sortOrder: 1,
    },
  });

  await prisma.educationEntry.create({
    data: {
      profileId: profile.id,
      institution: 'Obafemi Awolowo University',
      degree: 'B.A.',
      field: 'English Language',
      endDate: new Date('2014-12-31'),
      sortOrder: 2,
    },
  });

  await prisma.certificationEntry.create({
    data: {
      profileId: profile.id,
      name: 'AI Engineer Bootcamp',
      issueDate: new Date('2025-06-01'),
      verificationStatus: 'unverified',
      sortOrder: 0,
    },
  });

  await prisma.certificationEntry.create({
    data: {
      profileId: profile.id,
      name: 'Product Management',
      issueDate: new Date('2024-06-01'),
      verificationStatus: 'unverified',
      sortOrder: 1,
    },
  });

  await prisma.certificationEntry.create({
    data: {
      profileId: profile.id,
      name: 'Google Project Management',
      issuer: 'Google',
      issueDate: new Date('2024-06-01'),
      verificationStatus: 'unverified',
      sortOrder: 2,
    },
  });

  await prisma.certificationEntry.create({
    data: {
      profileId: profile.id,
      name: 'ALX Software Engineering',
      issuer: 'ALX Africa',
      issueDate: new Date('2022-06-01'),
      verificationStatus: 'unverified',
      sortOrder: 3,
    },
  });

  await prisma.certificationEntry.create({
    data: {
      profileId: profile.id,
      name: 'Full Stack Development',
      issuer: 'freeCodeCamp',
      issueDate: new Date('2020-06-01'),
      verificationStatus: 'unverified',
      sortOrder: 4,
    },
  });

  await prisma.achievementEntry.create({
    data: {
      profileId: profile.id,
      title: 'Improved application performance by 70%',
      category: 'Performance',
      description:
        'Implemented Redis caching and optimized backend services on enterprise web applications at Innovate One Company.',
      evidenceId: performanceEvidence.id,
      sortOrder: 0,
    },
  });

  await prisma.achievementEntry.create({
    data: {
      profileId: profile.id,
      title: 'Drove 10% revenue growth via e-commerce redesign',
      category: 'Business',
      description: 'Full Shopify redesign for Hertunba improved UX and conversion.',
      evidenceId: revenueEvidence.id,
      sortOrder: 1,
    },
  });

  await prisma.cvImport.create({
    data: {
      profileId: profile.id,
      rawText: RESUME_RAW_TEXT,
      status: 'Imported',
      sourceNote: 'Imported from ayodeji_software_engineer.pdf.',
      parseSummary: {
        sectionCount: 6,
        skillKeywordCount: 38,
        contactEmails: [SEED_EMAIL],
        contactPhones: ['+234 810 680 1274'],
        headings: ['SUMMARY', 'EXPERIENCE', 'PROJECT', 'EDUCATION', 'CERTIFICATIONS', 'SKILLS'],
      },
    },
  });

  return true;
}

function seedSkill(
  name: string,
  category: string,
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert',
  years: number,
  lastUsedYear: number,
): {
  name: string;
  key: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  years: number;
  lastUsedYear: number;
} {
  return { name, key: name.toLowerCase().trim(), category, level, years, lastUsedYear };
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
        note: 'development seed — candidate (Ayodeji Oludiya) from resume; jobs/matches come from discovery & matching',
      },
    },
  });

  console.log(
    seeded
      ? 'Seeded candidate profile from resume (Ayodeji Oludiya).'
      : 'Candidate already present; skipped.',
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
