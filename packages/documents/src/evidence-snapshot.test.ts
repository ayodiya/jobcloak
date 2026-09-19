import { describe, expect, it } from 'vitest';
import type { EvidenceRecord } from '@jobs-app/database';
import { buildSnapshotSpec, snapshotDigest, toEvidenceDocuments } from './evidence-snapshot.js';

function record(id: string, rawText: string, claims?: unknown, summary?: string): EvidenceRecord {
  return {
    id,
    profileId: 'profile-1',
    source: 'UserProvided',
    rawText,
    claims: claims ?? [],
    summary: summary ?? null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
}

describe('evidence-snapshot', () => {
  it('digest is stable regardless of record order', () => {
    const a = record('a', 'Led the payments platform migration.');
    const b = record('b', 'Built TypeScript tooling.');

    expect(snapshotDigest([a, b])).toMatch(/^[a-f0-9]{40}$/);
    expect(snapshotDigest([a, b])).toBe(snapshotDigest([b, a]));
  });

  it('digest changes when evidence content changes', () => {
    const a = record('a', 'Text one.');
    const b = record('b', 'Different text.');
    const c = record('c', 'Text one.');

    expect(snapshotDigest([a, c])).not.toBe(snapshotDigest([a, b]));
  });

  it('builds a spec with ids and matching hash', () => {
    const [a, b] = [record('a', 'One'), record('b', 'Two')];
    const spec = buildSnapshotSpec([a, b]);
    expect(spec.evidenceIds).toEqual(['a', 'b']);
    expect(spec.hash).toBe(snapshotDigest([a, b]));
  });

  it('maps records to EvidenceDocuments including claim tags', () => {
    const docs = toEvidenceDocuments([record('e1', 'Raw evidence text.', ['TypeScript', 'led a migration'])]);
    expect(docs[0]!).toMatchObject({
      id: 'e1',
      text: 'Raw evidence text.',
      tags: ['evidence', 'TypeScript', 'led a migration'],
    });
  });

  it('omits empty claims from tags', () => {
    const docs = toEvidenceDocuments([record('e1', 'Raw text.', [])]);
    expect(docs[0]!.tags).toEqual(['evidence']);
  });
});