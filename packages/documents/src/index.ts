/**
 * Application generation package (Phase 6).
 *
 * Owns tailored application materials: CVs, cover letters and answers
 * generated from the candidate record and job, grounded in the candidate
 * evidence base and gated by the ADR-0005 factuality pipeline
 * (claim extraction → evidence comparison → unsupported-claim detection →
 * regenerate or human review). Materials are versioned and pinned to the
 * evidence snapshot and prompt version that produced them.
 *
 * Design rules honored here:
 *  - The model only writes prose; structural facts (employers, dates, skills,
 *    education) come from candidate records, so nothing structural can be invented.
 *  - Every generated text must pass the factuality gate before status becomes
 *    `Ready`; anything with unsupported claims is persisted as `Review` for
 *    human adjudication (never silently shipped).
 *  - Each MaterialVersion is immutable and records promptId, promptVersion and
 *    the evidence snapshot id, so a submitted application is reproducible.
 *  - Export is deterministic (TXT natively, DOCX via the pure-JS `docx`
 *    builder); no external services are contacted.
 */
export { ApplicationGenerator } from './generator.js';
export type {
  ApplicationGeneratorDeps,
  GenerateAnswerOptions,
  GenerateCoverLetterOptions,
  GenerateCvOptions,
} from './generator.js';
export { questionKey, compactBackground, compactJob } from './generator.js';
export { MaterialRepository } from './repository.js';
export type { MaterialKey, MaterialWithVersion } from './repository.js';
export { snapshotDigest, buildSnapshotSpec, toEvidenceDocuments } from './evidence-snapshot.js';
export type { EvidenceSnapshotSpec } from './evidence-snapshot.js';
export { renderCv, renderCoverLetter, renderAnswer, cvProse, coverLetterProse, answerProse } from './render.js';
export { toTxt, toDocx } from './export.js';
export { ensureDocumentsPrompts, DOCUMENTS_PROMPT_VERSION } from './prompts.js';
export { defaultLoadMaterialSource, defaultLoadJobContext, formatPeriod } from './background.js';
export type {
  CandidateBackground,
  CandidateMaterialSource,
  EducationView,
  ExperienceView,
  CertificationView,
  JobContext,
  LoadJobContext,
  LoadMaterialSource,
  ProjectView,
  SkillView,
} from './background.js';
export type {
  MaterialDraft,
  MaterialKind,
  MaterialStatus,
  CvSectionBullets,
  CvDraft,
  CoverLetterDraft,
  AnswerDraft,
  GenerateOutcome,
  VersionPayload,
} from './types.js';