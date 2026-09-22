# Roadmap

Planned work, ordered by release. We implement from the ground up: foundation first,
then intelligence, then automation. Nothing listed here is guaranteed or already complete —
see issue labels and [CHANGELOG.md](./CHANGELOG.md) for what actually shipped.

Legend: ✅ shipped · 🔜 in progress · ⬜ planned

## v0.1 — Foundation ✅/🔜

- ✅ Open-source repository structure (docs, license, CI, templates)
- 🔜 Monorepo: `apps/web`, `apps/api`, `apps/worker` + `packages/*`
- 🔜 Postgres/Redis via Docker Compose, Prisma migrations, seed data
- 🔜 Validated configuration (`packages/config`, Zod)
- 🔜 Structured logging and typed errors
- 🔜 Dashboard + API + worker shells with health checks

## v0.2 — Candidate Intelligence ⬜

- Candidate profile model (identity, experience, skills, projects, education)
- Evidence base as the single factual source of truth
- CV import and candidate validation
- AI-assisted CV parsing with evidence extraction
- Candidate evidence retrieval for generation and factuality checking

## v0.3 — Job Discovery ⬜

- `JobSource` interface + health checks
- Job normalization, storage, deduplication, expiry handling
- Requirement extraction (required/preferred/nice-to-have)
- Source registry with safe mock/fixture sources
- First community job source adapters (accessible sources only, no tos-bypassing)

## v0.4 — Matching Engine ⬜

- Deterministic weighted scoring (tech 30 / experience 20 / seniority 15 / role 15 / location 10 / domain 5 / salary 5)
- AI-assisted requirement interpretation (never substitutes for deterministic scoring)
- Hard filters and disqualifiers
- Explainable results: matched / partial / missing / evidence / confidence
- Match explanations surfaced in the dashboard

## v0.5 — Application Generation ⬜

- Tailored CV generation (PDF/DOCX)
- Cover letters (TXT/PDF)
- Application answers and recruiter message drafts
- Factuality validation: claim extraction → evidence comparison → unsupported-claim detection
- Material versioning pinned to each submission

## v0.6 — Browser Automation ⬜

- Playwright sessions with isolated contexts
- Form detection, field mapping, question classification
- File upload, pause/resume/retry/cancel, failure recovery
- Screenshots and audit logging
- Submission verification

## v0.7 — Human Review ⬜

- `safe` / `review` / `auto_apply` modes
- Stop points: CAPTCHA, MFA, identity verification, legal declarations,
  work authorization, sponsorship, unknown critical fields
- Review UI: question, AI suggestion, evidence, confidence, approve/edit/reject
- Resumable interrupted applications

## v0.8 — Analytics ⬜

- Pipeline metrics: discovered → matched → prepared → reviewed → submitted
- Source effectiveness, application outcomes, response tracking
- ✅ Daily reports and notifications

## v1.0 — Stable Release ⬜

- Hardening: security review, performance, dependencies, coverage, accessibility
- Documented failure-recovery procedures
- Community-contributed job sources and providers
- Formal release process with tag + GitHub release notes ✅ (conventions documented in CONTRIBUTING.md)

## Non-goals

- Mass / bulk spam applications (the human-in-the-loop and daily limits prevent this)
- Bypassing CAPTCHA, auth, rate limits, or anti-bot protections on any site
- Cloud hosting of candidate data by default
- Making match scores look like under-approving hiring predictions — scores are explanatory, not predictive

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and the `good first issue` label on GitHub.
Proposals for roadmap changes are welcome as issues or discussions.