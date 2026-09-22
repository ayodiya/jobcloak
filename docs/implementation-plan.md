# Implementation Plan

The authoritative, written plan for building this project. Created before implementation
begins. Phases proceed top-to-bottom; each phase is complete only when
implementation → tests → typecheck → lint → build → security review → documentation →
diff review → commit all pass.

## Assumptions (from environment inspection)

| Item | State |
|---|---|
| Target dir | `/Users/mac/Documents/personal_dev/jobs-applications` (empty, not a git repo) |
| Node / npm | v26.7.0 / 11.19.0 (pin `.nvmrc` to 22 for contributor LTS) |
| Package manager | npm workspaces (chosen) |
| Docker | 29.6.2, Postgres + Redis via compose |
| Local Postgres | broken Homebrew service → **not** used; Docker Compose provides Postgres 18 |
| Redis | available at :6379; run via compose in dev |
| Ollama | 0.34.1 running; models: `qwen2.5-coder:3b` (default), `7b`, `llama3.1:8b` |
| Playwright | 1.63.0 via npx; install chromium |

## Constraints & principles

- Correctness > speed · Evidence > assumptions · Tests > confidence ·
  Human approval > unsafe automation.
- Local-first: no external AI by default; everything private.
- No CAPTCHA/auth/rate-limit/robots/paywall bypassing. Manual workflows where automation
  is not permitted.
- `REVIEW_MODE` is the default automation mode.
- Match scores are explanatory, never predictions of hiring success.
- Every phase lands on its own branch off `develop`, feature-scoped commits using
  Conventional Commits, verified before commit.

## Phase plan

### Phase 0 — Repository Foundation ✅ (committed to `develop`)
`chore(repo)` scaffold → `docs(repo)` full doc set + ADRs → `ci(repo)` workflows/templates.

### Phase 1 — Application Foundation ✅ (committed to `develop`)
Monorepo + TS strict + config + logging + errors + Postgres/Redis (compose) + Prisma
schema/migrations/seed + API shell (Fastify, /health) + worker shell (BullMQ, queues) +
dashboard shell (Next.js, health page).
Verified: `typecheck`, `lint`, `test:unit` (36), `test:integration` (3), `build` — all green.

### Phase 2 — Candidate Intelligence ✅ (committed to `develop`)
Candidate profile + experience + skills + projects + education + certifications +
achievements + evidence; repositories, services, validation; CV import (text); seed data.
Verified: `typecheck`, `lint`, `test:unit` (55), `test:integration` (6), `build` — all green.

### Phase 3 — AI ✅ (committed to `develop`)
`LLMProvider`, `OllamaProvider`, `MockLLMProvider`, `ModelRouter`, `PromptManager`,
`StructuredOutputParser`, `AIValidator`; evidence retrieval; tests incl. malformed JSON,
timeouts, unavailable Ollama.
Verified: `typecheck`, `lint`, `test:unit` (131), `test:integration` (6), `build` — all green.

### Phase 4 — Jobs ✅ (committed to `develop`)
JobSource interface + registry, normalization, deduplication (fingerprint unique index),
requirement extraction (deterministic + AI-assisted), source health, mock/fixture sources;
edge-case tests.
Verified: `typecheck`, `lint`, `test:unit` (173), `test:integration` (11), `build` — all green.

### Phase 5 — Matching ✅ (committed to `develop`)
Deterministic weighted scoring (tech 30 / experience 20 / seniority 15 / role 15 /
location 10 / domain 5 / salary 5), hard filters/disqualifiers, explainable results,
confidence, persistence; AI-assisted interpretation only where deterministic data is thin.
`@jobs-app/matching`: `scoreJob`, `lexicon`, `experience`, `weights`, `MatchRepository`,
`MatchingService` (idempotent per `jobId`); schema `JobMatch`/`JobMatchDimension`.
Verified: `typecheck`, `lint`, `test:unit` (215), `test:integration` (14), `build` — all green.

