import type { FactualityReport } from '@jobs-app/ai';

/** Kinds of generated application material. */
export type MaterialKind = 'Cv' | 'CoverLetter' | 'Answer';

/** Draft is mid-generation; Ready passed the factuality gate (awaiting human
 *  approval to submit); Review has unsupported claims that need adjudication
 *  (ADR-0005). */
export type MaterialStatus = 'Draft' | 'Ready' | 'Review';

/** Achievement bullets for one existing experience/project entry. The model
 *  only writes prose; the surrounding facts (organization, dates, skills) come
 *  from the candidate record so nothing structural can be invented. */
export interface CvSectionBullets {
  bullets: string[];
}

/** Structured generator output for a CV. `experience`/`projects` are
 *  index-aligned with the candidate's entries passed into the prompt. */
export interface CvDraft {
  summary: string;
  experience: CvSectionBullets[];
  projects: CvSectionBullets[];
}

export interface CoverLetterDraft {
  opening: string;
  body: string[];
  closing: string;
}

export interface AnswerDraft {
  answer: string;
}

export type MaterialDraft = CvDraft | CoverLetterDraft | AnswerDraft;

/** Result returned to callers; mirrors the persisted material + version. */
export interface GenerateOutcome<T extends MaterialDraft = MaterialDraft> {
  materialId: string;
  version: number;
  status: MaterialStatus;
  /** Number of LLM attempts (the last one may have failed the factuality gate). */
  attempts: number;
  factuality: FactualityReport | null;
  content: string;
  draft: T;
}

/** Factory for a saveVersion row; used by the generator before persisting. */
export interface VersionPayload {
  content: string;
  draft: unknown;
  promptId: string;
  promptVersion: number;
  aiModel?: string | null;
  snapshotId?: string | null;
  factuality: FactualityReport | null;
  status: MaterialStatus;
}