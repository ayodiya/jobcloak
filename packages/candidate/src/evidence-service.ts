/**
 * Evidence base service. Evidence records are the factual source of truth
 * behind candidate claims (ADR-0005); claims must reference an evidence record
 * before they can be surfaced in generated materials.
 */
import type { EvidenceRecord } from '@jobs-app/database';
import { NotFoundError } from '@jobs-app/shared';
import type { CandidateRepository } from './repository.js';
import { validateOrThrow, evidenceInputSchema } from './validation.js';

export interface EvidenceCoverage {
  evidenceCount: number;
  totalClaims: number;
  supportedClaims: number;
  unsupportedClaims: number;
}

export class EvidenceService {
  constructor(private readonly repo: CandidateRepository) {}

  async addEvidence(profileId: string, input: unknown): Promise<EvidenceRecord> {
    const data = validateOrThrow(evidenceInputSchema, input, 'evidence');
    return this.repo.createEvidence(profileId, data);
  }

  listEvidence(profileId: string): Promise<EvidenceRecord[]> {
    return this.repo.listEvidence(profileId);
  }

  async deleteEvidence(profileId: string, evidenceId: string): Promise<void> {
    const existing = await this.repo.getEvidence(evidenceId);
    if (!existing) throw new NotFoundError('EvidenceRecord not found');
    if (existing.profileId !== profileId) throw new NotFoundError('EvidenceRecord not found on this profile');
    await this.repo.deleteEvidence(evidenceId);
  }

  /** Associate an existing evidence record with a domain entry (set null to detach). */
  attachEvidence(
    model: 'experience' | 'project' | 'education' | 'certification' | 'achievement',
    entryId: string,
    evidenceId: string | null,
  ): Promise<void> {
    if (evidenceId === null) {
      return this.repo.attachEvidence(model, entryId, evidenceId);
    }
    return this.repo.getEvidence(evidenceId).then((evidence) => {
      if (!evidence) throw new NotFoundError('EvidenceRecord not found');
      return this.repo.attachEvidence(model, entryId, evidenceId);
    });
  }

  /**
   * Count claim-bearing fields (achievements, experience responsibilities) and
   * how many are backed by a referenced evidence record. Unsupported claims are
   * quarantined from generation until linked or manually confirmed.
   */
  async coverage(profileId: string): Promise<EvidenceCoverage> {
    const [evidence, experience, projects, achievements] = await Promise.all([
      this.repo.listEvidence(profileId),
      this.repo.listExperience(profileId),
      this.repo.listProjects(profileId),
      this.repo.listAchievements(profileId),
    ]);

    const rows: { claimCount: number; evidenceId: string | null }[] = [
      ...experience.map((e) => ({
        claimCount: ((e.achievements as string[] | null)?.length ?? 0) + ((e.responsibilities as string[] | null)?.length ?? 0),
        evidenceId: e.evidenceId,
      })),
      ...projects.map((p) => ({ claimCount: (p.achievements as string[] | null)?.length ?? 0, evidenceId: p.evidenceId })),
      ...achievements.map((a) => ({ claimCount: 1, evidenceId: a.evidenceId })),
    ];

    const totalClaims = rows.reduce((sum, row) => sum + row.claimCount, 0);
    const supportedClaims = rows.reduce((sum, row) => (row.evidenceId ? sum + row.claimCount : sum), 0);

    return {
      evidenceCount: evidence.length,
      totalClaims,
      supportedClaims,
      unsupportedClaims: totalClaims - supportedClaims,
    };
  }
}