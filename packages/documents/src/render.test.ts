import { describe, expect, it } from 'vitest';
import type { CandidateBackground, JobContext } from './background.js';
import {
  answerProse,
  coverLetterProse,
  cvProse,
  renderAnswer,
  renderCoverLetter,
  renderCv,
} from './render.js';
import type { AnswerDraft, CoverLetterDraft, CvDraft } from './types.js';

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
        achievements: ['Led the payments platform migration to TypeScript and PostgreSQL.'],
      },
    ],
    projects: [
      { name: 'Open Source Parser', role: 'Maintainer', url: null, period: '2020', achievements: [] },
    ],
    education: [{ institution: 'TU Berlin', degree: 'MSc', field: 'Computer Science', period: '2016 – 2019' }],
    certifications: [{ name: 'AWS Certified Developer', issuer: 'AWS' }],
    achievements: ['Hackathon winner'],
  };
}

function cvDraft(): CvDraft {
  return {
    summary: 'Senior backend engineer who led a payments platform migration to TypeScript and PostgreSQL.',
    experience: [{ bullets: ['Led the payments platform migration to TypeScript and PostgreSQL.'] }],
    projects: [{ bullets: ['Maintains a widely used parser library.'] }],
  };
}

describe('render', () => {
  it('renders a CV with deterministic facts and generated prose', () => {
    const text = renderCv(background(), cvDraft());
    expect(text).toContain('Alex Rivera');
    expect(text).toContain('PROFESSIONAL SUMMARY');
    expect(text).toContain('Senior Backend Engineer, Acme Corp');
    expect(text).toContain('Jan 2021 – Present');
    expect(text).toContain('- Led the payments platform migration to TypeScript and PostgreSQL.');
    expect(text).toContain('TypeScript');
    expect(text).toContain('TU Berlin');
    expect(text).toContain('AWS Certified Developer — AWS');
  });

  it('rejects a CV whose experience count does not match the candidate record', () => {
    const draft = cvDraft();
    draft.experience = draft.experience.slice(0, 0);
    expect(() => renderCv(background(), draft)).toThrow(/experience mismatch/);
  });

  it('rejects a CV whose project count does not match the candidate record', () => {
    const draft = cvDraft();
    draft.projects = [...draft.projects, { bullets: ['extra'] }];
    expect(() => renderCv(background(), draft)).toThrow(/projects mismatch/);
  });

  it('falls back to record responsibilities when the model writes no bullets', () => {
    const draft = cvDraft();
    const bg = background();
    bg.experience[0]!.achievements = [];
    bg.experience[0]!.responsibilities = ['Operated the payments platform in production.'];
    draft.experience = [{ bullets: [] }];
    const text = renderCv(bg, draft);
    expect(text).toContain('- Operated the payments platform in production.');
  });

  it('renders a cover letter with greeting, body and closing', () => {
    const job: JobContext = {
      id: 'job-1',
      title: 'Staff Engineer',
      company: 'Acme',
      location: 'Berlin',
      remote: false,
      description: 'Payments platform. x'.repeat(20),
      seniority: 'Staff',
      requirements: [{ kind: 'Required', category: 'Skill', name: 'TypeScript', minYears: 5, source: 'Deterministic' }],
    };
    const draft: CoverLetterDraft = {
      opening: 'I am applying for the Staff Engineer role at Acme.',
      body: ['I led the payments platform migration to TypeScript and PostgreSQL.'],
      closing: 'I would welcome the chance to discuss further.',
    };
    const text = renderCoverLetter(job, draft, background());
    expect(text).toContain('Re: Staff Engineer — Acme');
    expect(text).toContain(draft.opening);
    expect(text).toContain(draft.body[0]);
    expect(text).toContain(draft.closing);
  });

  it('renders an answer with the question echoed back', () => {
    const draft: AnswerDraft = { answer: 'I led the payments platform migration to TypeScript and PostgreSQL.' };
    const text = renderAnswer('Tell us about your backend experience.', draft);
    expect(text).toContain('Q: Tell us about your backend experience.');
    expect(text).toContain(draft.answer);
  });

  it('extracts the exact prose fed to the factuality gate', () => {
    const draft = cvDraft();
    const prose = cvProse(draft);
    expect(prose).toContain(draft.summary);
    expect(prose).toContain(draft.experience[0]!.bullets[0]!);
    // deterministic sections are NOT part of the gated prose
    expect(prose).not.toContain('TU Berlin');

    expect(coverLetterProse({ opening: 'hi', body: ['a'], closing: 'bye' })).toBe('hi\na\nbye');
    expect(answerProse({ answer: 'the answer' })).toBe('the answer');
  });
});