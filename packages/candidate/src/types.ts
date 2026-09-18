/**
 * Candidate domain: re-exports the Prisma models that define the candidate
 * surface and declares the deterministic CV-parser shapes. All user-authored
 * input flows through the zod schemas in validation.ts.
 */
import type { CertificationEntry, EvidenceRecord, Prisma } from '@jobs-app/database';

export type { CandidateProfile, Skill, ExperienceEntry, ProjectEntry, EducationEntry, CertificationEntry, AchievementEntry, CvImport } from '@jobs-app/database';

export { SourceType, SkillLevel, CvImportStatus } from '@jobs-app/database';

export type { Prisma };

/** The relational types we persist against for typed repository methods. */
export type EvidenceRecordModel = EvidenceRecord;
export type CertificationEntryModel = CertificationEntry;

/** JSON lists persisted in Prisma Json fields. */
export type StringList = string[];

// ---------------------------------------------------------------------------
// Deterministic CV parser shapes
// ---------------------------------------------------------------------------

export type ParagraphKind =
  | 'contact'
  | 'summary'
  | 'experience'
  | 'skills'
  | 'projects'
  | 'education'
  | 'certifications'
  | 'achievements'
  | 'languages'
  | 'other';

export interface ParsedCvSection {
  heading?: string;
  kind: ParagraphKind;
  lines: string[];
}

export interface ParsedContact {
  emails: string[];
  phones: string[];
}

export interface ParsedCv {
  /** Section order as encountered in the document. */
  sections: ParsedCvSection[];
  /** Deterministically tokenized skill keywords (reviewed by the user). */
  skillKeywords: string[];
  contact: ParsedContact;
}

/** Persisted form of a parse result stored on CvImport.parseSummary. */
export interface ParsedCvSummary {
  sectionCount: number;
  skillKeywordCount: number;
  contactEmails: string[];
  contactPhones: string[];
  headings: string[];
}

export type CandidateProfileInput = Partial<Prisma.CandidateProfileUncheckedCreateInput>;