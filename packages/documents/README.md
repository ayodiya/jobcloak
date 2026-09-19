# @jobs-app/documents

Application material generation (Phase 6).

Generates tailored CVs, cover letters and answers grounded in the candidate
evidence base, applying the ADR-0005 factuality gate before any material is
marked ready. Materials are versioned and pinned to the evidence snapshot and
prompt version that produced them.

## Components

- `ApplicationGenerator` — orchestrates: load candidate + job → snapshot the
  evidence → structured LLM generation → claim-vs-evidence factuality check →
  bounded regenerate → persist a new `MaterialVersion` (status `Ready` or
  `Review`).
- `MaterialRepository` — persistence for `ApplicationMaterial`,
  `MaterialVersion` and `EvidenceSnapshot` (immutable versions, atomic roll of
  the material's current version/status).
- `evidence-snapshot.ts` — snapshot digest + `EvidenceDocument` mapping for the
  factuality gate.
- `render.ts` — deterministic rendering of drafts into final text; the model
  writes prose only, structure comes from records.
- `export.ts` — local TXT/DOCX export (pure-JS `docx` builder).

## Design rules

- The model only writes prose. Employers, dates, skills, education and other
  structural facts are loaded from candidate records; nothing structural can be
  invented.
- Factuality: every piece of generated prose is checked against the evidence
  base. Unsupported claims trigger regeneration (bounded) or a `Review` status —
  they are never silently shipped to an application.
- Reproducibility: every `MaterialVersion` records its prompt id/version and
  evidence snapshot; a submission can be re-derived exactly.

## Testing

- Unit tests use `MockLLMProvider` — no network, no model.
- Integration tests persist to the shared test Postgres and verify idempotent
  versioning and snapshot pinning.