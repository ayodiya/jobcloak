import { NotFoundError } from '@jobs-app/shared';
import type { FastifyInstance } from 'fastify';
import type { RouteContext } from './context.js';

interface CandidateResponse {
  profile: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    title: string | null;
    emails: unknown;
    phones: unknown;
    city: string | null;
    country: string | null;
    languages: unknown;
    workAuthorization: string | null;
    remotePreferred: boolean | null;
    relocationWilling: boolean | null;
    preferredLocations: unknown;
    targetRoles: unknown;
    expectedSalaryMin: number | null;
    expectedSalaryMax: number | null;
    currency: string | null;
  };
  skills: Array<{ id: string; name: string; category: string | null; level: string | null; years: number | null; lastUsedYear: number | null }>;
  experience: Array<{ organization: string; title: string; startDate: string | null; endDate: string | null; current: boolean }>;
  stats: {
    skillsCount: number;
    experienceYears: number;
    experienceEntries: number;
    educationEntries: number;
    certificationCount: number;
    achievementCount: number;
    evidenceCount: number;
    materialsCount: number;
    matchesCount: number;
    matchesEligible: number;
    applicationsCount: number;
    applicationsActive: number;
  };
}

export function registerCandidateRoutes(app: FastifyInstance, context: RouteContext): void {
  app.get('/candidate', async (): Promise<CandidateResponse> => {
    const db = await context.db();
    const profile = await db.candidateProfile.findFirst({
      orderBy: { createdAt: 'asc' },
      include: { skills: true, experience: true },
    });
    if (!profile) throw new NotFoundError('No candidate profile found (run the seed)');

    const [education, certifications, achievements, evidenceCount, materialsCount, matchesCount, matchesEligible, applicationStats] =
      await Promise.all([
        db.educationEntry.count({ where: { profileId: profile.id } }),
        db.certificationEntry.count({ where: { profileId: profile.id } }),
        db.achievementEntry.count({ where: { profileId: profile.id } }),
        db.evidenceRecord.count({ where: { profileId: profile.id } }),
        db.applicationMaterial.count({ where: { profileId: profile.id } }),
        db.jobMatch.count(),
        db.jobMatch.count({ where: { eligible: true } }),
        db.application.groupBy({ by: ['status'], where: { profileId: profile.id }, _count: { _all: true } }),
      ]);

    const applicationsCount = applicationStats.reduce((sum, group) => sum + group._count._all, 0);
    const applicationsActive = applicationStats
      .filter((group) => ['Prepared', 'InProgress'].includes(group.status))
      .reduce((sum, group) => sum + group._count._all, 0);

    return {
      profile: {
        id: profile.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        title: profile.title,
        emails: profile.emails,
        phones: profile.phones,
        city: profile.city,
        country: profile.country,
        languages: profile.languages,
        workAuthorization: profile.workAuthorization,
        remotePreferred: profile.remotePreferred,
        relocationWilling: profile.relocationWilling,
        preferredLocations: profile.preferredLocations,
        targetRoles: profile.targetRoles,
        expectedSalaryMin: profile.expectedSalaryMin,
        expectedSalaryMax: profile.expectedSalaryMax,
        currency: profile.currency,
      },
      skills: profile.skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        category: skill.category,
        level: skill.level,
        years: skill.years,
        lastUsedYear: skill.lastUsedYear,
      })),
      experience: profile.experience.map((entry) => ({
        organization: entry.organization,
        title: entry.title,
        startDate: entry.startDate.toISOString(),
        ...(entry.endDate ? { endDate: entry.endDate.toISOString() } : { endDate: null }),
        current: entry.current,
      })),
      stats: {
        skillsCount: profile.skills.length,
        experienceYears: totalExperienceYears(profile.experience.map((entry) => ({ startDate: entry.startDate, endDate: entry.endDate, current: entry.current }))),
        experienceEntries: profile.experience.length,
        educationEntries: education,
        certificationCount: certifications,
        achievementCount: achievements,
        evidenceCount,
        materialsCount,
        matchesCount,
        matchesEligible,
        applicationsCount,
        applicationsActive,
      },
    };
  });

  app.get('/candidate/evidence', async () => {
    const db = await context.db();
    const profile = await db.candidateProfile.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
    if (!profile) throw new NotFoundError('No candidate profile found (run the seed)');

    const where = { profileId: profile.id };
    const [items, total] = await Promise.all([
      db.evidenceRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          source: true,
          summary: true,
          claims: true,
          createdAt: true,
        },
      }),
      db.evidenceRecord.count({ where }),
    ]);
    return { items, total };
  });

  app.get('/candidate/materials', async () => {
    const db = await context.db();
    const profile = await db.candidateProfile.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
    if (!profile) throw new NotFoundError('No candidate profile found (run the seed)');

    const materials = await db.applicationMaterial.findMany({
      where: { profileId: profile.id },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: materials.map((material) => ({
        id: material.id,
        kind: material.kind,
        jobId: material.jobId,
        version: material.version,
        status: material.status,
        createdAt: material.createdAt.toISOString(),
        latestVersion: material.versions[0]
          ? {
              version: material.versions[0].version,
              content: material.versions[0].content,
              promptId: material.versions[0].promptId,
              aiModel: material.versions[0].aiModel,
              createdAt: material.versions[0].createdAt.toISOString(),
            }
          : null,
      })),
      total: materials.length,
    };
  });
}

interface ExperienceItem {
  startDate: Date;
  endDate: Date | null;
  current: boolean;
}

function totalExperienceYears(entries: ExperienceItem[]): number {
  const now = new Date();
  const totalMs = entries.reduce((sum, entry) => {
    const end = entry.current ? now : entry.endDate ?? now;
    const start = entry.startDate;
    return sum + Math.max(0, end.getTime() - start.getTime());
  }, 0);
  return Number((totalMs / (365.25 * 24 * 60 * 60 * 1000)).toFixed(1));
}