### Phase 6 — Application Generation ✅ (committed to `develop`)
Material model + versioning, tailored CV + cover letter + answers generation,
factuality validation pipeline (claim extraction → evidence comparison → unsupported claim
detection → regenerate/review), TXT/DOCX output (PDF deferred), snapshot pinned per submission.
`@jobs-app/documents`: `ApplicationGenerator`, `MaterialRepository` (immutable
`MaterialVersion` per generation, `EvidenceSnapshot` pinned via
`profileId_kind_jobId_key` identity), deterministic render (model writes prose only),
TXT + DOCX export, prompt templates `documents.cv`/`documents.cover-letter`/`documents.answer`;
schema `EvidenceSnapshot`/`ApplicationMaterial`/`MaterialVersion`.
Verified: `typecheck`, `lint`, `test:unit` (238), `test:integration` (18), `build` — all green.

### Phase 7 — Browser Automation ✅ (committed to `develop`)
Playwright session primitives `@jobs-app/browser`: `BrowserSession`
(open/map/classify/mapValues/fill/fillQuestions/upload/gates/submit/verify/pause/resume/
cancel/close + audit events), `harvestForm`/`buildFields`/`inferType`/`selectorFor`,
scoring-based `mapFields` (never fabricates; unresolved `required` fields stop),
deterministic + AI-backfill `classifyQuestion` (captcha/mfa/identity/challenge/legal/
work-authorization are `stop` gates), `verifySubmission`
(`verified`/`failed`/`pending`/`inconclusive`), fixture pages + Playwright browser tests.
Verified: `typecheck`, `lint`, `test:unit` (280), `test:integration` (18), `build`,
`test:browser` (4) — all green.

### Phase 8 — Dashboard ✅ (committed to `develop`)
Next.js + MUI + TanStack Query: /dashboard, /jobs, /jobs/:id, /matches, /applications,
/applications/:id, /candidate(+evidence/cv), /automation, /sources, /settings, /audit.
Search/filter/pagination/sort/status/loading/error/empty states.
Verified: `typecheck`, `lint`, `test:unit` (297), `test:integration` (41), `build` — all green.

### Phase 9 — Scheduling & Notifications ✅ (committed to `develop`)
BullMQ repeatable discovery/matching, notifications channel (console + file), daily report;
limits (discovery/prep/submission) enforced; `@jobs-app/notifications` registry + daily report,
worker `limits`/`scheduler`/`processors`, `upsertSchedulers` on boot.
Verified: `typecheck`, `lint`, `test:unit` (321), `test:integration` (41), `build` — all green.

### Phase 10 — Hardening
Security review (threat model adherence), dependency/`npm audit`, coverage review, docs
review, failure-recovery verification, accessibility pass, fresh-clone dry run, final
checklist, tags/release notes conventions.

## Commit strategy per phase

- Branch: `feature/<phase-slug>` off `develop`.
- Commits: conventional, scoped, atomic; `test`/`docs`/`fix` interleaved with `feat`.
- Verify `typecheck→lint→tests→build` before each commit; review `git diff --staged`.
- Merge to `develop` (per instructions) — PR branch kept for review. No auto-push.

## Known risks & mitigation

| Risk | Mitigation |
|---|---|
| 3b model JSON quality | StructuredOutputParser retry/augment/reject; deterministic parser as floor |
| Scope size | Phase gates; no cosmetic shortcuts; ADRs cap decisions |
| Broken local Postgres | Docker Compose only; CI service containers |
| Browser fragility | Fixture-driven tests; human-in-the-loop stop points |
| Prompt injection | PromptManager data/instruction separation; Zod; no model-driven logic |

## Definition of done for the project

Fresh clone install/build/test works; docs accurate; migrations+seed work; Ollama
integration works locally; matching/application-generation/browser flows tested;
review mode honored; audit trails complete; CI green; security checks pass; no secrets;
no placeholder implementations; no unexplained TODOs.