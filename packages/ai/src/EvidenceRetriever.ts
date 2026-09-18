import type { EvidenceDocument } from './types.js';

export interface EvidenceMatch {
  id: string;
  /** Fraction (0..1) of the query's meaningful terms present in the document. */
  score: number;
  matchedTerms: string[];
}

export interface EvidenceRetrieverOptions {
  maxResults?: number;
  minScore?: number;
  stopwords?: Iterable<string>;
}

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_MIN_SCORE = 0.01;

/**
 * Deterministic evidence retrieval used by the factuality gate (ADR-0005).
 *
 * This is intentionally lexical, not an LLM: matching must be reproducible and
 * explainable for every claim. Terms are lowercased and split on non-word
 * characters while preserving developer tokens (`c++`, `c#`, `node.js`).
 */
export class EvidenceRetriever {
  private readonly maxResults: number;
  private readonly minScore: number;
  private readonly stopwords: Set<string>;

  constructor(options: EvidenceRetrieverOptions = {}) {
    this.maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
    this.minScore = options.minScore ?? DEFAULT_MIN_SCORE;
    this.stopwords = new Set(
      [...(options.stopwords ?? DEFAULT_STOPWORDS)].map((word) => word.toLowerCase()),
    );
  }

  retrieve(query: string, documents: EvidenceDocument[]): EvidenceMatch[] {
    const queryTerms = tokenize(query, this.stopwords);
    if (queryTerms.size === 0) return [];

    return documents
      .map((document) => this.match(queryTerms, document))
      .filter((match) => match.score >= this.minScore)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, this.maxResults);
  }

  /** Convenience: the single best match, or undefined when nothing clears minScore. */
  best(query: string, documents: EvidenceDocument[]): EvidenceMatch | undefined {
    return this.retrieve(query, documents)[0];
  }

  private match(queryTerms: Set<string>, document: EvidenceDocument): EvidenceMatch {
    const documentTerms = tokenize(
      `${document.text} ${(document.tags ?? []).join(' ')}`,
      this.stopwords,
    );
    const matchedTerms = [...queryTerms].filter((term) => documentTerms.has(term)).sort();
    return {
      id: document.id,
      score: matchedTerms.length / queryTerms.size,
      matchedTerms,
    };
  }
}

/** Tokenize text into meaningful lowercase terms. */
export function tokenize(text: string, stopwords: Set<string> = new Set(DEFAULT_STOPWORDS)): Set<string> {
  const terms = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9+#.]+/)) {
    const term = raw.replace(/^\.+|\.+$/g, '');
    if (term.length < 2) continue;
    if (stopwords.has(term)) continue;
    terms.add(term);
  }
  return terms;
}

export const DEFAULT_STOPWORDS: readonly string[] = [
  'a', 'about', 'across', 'after', 'all', 'also', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'being', 'but', 'by', 'can', 'could', 'did', 'do', 'does',
  'during', 'each', 'for', 'from', 'had', 'has', 'have', 'having', 'he', 'her', 'here',
  'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'just', 'me', 'more', 'most',
  'my', 'no', 'not', 'of', 'on', 'or', 'our', 'out', 'over', 'own', 'she', 'should', 'so',
  'some', 'such', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'to', 'under', 'until', 'up', 'us', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'while', 'who', 'will', 'with', 'would', 'you', 'your',
  'using', 'used', 'use', 'work', 'working', 'worked', 'experience', 'experienced',
];
