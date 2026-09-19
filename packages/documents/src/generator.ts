/**
 * Application generator: produces tailored CVs, cover letters and answers,
 * grounds them in the candidate evidence base, and applies the ADR-0005
 * factuality gate (generate → claim extraction → evidence comparison →
 * regenerate or human review) before anything is marked ready.
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  AIValidator,
  PromptManager,
  createDefaultModelRouter,
  type FactualityReport,
  type ModelRouter,
} from '@jobs-app/ai';
import { CandidateRepository } from '@jobs-app/candidate';
import { JobRepository } from '@jobs-app/jobs';
import { ValidationError } from '@jobs-app/shared';
import type { CandidateBackground, CandidateMaterialSource, JobContext, LoadJobContext, LoadMaterialSource } from './background.js';
import { defaultLoadJobContext, defaultLoadMaterialSource } from './background.js';
import { buildSnapshotSpec, toEvidenceDocuments } from './evidence-snapshot.js';
import {
  answerProse,
  coverLetterProse,
  cvProse,
  renderAnswer,
  renderCoverLetter,
  renderCv,
} from './render.js';
import { ensureDocumentsPrompts } from './prompts.js';
import { MaterialRepository, type MaterialKey } from './repository.js';
import type { AnswerDraft, CoverLetterDraft, CvDraft, GenerateOutcome, MaterialDraft, MaterialKind, MaterialStatus, VersionPayload } from './types.js';

export interface GenerateCvOptions {
  jobId?: string;
  model?: string;
}

export interface GenerateCoverLetterOptions {
  jobId: string;
  model?: string;
}

export interface GenerateAnswerOptions {
  jobId?: string;
  question: string;
  model?: string;
}

export interface ApplicationGeneratorDeps {
  repository?: MaterialRepository;
  candidates?: CandidateRepository;
  jobs?: JobRepository;
  loadSource?: LoadMaterialSource;
  loadJob?: LoadJobContext;
  ai?: ModelRouter;
  prompts?: PromptManager;
  validator?: AIValidator;
  /** Extra regeneration attempts after the first gate failure (default 1). */
  maxRegenerations?: number;
  /** Evidence records passed to the prompt (default 12). */
  maxEvidenceForPrompt?: number;
  now?: () => Date;
}

const cvBulletsSchema = z.object({ bullets: z.array(z.string().min(1).max(400)).max(6) });

const coverLetterDraftSchema = z.object({
  opening: z.string().min(1).max(600),
  body: z.array(z.string().min(1).max(800)).max(6),
  closing: z.string().min(1).max(400),
});

const answerDraftSchema = z.object({ answer: z.string().min(1).max(4000) });

export interface GenerateArgs<T extends MaterialDraft> {
  task: string;
  kind: MaterialKind;
  key: string;
  promptId: string;
  job: JobContext | null;
  source: CandidateMaterialSource;
  schema: z.ZodType<T>;
  variables: Record<string, string>;
  render: (draft: T) => string;
  prose: (draft: T) => string;
  model?: string;
}

export class ApplicationGenerator {
  private readonly repository: MaterialRepository;
  private readonly loadSource: LoadMaterialSource;
  private readonly loadJob: LoadJobContext;
  private readonly ai: ModelRouter;
  private readonly prompts: PromptManager;
  private readonly validator: AIValidator;
  private readonly maxRegenerations: number;
  private readonly maxEvidenceForPrompt: number;
  private readonly now: () => Date;

  constructor(deps: ApplicationGeneratorDeps = {}) {
    this.repository = deps.repository ?? new MaterialRepository();
    const candidates = deps.candidates ?? new CandidateRepository();
    const jobs = deps.jobs ?? new JobRepository();
    this.loadSource = deps.loadSource ?? defaultLoadMaterialSource(candidates);
    this.loadJob = deps.loadJob ?? defaultLoadJobContext(jobs);
    this.maxRegenerations = deps.maxRegenerations ?? 1;
    this.maxEvidenceForPrompt = deps.maxEvidenceForPrompt ?? 12;
    this.now = deps.now ?? (() => new Date());
    this.prompts = deps.prompts ?? new PromptManager();
    this.ai = deps.ai ?? createDefaultModelRouter();
    this.validator = deps.validator ?? new AIValidator();
    ensureDocumentsPrompts(this.prompts);
  }

