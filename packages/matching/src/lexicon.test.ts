import { describe, expect, it } from 'vitest';
import {
  candidateAuthorizationStatus,
  detectDomains,
  inferSeniority,
  requiresAuthorization,
  roleKeywords,
} from './lexicon.js';

describe('lexicon.inferSeniority', () => {
  it('detects explicit seniority levels', () => {
    expect(inferSeniority('Senior Backend Engineer').level).toBe('senior');
    expect(inferSeniority('Staff Software Engineer').level).toBe('staff');
    expect(inferSeniority('Principal Engineer').level).toBe('principal');
    expect(inferSeniority('Junior QA').level).toBe('junior');
    expect(inferSeniority('Lead Platform Engineer').level).toBe('lead');
  });

  it('returns the most senior marker hit', () => {
    expect(inferSeniority('Senior Staff Engineer').level).toBe('staff');
  });

  it('returns undefined when no marker is present', () => {
    expect(inferSeniority('Backend Engineer').level).toBeUndefined();
  });
});

describe('lexicon.roleKeywords', () => {
  it('extracts meaningful tokens and drops stopwords', () => {
    const tokens = roleKeywords('Senior Backend Engineer', 'Full-Stack Engineer');
    expect(tokens).toEqual(expect.arrayContaining(['backend', 'engineer', 'full', 'stack']));
    expect(tokens).not.toContain('senior');
    expect(tokens).not.toContain('the');
  });
});

describe('lexicon.detectDomains', () => {
  it('detects domain signals in text', () => {
    expect(detectDomains('Payments platform for merchants')).toContain('fintech');
    expect(detectDomains('Clinical health records')).toContain('healthcare');
    expect(detectDomains('They mention nothing obvious')).toEqual([]);
  });
});

describe('lexicon.requiresAuthorization', () => {
  it('detects sponsorship-required language', () => {
    expect(requiresAuthorization('Must be authorized to work in the EU')).toBe(true);
    expect(requiresAuthorization('We cannot sponsor visas')).toBe(true);
    expect(requiresAuthorization('Competitive salary and flexible hours')).toBe(false);
  });
});

describe('lexicon.candidateAuthorizationStatus', () => {
  it('flags an empowered profile as authorized', () => {
    expect(candidateAuthorizationStatus('EU Blue Card', '').authorized).toBe(true);
    expect(candidateAuthorizationStatus('', 'No sponsorship needed').authorized).toBe(true);
  });

  it('is unknown when the profile is silent', () => {
    expect(candidateAuthorizationStatus('', '').unknown).toBe(true);
  });

  it('reports unauthorized when the profile explicitly needs sponsorship', () => {
    expect(candidateAuthorizationStatus('', 'Requires visa sponsorship').authorized).toBe(false);
  });
});