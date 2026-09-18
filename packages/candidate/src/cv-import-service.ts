/**
 * CV import service: persists raw CV text as an auditable CvImport row, runs
 * the deterministic parser, stores the parse summary as evidence for later
 * AI-assisted extraction, and returns what the parser suggested (never
 * auto-applied — the user approves).
 */
import type { CvImport, Prisma } from '@jobs-app/database';
import { parseCv, toParsedCvSummary } from './cv-parser.js';
import type { CandidateRepository } from './repository.js';
import { cvImportInputSchema, validateOrThrow } from './validation.js';

export interface CvImportResult {
  import: CvImport;
  suggestedSkills: string[];
  suggestedEmails: string[];
  suggestedPhones: string[];
}

export class CvImportService {
  constructor(private readonly repo: CandidateRepository) {}

  async importCv(input: unknown): Promise<CvImportResult> {
    const data = validateOrThrow(cvImportInputSchema, input, 'CV import');
    const parsed = parseCv(data.rawText);
    const summary = toParsedCvSummary(parsed);
    const created = await this.repo.createCvImport(data.profileId!, {
      rawText: data.rawText,
      status: 'Imported',
      sourceNote: data.sourceNote,
      parseSummary: summary as unknown as Prisma.InputJsonValue,
    });
    return {
      import: created,
      suggestedSkills: parsed.skillKeywords,
      suggestedEmails: parsed.contact.emails,
      suggestedPhones: parsed.contact.phones,
    };
  }

  listImports(profileId: string): Promise<CvImport[]> {
    return this.repo.listCvImports(profileId);
  }
}