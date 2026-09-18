/**
 * Deterministic CV text parser (Phase 2). No AI: it normalizes the document,
 * detects standard section headings, segments lines under each section, and
 * extracts durable signals (contact emails/phones, skill keywords). AI-assisted
 * structured extraction is a later phase; this floor keeps CV import useful
 * and fully offline/reproducible today.
 */
import { splitLines, splitListItems, toSkillKey, normalizeWhitespace, normalizeText } from './text.js';
import type { ParsedCv, ParsedCvSection, ParsedCvSummary, ParagraphKind } from './types.js';

const HEADINGS: Record<ParagraphKind, string[]> = {
  contact: ['contact', 'contact information', 'personal details', 'personal information', 'profile contact'],
  summary: ['summary', 'profile', 'professional summary', 'career summary', 'about me', 'about', 'objective', 'career objective'],
  experience: ['experience', 'work experience', 'professional experience', 'employment history', 'employment', 'experience history', 'work history'],
  skills: ['skills', 'technical skills', 'skills and expertise', 'skills & expertise', 'core competencies', 'technologies', 'tech stack', 'tools', 'expertise'],
  projects: ['projects', 'personal projects', 'project experience', 'selected projects', 'portfolio'],
  education: ['education', 'academic background', 'academic qualifications', 'qualifications', 'education & training'],
  certifications: ['certifications', 'certificates', 'licenses', 'licences', 'certifications and licenses', 'certifications & licenses', 'professional certifications'],
  achievements: ['achievements', 'awards', 'honors', 'awards & honors', 'accomplishments', 'honors & awards'],
  languages: ['languages', 'language skills'],
  other: [],
};

const HEADING_LOOKUP = new Map<string, ParagraphKind>(
  Object.entries(HEADINGS).flatMap(([kind, aliases]) => aliases.map((alias) => [alias, kind as ParagraphKind])),
);

/** Heavily reduced stop list for skill keyword extraction. */
const SKILL_STOPLIST = new Set([
  'skills', 'skill', 'expertise', 'technologies', 'technology', 'tools', 'tool',
  'languages', 'language', 'and', 'with', 'of', 'etc', 'proficient', 'familiar',
  'knowledge', 'experienced', 'working', 'programming', 'professionally',
]);

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(\+?\d[\d\s().-]{6,}\d)/g;

/** Does this line read as a recognized section heading? */
function headingKind(line: string): ParagraphKind | null {
  const normalized = normalizeWhitespace(line)
    .toLowerCase()
    .replace(/^[-–—*•·o]+\s*/u, '')
    .replace(/:+$/u, '');
  if (normalized.length === 0 || normalized.length > 40) return null;
  return HEADING_LOOKUP.get(normalized) ?? null;
}

/** Segment the normalized document into sections. */
function segment(lines: string[]): ParsedCvSection[] {
  const sections: ParsedCvSection[] = [];
  let current: ParsedCvSection = { kind: 'other', lines: [] };

  const push = (section: ParsedCvSection) => {
    const clean: ParsedCvSection = { ...section, lines: section.lines.filter((l) => l.length > 0) };
    if (clean.lines.length > 0 || clean.kind !== 'other') sections.push(clean);
  };

  for (const line of lines) {
    const kind = headingKind(line);
    if (kind) {
      push(current);
      current = { heading: line, kind, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  push(current);
  return sections;
}

/** Find all emails and phones anywhere in the document. */
function extractContacts(text: string): { emails: string[]; phones: string[] } {
  const emails = Array.from(new Set(text.match(EMAIL_RE) ?? []));
  const phones = Array.from(new Set((text.match(PHONE_RE) ?? []).map((p) => normalizeWhitespace(p))));
  return { emails, phones };
}

/** Tokenize the skills section into deduplicated keyword candidates. */
function extractSkills(sections: ParsedCvSection[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const section of sections) {
    if (section.kind !== 'skills') continue;
    for (const line of section.lines) {
      for (let raw of splitListItems(line)) {
        // Drop parenthetical qualifiers like "(5 years)" and trailing durations.
        raw = raw.replace(/\(.*?\)/g, ' ').replace(/\s*[-–—]+\s*\d+\s*(year|yr|yrs|years)?s?\b/gi, ' ').trim();
        raw = raw.replace(/\s*\(\d+\s*\/?\s*\d+\)/g, ' ').trim();
        raw = normalizeWhitespace(raw);
        if (raw.length < 2 || raw.length > 60) continue;
        const look = raw.toLowerCase().replace(/\s+/g, ' ').trim();
        if (SKILL_STOPLIST.has(look)) continue;
        const key = toSkillKey(raw);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(raw);
      }
    }
  }
  return result;
}

/** Parse a plain-text CV into sections, contact and skill keyword signals. */
export function parseCv(text: string): ParsedCv {
  const normalized = normalizeText(text);
  const lines = splitLines(normalized);
  const sections = segment(lines);
  const contact = extractContacts(normalized);
  const skillKeywords = extractSkills(sections);
  return { sections, skillKeywords, contact };
}

/** Condense a parse result into the summary shape persisted on CvImport. */
export function toParsedCvSummary(parsed: ParsedCv): ParsedCvSummary {
  return {
    sectionCount: parsed.sections.length,
    skillKeywordCount: parsed.skillKeywords.length,
    contactEmails: parsed.contact.emails,
    contactPhones: parsed.contact.phones,
    headings: parsed.sections.map((s) => s.heading).filter((h): h is string => Boolean(h)),
  };
}