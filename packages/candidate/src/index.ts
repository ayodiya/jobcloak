/**
 * Candidate intelligence package (Phase 2).
 *
 * Owns the local candidate: profile, skill/experience/project/education/
 * certification/achievement facets, an evidence base for claims (ADR-0005),
 * and deterministic CV parsing with user-reviewed skill suggestions.
 *
 * Design rules honored here:
 *  - Every user input passes zod validation (validation.ts) before touching a store.
 *  - Skill names are deduplicated by a normalized `key` (text.ts -> toSkillKey).
 *  - Claims reference evidence records; unsupported claims are flagged by
 *    EvidenceService.coverage() and quarantined from later generation.
 *  - CV import is reproducible and offline; the parse summary is stored on the
 *    CvImport row as evidence for a later AI-assisted extraction pass.
 *  - Facets carry an optional evidenceId so a claim can be traced to raw source
 *    text (section, snippet) — never just asserted.
 */
export { CandidateRepository } from './repository.js';
export { CandidateService } from './candidate-service.js';
export { EvidenceService } from './evidence-service.js';
export { CvImportService, type CvImportResult } from './cv-import-service.js';
export { parseCv, toParsedCvSummary } from './cv-parser.js';
export { normalizeWhitespace, normalizeText, toSkillKey, splitListItems, splitLines } from './text.js';
export {
  profileInputSchema,
  skillInputSchema,
  experienceInputSchema,
  projectInputSchema,
  educationInputSchema,
  certificationInputSchema,
  achievementInputSchema,
  evidenceInputSchema,
  cvImportInputSchema,
  facetUpdateSchema,
  SkillLevelSchema,
  SourceTypeSchema,
  validateOrThrow,
  type ProfileInput,
  type SkillInput,
  type ExperienceInput,
  type ProjectInput,
  type EducationInput,
  type CertificationInput,
  type AchievementInput,
  type EvidenceInput,
  type CvImportInput,
} from './validation.js';
export type {
  ParsedCv,
  ParsedCvSection,
  ParsedCvSummary,
  ParsedContact,
  ParagraphKind,
  EvidenceRecordModel,
  CertificationEntryModel,
  StringList,
  CandidateProfileInput,
} from './types.js';
export { SourceType, SkillLevel, CvImportStatus } from './types.js';
export type {
  CandidateProfile,
  Skill,
  ExperienceEntry,
  ProjectEntry,
  EducationEntry,
  CertificationEntry,
  AchievementEntry,
  CvImport,
} from './types.js';
export type { EvidenceCoverage } from './evidence-service.js';