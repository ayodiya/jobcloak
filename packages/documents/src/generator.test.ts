import { describe, expect, it } from 'vitest';
import { AIValidator, createDefaultModelRouter } from '@jobs-app/ai';
import { MockLLMProvider } from '@jobs-app/ai/testing';
import { ValidationError } from '@jobs-app/shared';
import type { CandidateBackground, CandidateMaterialSource, JobContext } from './background.js';
import { ApplicationGenerator, questionKey } from './generator.js';
import type { MaterialKey, MaterialRepository } from './repository.js';
import type { VersionPayload } from './types.js';

const EVIDENCE_TEXT =
  'Alex Rivera is a senior backend engineer who led the migration of the payments platform to TypeScript and PostgreSQL at Acme Corp in Berlin.';

const SUPPORTED = 'I led the migration of the payments platform to TypeScript and PostgreSQL.';
const UNSUPPORTED = 'I invented a quantum rocket engine in my garage last Tuesday.';

function background(): CandidateBackground {
  return {
    firstName: 'Alex',
    lastName: 'Rivera',
    title: 'Senior Backend Engineer',
    city: 'Berlin',
    country: 'Germany',
    emails: ['alex@example.com'],
    phones: [],
    languages: ['English', 'Spanish'],
    workAuthorization: 'EU Blue Card',
    skills: [{ name: 'TypeScript', level: 'Advanced', years: 5 }],
    summary: 'Senior Backend Engineer',
    experience: [
      {
        organization: 'Acme Corp',
        title: 'Senior Backend Engineer',
        period: 'Jan 2021 – Present',
        responsibilities: [],
        achievements: ['Led the migration of the payments platform.'],
      },
    ],
    projects: [{ name: 'Payments Platform', role: 'Backend Lead', url: null, period: '2021 – Present', achievements: [] }],
    education: [{ institution: 'TU Berlin', degree: 'MSc', field: 'Computer Science', period: '2016 – 2019' }],
    certifications: [],
    achievements: [],
  };
}

