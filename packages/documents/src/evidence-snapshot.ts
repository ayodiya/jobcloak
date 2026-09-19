import { createHash } from 'node:crypto';
import type { EvidenceDocument } from '@jobs-app/ai';
import type { EvidenceRecord } from '@jobs-app/database';

/**
 * Evidence snapshot helpers (ADR-0005).
 *
 * The snapshot stored on a material records WHICH evidence records grounded a
 * generation and a digest of their text — enough to prove what the materials
 * were based on without duplicating the evidence base.
 */
export interface EvidenceSnapshotSpec {
  hash: string;
  evidenceIds: string[];
}

/** SHA-1 over sorted, length-prefixed "<id>:<text>" lines; unambiguous for a
 *  given evidence set (rawText may itself contain newlines). */
export function snapshotDigest(
  records: readonly Pick<EvidenceRecord, 'id' | 'rawText'>[],
): string {
  const lines = records
    .map((record) => `${record.rawText.length}:${record.id}:${record.rawText}`)
    .sort()
    .join('\n');
  return createHash('sha1').update(lines).digest('hex');
}

/** Build the ready-made snapshot spec for a full evidence list. */
export function buildSnapshotSpec(
  records: readonly Pick<EvidenceRecord, 'id' | 'rawText'>[],
): EvidenceSnapshotSpec {
  return {
    hash: snapshotDigest(records),
    evidenceIds: records.map((record) => record.id),
  };
}

/** Map evidence records to the `EvidenceDocument` shape the factuality gate
 *  retrieves against. `claims` (extracted statements) are indexed as tags. */
export function toEvidenceDocuments(records: readonly EvidenceRecord[]): EvidenceDocument[] {
  return records.map((record) => {
    const claims = asStringArray(record.claims);
    return {
      id: record.id,
      text: [record.summary, record.rawText].filter(Boolean).join(' '),
      tags: claims.length > 0 ? ['evidence', ...claims] : ['evidence'],
    };
  });
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}