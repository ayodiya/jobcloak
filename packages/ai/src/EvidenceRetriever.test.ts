import { describe, expect, it } from 'vitest';
import { EvidenceRetriever, tokenize } from './EvidenceRetriever.js';
import type { EvidenceDocument } from './types.js';

const docs: EvidenceDocument[] = [
  { id: 'e1', text: 'Built a TypeScript service with PostgreSQL and Redis', tags: ['backend'] },
  { id: 'e2', text: 'Managed a team of product designers', tags: ['leadership'] },
  { id: 'e3', text: 'Wrote C++ and Node.js tooling' },
];

describe('tokenize', () => {
  it('keeps developer tokens and drops stopwords and short terms', () => {
    const terms = tokenize('I built a c++ and node.js service with the team');
    expect(terms.has('c++')).toBe(true);
    expect(terms.has('node.js')).toBe(true);
    expect(terms.has('built')).toBe(true);
    expect(terms.has('the')).toBe(false);
    expect(terms.has('a')).toBe(false);
    expect(terms.has('i')).toBe(false);
  });
});

describe('EvidenceRetriever', () => {
  it('returns no matches for an empty query', () => {
    expect(new EvidenceRetriever().retrieve('   ', docs)).toEqual([]);
  });

  it('ranks documents by query-term overlap', () => {
    const matches = new EvidenceRetriever().retrieve('TypeScript PostgreSQL', docs);
    expect(matches[0]?.id).toBe('e1');
    expect(matches[0]?.score).toBe(1);
    expect(matches[0]?.matchedTerms).toEqual(['postgresql', 'typescript']);
  });

  it('matches multi-word developer tokens', () => {
    const cpp = new EvidenceRetriever().retrieve('c++', docs);
    expect(cpp.map((m) => m.id)).toContain('e3');

    const node = new EvidenceRetriever().retrieve('node.js', docs);
    expect(node.map((m) => m.id)).toContain('e3');
  });

  it('includes tags in matching', () => {
    const matches = new EvidenceRetriever().retrieve('leadership', docs);
    expect(matches[0]?.id).toBe('e2');
  });

  it('honours maxResults and minScore', () => {
    const matches = new EvidenceRetriever({ maxResults: 1, minScore: 0.5 }).retrieve(
      'TypeScript designers',
      docs,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.id).toBe('e1');
  });

  it('returns the single best match', () => {
    expect(new EvidenceRetriever().best('PostgreSQL', docs)?.id).toBe('e1');
    expect(new EvidenceRetriever().best('quantum physics', docs)).toBeUndefined();
  });

  it('is deterministic for equal scores', () => {
    const tied: EvidenceDocument[] = [
      { id: 'b', text: 'alpha' },
      { id: 'a', text: 'alpha' },
    ];
    expect(new EvidenceRetriever().retrieve('alpha', tied).map((m) => m.id)).toEqual(['a', 'b']);
  });
});