function source(): CandidateMaterialSource {
  return {
    profileId: 'profile-1',
    background: background(),
    evidence: [
      {
        id: 'evidence-1',
        profileId: 'profile-1',
        source: 'UserProvided',
        rawText: EVIDENCE_TEXT,
        summary: null,
        claims: [],
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ],
  };
}

function job(): JobContext {
  return {
    id: 'job-1',
    title: 'Staff Engineer',
    company: 'Acme',
    location: 'Berlin',
    remote: false,
    description: 'Payments platform in Berlin. ' + 'x'.repeat(400),
    seniority: 'Staff',
    requirements: [{ kind: 'Required', category: 'Skill', name: 'TypeScript', minYears: 5, source: 'Deterministic' }],
  };
}

/** In-memory stand-in for MaterialRepository used by unit tests. */
class FakeRepository {
  readonly snapshots: Array<{ id: string; hash: string; evidenceIds: string[] }> = [];
  readonly saves: Array<{ key: MaterialKey; payload: VersionPayload }> = [];
  material = { id: 'material-1', version: 0 };

  async createSnapshot(profileId: string, spec: { hash: string; evidenceIds: string[] }): Promise<{ id: string }> {
    const snapshot = { id: `snapshot-${this.snapshots.length + 1}`, hash: spec.hash, evidenceIds: spec.evidenceIds };
    this.snapshots.push(snapshot);
    return snapshot;
  }

  async saveVersion(key: MaterialKey, payload: VersionPayload): Promise<{ material: { id: string }; version: { version: number } }> {
    this.material.version += 1;
    this.saves.push({ key, payload });
    return {
      material: { id: this.material.id },
      version: { version: this.material.version },
    };
  }

  async removeIdleSnapshots(): Promise<void> {}
}

function build(responder?: unknown | unknown[], options: { maxRegenerations?: number } = {}) {
  const mock = new MockLLMProvider({
    structured: responder ?? [],
    health: true,
  });
  const repo = new FakeRepository();
  const generator = new ApplicationGenerator({
    repository: repo as unknown as MaterialRepository,
    loadSource: async () => source(),
    loadJob: async () => job(),
    ai: createDefaultModelRouter({ providers: [mock], healthGating: false }),
    validator: new AIValidator(),
    maxRegenerations: options.maxRegenerations ?? 1,
  });
  return { generator, mock, repo };
}

function answerDraft(answer: string) {
  return { answer };
}

describe('ApplicationGenerator.answer', () => {
  it('marks a fully-supported answer Ready on the first pass', async () => {
    const { generator, mock, repo } = build(answerDraft(SUPPORTED));
    const outcome = await generator.generateAnswer({ question: 'Tell us about your backend experience.' });

    expect(outcome.status).toBe('Ready');
    expect(outcome.attempts).toBe(1);
    expect(outcome.factuality?.passed).toBe(true);
    expect(outcome.factuality?.totalClaims).toBeGreaterThan(0);
    expect(outcome.content).toContain(SUPPORTED);

    expect(mock.calls.length).toBe(1);
    expect(repo.saves).toHaveLength(1);
    expect(repo.saves[0]!.payload.promptId).toBe('documents.answer');
    expect(repo.saves[0]!.payload.promptVersion).toBe(1);
    expect(repo.saves[0]!.payload.snapshotId).toBe('snapshot-1');
    expect(repo.saves[0]!.payload.status).toBe('Ready');
  });

  it('regenerates with corrective context when the gate fails, then passes', async () => {
    const { generator, mock } = build([answerDraft(UNSUPPORTED), answerDraft(SUPPORTED)]);
    const outcome = await generator.generateAnswer({ question: 'Describe a project you are proud of.' });

    expect(outcome.attempts).toBe(2);
    expect(outcome.status).toBe('Ready');
    expect(outcome.factuality?.passed).toBe(true);

    const secondPrompt = (mock.calls[1]!.request as { prompt?: string }).prompt ?? '';
    expect(secondPrompt).toContain('quantum rocket engine');
  });

  it('persists status Review when regeneration cannot fix unsupported claims', async () => {
    const { generator, repo } = build(answerDraft(UNSUPPORTED));
    const outcome = await generator.generateAnswer({ question: 'Describe a project you are proud of.' });

    expect(outcome.attempts).toBe(2);
    expect(outcome.status).toBe('Review');
    expect(outcome.factuality?.passed).toBe(false);
    expect(repo.saves[0]!.payload.status).toBe('Review');
    expect(repo.saves[0]!.payload.snapshotId).toBeDefined();
  });

  it('bumps the material version on a second generation', async () => {
    const { generator, repo } = build(answerDraft(SUPPORTED));
    await generator.generateAnswer({ question: 'Why apply to Acme?' });
    const second = await generator.generateAnswer({ question: 'Why apply to Acme?' });

    expect(second.version).toBe(2);
    expect(repo.material.version).toBe(2);
    expect(repo.saves).toHaveLength(2);
    expect(repo.saves[0]!.key.key).toBe(repo.saves[1]!.key.key);
  });

  it('rejects empty and overlong questions', async () => {
    const { generator } = build(answerDraft(SUPPORTED));
    await expect(generator.generateAnswer({ question: '   ' })).rejects.toThrow(ValidationError);
    await expect(generator.generateAnswer({ question: 'x'.repeat(2001) })).rejects.toThrow(ValidationError);
  });
});

describe('ApplicationGenerator.cv', () => {
  it('generates a gated Ready CV aligned to the candidate record', async () => {
    const cv = {
      summary: 'Led the migration of the payments platform to TypeScript and PostgreSQL.',
      experience: [{ bullets: ['Led the migration of the payments platform to TypeScript and PostgreSQL.'] }],
      projects: [{ bullets: ['Built the payments platform with TypeScript and PostgreSQL.'] }],
    };
    const { generator, repo } = build(cv);
    const outcome = await generator.generateCv();

    expect(outcome.status).toBe('Ready');
    expect(outcome.attempts).toBe(1);
    expect(outcome.content).toContain('Alex Rivera');
    expect(outcome.content).toContain('Acme Corp');
    expect(repo.saves[0]!.payload.promptId).toBe('documents.cv');
  });
});

describe('ApplicationGenerator.cover-letter', () => {
  it('generates a gated Ready cover letter for a job', async () => {
    const draft = {
      opening: 'I am a senior backend engineer applying to the Staff Engineer role at Acme.',
      body: ['I led the migration of the payments platform to TypeScript and PostgreSQL.'],
      closing: 'I led the migration of the payments platform to TypeScript and PostgreSQL.',
    };
    const { generator, repo } = build(draft);
    const outcome = await generator.generateCoverLetter({ jobId: 'job-1' });

    expect(outcome.status).toBe('Ready');
    expect(outcome.content).toContain('Re: Staff Engineer — Acme');
    expect(repo.saves[0]!.key.jobId).toBe('job-1');
    expect(repo.saves[0]!.payload.promptId).toBe('documents.cover-letter');
  });
});

describe('questionKey', () => {
  it('is a stable sha1 digest of the normalized question', () => {
    const key = questionKey('  Why  Apply   to Acme? ');
    expect(key).toMatch(/^[a-f0-9]{40}$/);
    expect(key).toBe(questionKey('why apply to acme?'));
  });
});