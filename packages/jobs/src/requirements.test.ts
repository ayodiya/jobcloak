import { describe, expect, it } from 'vitest';
import { extractRequirements, normalizeRequirementKey } from './requirements.js';

const DESCRIPTION = `Senior Full-Stack Engineer

Requirements
- 5+ years of experience with TypeScript and Node.js
- Bachelor's degree in Computer Science
- Experience building REST APIs with Python

Preferred qualifications
- Docker and Kubernetes at scale
- Strong SQL skills

Nice to have
- GraphQL experience
- Fluency in English
`;

describe('extractRequirements', () => {
  it('extracts skills, experience, education and language by section', () => {
    const reqs = extractRequirements(DESCRIPTION);
    const byKey = (key: string) => reqs.find((r) => r.key === key);

    const ts = byKey('typescript');
    expect(ts).toBeDefined();
    expect(ts?.kind).toBe('Required');
    expect(ts?.category).toBe('Skill');
    expect(ts?.source).toBe('Deterministic');

    const exp = byKey('5+ years');
    expect(exp?.kind).toBe('Required');
    expect(exp?.category).toBe('Experience');
    expect(exp?.minYears).toBe(5);

    const edu = byKey('bachelor s');
    expect(edu?.kind).toBe('Required');
    expect(edu?.category).toBe('Education');
    expect(edu?.name).toBe("Bachelor's");

    const docker = byKey('docker');
    expect(docker?.kind).toBe('Preferred');

    const k8s = byKey('kubernetes');
    expect(k8s?.kind).toBe('Preferred');

    const graphql = byKey('graphql');
    expect(graphql?.kind).toBe('NiceToHave');

    const english = byKey('english');
    expect(english?.kind).toBe('NiceToHave');
    expect(english?.category).toBe('Language');
  });

  it('is deterministic and dedupes', () => {
    const a = extractRequirements(DESCRIPTION);
    const b = extractRequirements(DESCRIPTION);
    expect(a).toEqual(b);

    const keys = a.map((r) => `${r.kind}|${r.category}|${r.key}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('sorts required before preferred before nice-to-have', () => {
    const kinds = extractRequirements(DESCRIPTION).map((r) => r.kind);
    const firstNiceToHave = kinds.indexOf('NiceToHave');
    const lastRequired = kinds.lastIndexOf('Required');
    expect(kinds.indexOf('Preferred')).toBeGreaterThan(lastRequired);
    expect(firstNiceToHave).toBeGreaterThan(kinds.lastIndexOf('Preferred'));
  });

  it('respects maxRequirements cap', () => {
    const reqs = extractRequirements(DESCRIPTION, { maxRequirements: 3 });
    expect(reqs).toHaveLength(3);
  });

  it('handles empty input', () => {
    expect(extractRequirements('')).toEqual([]);
    expect(extractRequirements('<p>No requirements listed.</p>')).toEqual([]);
  });
});

describe('normalizeRequirementKey', () => {
  it('slugs and whitespace-collapses', () => {
    expect(normalizeRequirementKey('  Kubernetes  (k8s)  ')).toBe('kubernetes k8s');
  });
});