  /** Build a tailored CV for a job (or general-purpose) and gate it. */
  async generateCv(options: GenerateCvOptions = {}): Promise<GenerateOutcome<CvDraft>> {
    const source = await this.loadSource();
    const job = options.jobId ? await this.loadJob(options.jobId) : null;

    const schema = z.object({
      summary: z.string().min(1).max(1200),
      experience: z.array(cvBulletsSchema).length(source.background.experience.length),
      projects: z.array(cvBulletsSchema).length(source.background.projects.length),
    });

    return this.generate<z.infer<typeof schema>>({
      task: 'documents.cv',
      kind: 'Cv',
      key: '',
      promptId: 'documents.cv',
      job,
      source,
      schema,
      variables: {
        background: compactBackground(source.background),
        job: job ? compactJob(job) : 'General-purpose CV (no specific job).',
      },
      render: (draft) => renderCv(source.background, draft),
      prose: cvProse,
      model: options.model,
    });
  }

  /** Build a tailored cover letter for a job and gate it. */
  async generateCoverLetter(options: GenerateCoverLetterOptions): Promise<GenerateOutcome<CoverLetterDraft>> {
    const source = await this.loadSource();
    const job = await this.loadJob(options.jobId);

    return this.generate<z.infer<typeof coverLetterDraftSchema>>({
      task: 'documents.cover-letter',
      kind: 'CoverLetter',
      key: '',
      promptId: 'documents.cover-letter',
      job,
      source,
      schema: coverLetterDraftSchema,
      variables: {
        job: compactJob(job),
        background: compactBackground(source.background),
      },
      render: (draft) => renderCoverLetter(job, draft, source.background),
      prose: coverLetterProse,
      model: options.model,
    });
  }

  /** Build an answer to one application question and gate it. */
  async generateAnswer(options: GenerateAnswerOptions): Promise<GenerateOutcome<AnswerDraft>> {
    if (options.question.trim().length === 0) {
      throw new ValidationError('Question must not be empty');
    }
    if (options.question.length > 2000) {
      throw new ValidationError('Question must be at most 2000 characters');
    }
    const source = await this.loadSource();
    const job = options.jobId ? await this.loadJob(options.jobId) : null;

    return this.generate<z.infer<typeof answerDraftSchema>>({
      task: 'documents.answer',
      kind: 'Answer',
      key: questionKey(options.question),
      promptId: 'documents.answer',
      job,
      source,
      schema: answerDraftSchema,
      variables: {
        question: options.question,
        job: job ? compactJob(job) : 'No job context provided.',
        background: compactBackground(source.background),
      },
      render: (draft) => renderAnswer(options.question, draft),
      prose: answerProse,
      model: options.model,
    });
  }

