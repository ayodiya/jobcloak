# @jobs-app/candidate

The local candidate: the single source of truth for who the applicant is and
what can be truthfully claimed about them. Phase 2 of the build.

## Surface

- **`CandidateService`** — get-or-create the singleton profile; CRUD for skills,
  experience, projects, education, certifications and achievements. All input is
  validated and normalized.
- **`EvidenceService`** — the factual evidence base behind claims (ADR-0005):
  add/list/delete evidence records, attach evidence to domain entries, and
  compute `coverage()` (supported vs unsupported claims).
- **`CvImportService` / `parseCv`** — deterministic, offline CV parsing:
  section detection, contact extraction, skill-keyword tokenization. The parse
  summary is stored on the `CvImport` row as evidence for a later AI-assisted
  pass; suggestions are never applied automatically.
- **`CandidateRepository`** — Prisma persistence; translates unique violations
  and missing rows into `ConflictError` / `NotFoundError`.

## Rules

- Every user-authored value passes a zod schema in `validation.ts`; services
  never accept raw shapes.
- Skill names are de-duplicated by a normalized key (`toSkillKey`).
- Claims (achievements, responsibilities) must reference an evidence record
  before they can be surfaced in generated materials; `coverage()` reports the
  gap.
- CV import is reproducible and local; no network or model calls in this phase.
