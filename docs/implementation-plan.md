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

### Phase 1 — Application Foundation
Monorepo + TS strict + config + logging + errors + Postgres/Redis (compose) + Prisma
schema/migrations/seed + API shell (Fastify, /health) + worker shell (BullMQ, queues) +
dashboard shell (Next.js, health page).

### Phase 2 — Candidate Intelligence
Candidate profile + experience + skills + projects + education + certifications +
achievements + evidence; repositories, services, validation; CV import (text); seed data.

### Phase 3 — AI
`LLMProvider`, `OllamaProvider`, `MockLLMProvider`, `ModelRouter`, `PromptManager`,
`StructuredOutputParser`, `AIValidator`; evidence retrieval; tests incl. malformed JSON,
timeouts, unavailable Ollama.

### Phase 4 — Jobs
JobSource interface + registry, normalization, deduplication (fingerprint unique index),
requirement extraction (deterministic + AI-assisted), source health, mock/fixture sources;
edge-case tests.

### Phase 5 — Matching
Deterministic weighted scoring, hard filters/disqualifiers, explainable results,
confidence, persistence; AI-assisted interpretation only where deterministic data is thin.

### Phase 6 — Application Generation
Material model + versioning, tailored CV + cover letter + answers generation,
factuality validation pipeline (claim extraction → evidence comparison → unsupported claim
detection → regenerate/review), PDF/DOCX/TXT output, snapshot pinned per submission.

### Phase 7 — Browser Automation
Playwright session (open/map/fill/answer/upload/submit/verify/pause/resume/cancel),
FormDetector, FieldMapper, QuestionClassifier, CAPTCHA/MFA/legal/work-auth detection,
SubmissionVerifier, audit events, fixture pages, browser tests.

### Phase 8 — Dashboard
Next.js + MUI + TanStack Query: /dashboard, /jobs, /jobs/:id, /matches, /applications,
/applications/:id, /candidate(+evidence/cv), /automation, /sources, /settings, /audit.
Search/filter/pagination/sort/status/loading/error/empty states.

### Phase 9 — Scheduling & Notifications
BullMQ repeatable discovery/matching, notifications channel, daily report; limits
(discovery/prep/submission) enforced.

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