/**
 * Persistence for match results. Scoring is idempotent per job: rebuilding a
 * match replaces the previous dimensions atomically (one JobMatch per job).
 */
import { Prisma, prisma, type PrismaClient } from '@jobs-app/database';
import { DatabaseError, NotFoundError } from '@jobs-app/shared';
import type { MatchListFilter, MatchResult } from './types.js';
import { MATCH_DIMENSION_KEYS } from './weights.js';

type Db = PrismaClient;
export type MatchRow = Prisma.JobMatchGetPayload<Record<string, never>>;
export type MatchDimensionRow = Prisma.JobMatchDimensionGetPayload<Record<string, never>>;
export type MatchWithDimensions = Prisma.JobMatchGetPayload<{ include: { dimensions: true } }>;

export class MatchRepository {
  constructor(private readonly db: Db = prisma) {}

  findById(id: string): Promise<MatchWithDimensions | null> {
    return this.db.jobMatch.findUnique({ where: { id }, include: { dimensions: true } });
  }

  findByJobId(jobId: string): Promise<MatchWithDimensions | null> {
    return this.db.jobMatch.findUnique({ where: { jobId }, include: { dimensions: true } });
  }

  /**
   * Insert or atomically replace the match for a job. The unique jobId key
   * guarantees at most one match per job; re-matching overwrites in place.
   * A single Prisma upsert (no read-then-create) keeps concurrent recomputes
   * race-free.
   */
  async upsertMatch(result: MatchResult, now: Date = new Date()): Promise<MatchRow> {
    const dimensionData = MATCH_DIMENSION_KEYS.map((key) => {
      const dimension = result.dimensions[key];
      return {
        key,
        weight: dimension.weight,
        score: dimension.score,
        applicable: dimension.applicable,
        status: dimension.status,
        detail: sanitizeDisplayText(dimension.detail),
        evidence: dimension.evidence.length > 0 ? sanitizeDisplayText(dimension.evidence) : Prisma.JsonNull,
      };
    });

    try {
      return await this.db.jobMatch.upsert({
        where: { jobId: result.jobId },
        create: {
          jobId: result.jobId,
          jobTitle: sanitizeDisplayText(result.jobTitle),
          company: sanitizeDisplayText(result.company),
          totalScore: result.totalScore,
          eligible: result.eligible,
          confidence: result.confidence,
          disqualifiers: result.disqualifiers.length > 0 ? sanitizeDisplayText(result.disqualifiers) : Prisma.JsonNull,
          dimensions: { create: dimensionData },
        },
        update: {
          jobTitle: sanitizeDisplayText(result.jobTitle),
          company: sanitizeDisplayText(result.company),
          totalScore: result.totalScore,
          eligible: result.eligible,
          confidence: result.confidence,
          disqualifiers: result.disqualifiers.length > 0 ? sanitizeDisplayText(result.disqualifiers) : Prisma.JsonNull,
          updatedAt: now,
          dimensions: { deleteMany: {}, create: dimensionData },
        },
      });
    } catch (error) {
      throw new DatabaseError('Failed to persist job match', { cause: error });
    }
  }

  async getMatch(jobId: string): Promise<MatchWithDimensions> {
    const match = await this.findByJobId(jobId);
    if (!match) throw new NotFoundError(`No match recorded for job: ${jobId}`);
    return match;
  }

  listMatches(filter: MatchListFilter = {}): Promise<MatchWithDimensions[]> {
    return this.db.jobMatch.findMany({
      where: {
        ...(filter.eligible !== undefined ? { eligible: filter.eligible } : {}),
        ...(filter.company !== undefined ? { company: { contains: filter.company, mode: 'insensitive' } } : {}),
        ...(filter.status !== undefined ? { job: { status: filter.status } } : {}),
      },
      include: { dimensions: true },
      orderBy: [{ totalScore: 'desc' }, { updatedAt: 'desc' }],
      ...(filter.limit !== undefined ? { take: filter.limit } : {}),
      ...(filter.offset !== undefined ? { skip: filter.offset } : {}),
    });
  }

  countMatches(filter: MatchListFilter = {}): Promise<number> {
    return this.db.jobMatch.count({
      where: {
        ...(filter.eligible !== undefined ? { eligible: filter.eligible } : {}),
        ...(filter.company !== undefined ? { company: { contains: filter.company, mode: 'insensitive' } } : {}),
        ...(filter.status !== undefined ? { job: { status: filter.status } } : {}),
      },
    });
  }
}

/**
 * Neutralize listing-derived display text before persistence. Job titles,
 * companies, locations, requirement names and evidence originate from external
 * (and AI-extracted) sources; stripping HTML-significant and control characters
 * keeps the stored rows inert as defense-in-depth — render layers in later
 * phases must still escape untrusted fields.
 */
function sanitizeDisplayText(value: string): string;
function sanitizeDisplayText(value: string[]): string[];
function sanitizeDisplayText(value: unknown): unknown {
  const sanitize = (entry: string): string =>
    entry
      .split('')
      .filter((char) => (char.codePointAt(0) ?? 0) >= 0x20)
      .join('')
      .replace(/[<>&"']/g, '')
      .trim();
  if (Array.isArray(value)) return value.map((entry) => sanitize(String(entry)));
  if (typeof value === 'string') return sanitize(value);
  return value;
}