  private async generate<T extends MaterialDraft>(args: GenerateArgs<T>): Promise<GenerateOutcome<T>> {
    const evidenceDocs = toEvidenceDocuments(this.boundEvidence(args.source.evidence));
    const variables = {
      ...args.variables,
      evidence: compactEvidence(args.source.evidence, this.maxEvidenceForPrompt),
    };

    let latestDraft: T | null = null;
    let report: FactualityReport | null = null;
    let attempts = 0;
    const unsupported: string[] = [];
    const maxAttempts = 1 + this.maxRegenerations;

    while (attempts < maxAttempts) {
      attempts += 1;
      const draft = await this.structured<T>(args, {
        ...variables,
        unsupportedClaims: unsupported.length > 0 ? unsupported.join('\n') : '(none)',
      });
      latestDraft = draft;
      report = this.validator.checkFactuality(args.prose(draft), evidenceDocs);
      if (report.passed) break;
      unsupported.push(
        report.unsupportedClaims.length > 0
          ? report.unsupportedClaims.map((claim) => claim.claim).join('\n')
          : '(no extractable claims)',
      );
    }

    if (!latestDraft || !report) {
      throw new Error('Generation produced no output');
    }

    const status: MaterialStatus = report.passed ? 'Ready' : 'Review';
    const content = args.render(latestDraft);
    const spec = buildSnapshotSpec(args.source.evidence);
    const snapshot = await this.repository.createSnapshot(args.source.profileId, spec);

    const payload: VersionPayload = {
      content,
      draft: latestDraft,
      promptId: args.promptId,
      promptVersion: this.prompts.get(args.promptId).version,
      aiModel: args.model ?? null,
      snapshotId: snapshot.id,
      factuality: report,
      status,
    };

    const key: MaterialKey = {
      profileId: args.source.profileId,
      kind: args.kind,
      jobId: args.job?.id ?? '',
      key: args.key,
    };
    const saved = await this.repository.saveVersion(key, payload, this.now());
    await this.repository.removeIdleSnapshots(args.source.profileId);

    return {
      materialId: saved.material.id,
      version: saved.version.version,
      status,
      attempts,
      factuality: report,
      content,
      draft: latestDraft,
    };
  }

  /** Bound evidence BEFORE the gate: snapshot stays full, prompt stays bounded. */
  private boundEvidence(evidence: CandidateMaterialSource['evidence']): CandidateMaterialSource['evidence'] {
    return evidence.slice(0, this.maxEvidenceForPrompt);
  }

  private async structured<T extends MaterialDraft>(
    args: GenerateArgs<T>,
    variables: Record<string, string>,
  ): Promise<T> {
    const prompt = this.prompts.render(args.promptId, variables);
    const result = await this.ai.structured(args.task, {
      prompt,
      schema: args.schema,
      temperature: 0.4,
      maxTokens: 4000,
    });
    return result as T;
  }
}

export function questionKey(question: string): string {
  return createHash('sha1')
    .update(question.trim().toLowerCase().replace(/\s+/g, ' '))
    .digest('hex');
}

export function compactBackground(background: CandidateBackground): string {
  return JSON.stringify({
    name: [background.firstName, background.lastName].filter(Boolean).join(' '),
    title: background.title,
    location: [background.city, background.country].filter(Boolean).join(', '),
    workAuthorization: background.workAuthorization,
    languages: background.languages,
    skills: background.skills.map((skill) => ({ name: skill.name, level: skill.level, years: skill.years })),
    experience: background.experience.map((entry) => ({
      organization: entry.organization,
      title: entry.title,
      period: entry.period,
      responsibilities: entry.responsibilities,
      achievements: entry.achievements,
    })),
    projects: background.projects.map((project) => ({
      name: project.name,
      role: project.role,
      period: project.period,
      achievements: project.achievements,
    })),
    education: background.education,
    certifications: background.certifications,
  });
}

export function compactJob(job: JobContext): string {
  return JSON.stringify({
    title: job.title,
    company: job.company,
    location: job.location,
    remote: job.remote,
    seniority: job.seniority,
    requirements: job.requirements.slice(0, 20),
    description: job.description.slice(0, 2000),
  });
}

function compactEvidence(
  records: readonly Pick<CandidateMaterialSource['evidence'][number], 'summary' | 'rawText'>[],
  limit: number,
): string {
  return JSON.stringify(
    records.slice(0, limit).map((record) => ({ text: evidenceTextOf(record).slice(0, 800) })),
  );
}

/** Concatenate an evidence record's searchable text for the prompt. */
function evidenceTextOf(record: Pick<CandidateMaterialSource['evidence'][number], 'summary' | 'rawText'>): string {
  return [record.summary, record.rawText].filter(Boolean).join(' ');
}

export type { CvDraft, CoverLetterDraft, AnswerDraft } from './types.js';