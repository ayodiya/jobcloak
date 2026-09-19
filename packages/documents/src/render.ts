/**
 * Deterministic rendering of generated drafts into final material text.
 * Separates the prose the model wrote (which passed the factuality gate) from
 * the candidate facts pulled directly from records, so export never depends on
 * spelling model-invented structure.
 */
import { ValidationError } from '@jobs-app/shared';
import type { CandidateBackground, JobContext } from './background.js';
import type { AnswerDraft, CoverLetterDraft, CvDraft } from './types.js';

/** Render a tailored CV from the candidate record + generative prose. */
export function renderCv(background: CandidateBackground, draft: CvDraft): string {
  if (draft.experience.length !== background.experience.length) {
    throw new ValidationError(
      `CV experience mismatch: prompt had ${background.experience.length} entries, model returned ${draft.experience.length}`,
    );
  }
  if (draft.projects.length !== background.projects.length) {
    throw new ValidationError(
      `CV projects mismatch: prompt had ${background.projects.length} entries, model returned ${draft.projects.length}`,
    );
  }

  const lines: string[] = [];
  lines.push(displayName(background), '');
  if (background.title) lines.push(background.title);
  const contact = [
    [background.city, background.country].filter(Boolean).join(', '),
    ...background.emails,
    ...background.phones,
  ].filter(Boolean);
  if (contact.length > 0) {
    lines.push(contact.join(' · '), '');
  }
  lines.push('PROFESSIONAL SUMMARY', '');
  lines.push(draft.summary, '');

  if (background.skills.length > 0) {
    lines.push('SKILLS', '');
    lines.push(
      background.skills
        .map((skill) => skill.name + (skill.years ? ` — ${skill.years} yr` : ''))
        .join(', '),
      '',
    );
  }

  lines.push('EXPERIENCE', '');
  background.experience.forEach((entry, index) => {
    lines.push(`${entry.title}, ${entry.organization}`, entry.period, '');
    const bullets = draft.experience[index]?.bullets ?? [];
    const fallback = [...entry.responsibilities, ...entry.achievements];
    for (const bullet of bullets.length > 0 ? bullets : fallback) lines.push(`- ${bullet}`);
    lines.push('');
  });

  if (background.projects.length > 0) {
    lines.push('PROJECTS', '');
    background.projects.forEach((project, index) => {
      lines.push(`${project.name}${project.role ? ` — ${project.role}` : ''}${project.period ? ` (${project.period})` : ''}`);
      const bullets = draft.projects[index]?.bullets ?? [];
      for (const bullet of bullets.length > 0 ? bullets : project.achievements) lines.push(`- ${bullet}`);
      lines.push('');
    });
  }

  if (background.education.length > 0) {
    lines.push('EDUCATION', '');
    for (const entry of background.education) {
      const degree = [entry.degree, entry.field].filter(Boolean).join(' in ');
      lines.push(entry.institution, [degree, entry.period].filter(Boolean).join(' · '), '');
    }
  }

  if (background.certifications.length > 0) {
    lines.push('CERTIFICATIONS', '');
    for (const cert of background.certifications) {
      lines.push(`${cert.name}${cert.issuer ? ` — ${cert.issuer}` : ''}`);
    }
    lines.push('');
  }

  if (background.achievements.length > 0) {
    lines.push('ACHIEVEMENTS', '');
    for (const achievement of background.achievements) lines.push(`- ${achievement}`);
    lines.push('');
  }

  return trimEnd(lines);
}

/** Render a tailored cover letter. */
export function renderCoverLetter(job: JobContext, draft: CoverLetterDraft, background: CandidateBackground): string {
  const lines: string[] = [];
  lines.push(displayName(background), '');
  if (background.title) lines.push(background.title);
  if (background.emails.length > 0) lines.push(background.emails[0] ?? '');
  lines.push('', `Re: ${job.title} — ${job.company}`, '');
  lines.push(draft.opening, '');
  for (const paragraph of draft.body) lines.push(paragraph, '');
  lines.push(draft.closing, '', displayName(background));
  return trimEnd(lines);
}

/** Render an answer to one application question. */
export function renderAnswer(question: string, draft: AnswerDraft): string {
  return trimEnd([`Q: ${question.trim()}`, '', draft.answer]);
}

// ---------------------------------------------------------------------------
// Prose for the factuality gate — only the model-written text is checked.
// ---------------------------------------------------------------------------

export function cvProse(draft: CvDraft): string {
  return [draft.summary, ...draft.experience.flatMap((s) => s.bullets), ...draft.projects.flatMap((s) => s.bullets)].join('\n');
}

export function coverLetterProse(draft: CoverLetterDraft): string {
  return [draft.opening, ...draft.body, draft.closing].join('\n');
}

export function answerProse(draft: AnswerDraft): string {
  return draft.answer;
}

function displayName(background: CandidateBackground): string {
  return [background.firstName, background.lastName].filter(Boolean).join(' ') || 'Candidate';
}

function trimEnd(lines: string[]): string {
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n') + '\n';
}