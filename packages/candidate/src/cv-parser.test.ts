import { describe, expect, it } from 'vitest';
import { parseCv, toParsedCvSummary } from './cv-parser.js';

const CV = `Jordan Doe
jordan.doe@example.com | +49 170 1234567

Professional Summary
Backend engineer with 8 years building distributed systems.

Work Experience
Senior Backend Engineer, Acme GmbH (2020 - Present)
- Led the migration to event-driven architecture
- Cut p99 latency by 40%

Technical Skills
TypeScript, Node.js (5 years), PostgreSQL; Redis | Docker
Kubernetes

Education
M.Sc. Computer Science, TU Berlin

Certifications
AWS Solutions Architect

Achievements
Speaker at NodeConf EU
`;

describe('cv-parser', () => {
  it('detects the standard sections in document order', () => {
    const parsed = parseCv(CV);
    const kinds = parsed.sections.filter((s) => s.heading).map((s) => s.kind);
    expect(kinds).toEqual(['summary', 'experience', 'skills', 'education', 'certifications', 'achievements']);
  });

  it('extracts emails and phones from anywhere in the document', () => {
    const parsed = parseCv(CV);
    expect(parsed.contact.emails).toEqual(['jordan.doe@example.com']);
    expect(parsed.contact.phones.some((p) => p.includes('1234567'))).toBe(true);
  });

  it('tokenizes and de-duplicates skill keywords', () => {
    const parsed = parseCv(CV);
    expect(parsed.skillKeywords).toContain('TypeScript');
    expect(parsed.skillKeywords).toContain('Node.js');
    expect(parsed.skillKeywords).toContain('Kubernetes');
    expect(new Set(parsed.skillKeywords.map((s) => s.toLowerCase())).size).toBe(parsed.skillKeywords.length);
  });

  it('strips duration qualifiers from skill tokens', () => {
    const parsed = parseCv(CV);
    expect(parsed.skillKeywords).not.toContain('Node.js (5 years)');
  });

  it('summarizes a parse result deterministically', () => {
    const summary = toParsedCvSummary(parseCv(CV));
    expect(summary.sectionCount).toBeGreaterThanOrEqual(summary.headings.length);
    expect(summary.skillKeywordCount).toBeGreaterThanOrEqual(5);
    expect(summary.contactEmails).toContain('jordan.doe@example.com');
  });
});
