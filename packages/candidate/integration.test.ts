import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@jobs-app/database';
import { ConflictError } from '@jobs-app/shared';
import { CandidateService } from './src/candidate-service.js';

/**
 * Real-PostgreSQL round trip across the candidate domain: profile singleton,
 * facet CRUD, evidence attachment/coverage and CV import.
 */
describe('candidate (integration)', () => {
  const service = new CandidateService();

  beforeAll(async () => {
    const existing = await service.getProfile();
    if (existing) await service.deleteProfile();
  });

  afterAll(async () => {
    const existing = await service.getProfile();
    if (existing) await service.deleteProfile();
    await prisma.$disconnect();
  });

  it('creates the singleton profile and persists facets', async () => {
    const profile = await service.ensureProfile({ firstName: 'Integration', targetRoles: ['Backend Engineer'] });
    expect(profile.firstName).toBe('Integration');

    const skill = await service.addSkill(profile.id, { name: 'Node.js', level: 'Advanced' });
    expect(skill.key).toBe('node.js');

    await expect(service.addSkill(profile.id, { name: '  node.js ' })).rejects.toBeInstanceOf(ConflictError);

    const experience = await service.addExperience(profile.id, {
      organization: 'Acme',
      title: 'Engineer',
      startDate: '2020-01-01',
      current: true,
      endDate: '2021-01-01',
      achievements: ['Cut p99 latency by 40%'],
    });
    expect(experience.endDate).toBeNull();

    const reloaded = await service.getProfileOrThrow();
    expect(reloaded.skills).toHaveLength(1);
    expect(reloaded.targetRoles).toEqual(['Backend Engineer']);
  });

  it('tracks evidence coverage and attaches evidence to claims', async () => {
    const profile = await service.getProfileOrThrow();
    const evidenceService = service.getEvidenceService();

    const before = await evidenceService.coverage(profile.id);
    expect(before.unsupportedClaims).toBeGreaterThan(0);

    const evidence = await evidenceService.addEvidence(profile.id, {
      summary: 'Latency reduction',
      rawText: 'Grafana dashboard showing p99 reduced from 120ms to 72ms.',
    });

    const [experience] = await service.listExperience(profile.id);
    await evidenceService.attachEvidence('experience', experience!.id, evidence.id);

    const after = await evidenceService.coverage(profile.id);
    expect(after.evidenceCount).toBe(before.evidenceCount + 1);
    expect(after.supportedClaims).toBeGreaterThan(before.supportedClaims);
  });

  it('imports a CV and stores a deterministic parse summary', async () => {
    const result = await service.importCv({
      rawText: 'Experience\nAcme\n\nSkills\nTypeScript, Node.js\n\nContact\njordan@example.com',
    });

    expect(result.import.status).toBe('Imported');
    expect(result.suggestedSkills).toContain('TypeScript');
    expect(result.suggestedEmails).toContain('jordan@example.com');

    const summary = result.import.parseSummary as { sectionCount: number } | null;
    expect(summary?.sectionCount).toBeGreaterThan(0);
  });
});
