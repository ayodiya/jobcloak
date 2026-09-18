# @jobs-app/jobs

Job discovery and normalization. Sources (API, fixture, manual) produce job
listings; this package validates, canonicalizes, deduplicates and persists them
with structured requirements and source-health telemetry. Phase 4 of the build.

## Surface

- **`JobService`** — orchestration: `discover({ sourceName, params, useAI })`
  fetches a source, normalizes each listing, dedupe-upserts by
  `(sourceName, fingerprint)`, extracts requirements and records source health.
  Discovery is best-effort: a failing source is recorded unhealthy and reported
  in the summary, it never throws.
- **`normalize`** — `parseJob` (zod boundary that rejects malformed listings),
  `normalizeJob` (plain-text description, canonical URL, sha1 fingerprint,
  derived `remote` flag, best-effort salary), `detectRemote`, `parseSalary`,
  `toPlainText`.
- **`requirements`** — deterministic, offline requirement extraction
  (section-aware Required/Preferred/NiceToHave, skill lexicon, years,
  education, language). Deterministic extraction is the baseline.
- **`requirements-ai`** — optional AI-assisted extraction via an
  `LLMProvider`; the model can only add keys the deterministic pass missed and
  its output falls back silently on `AIProviderError` / `AIValidationError`.
- **`JobSource` / registry / `FixtureJobSource`** — the source seam. Register
  factories by name; the `fixture` source ships built-in for tests and demos.
- **`JobRepository`** — Prisma persistence for jobs, requirements and source
  health; translates unique violations and missing rows into shared errors.

## Rules

- Every listing passes `JobInputSchema` before it can be persisted; malformed
  entries are counted as rejected.
- Deduplication is deterministic: sha1 over `(host, normalizedUrl)` where
  `normalizeUrl` strips tracking params, default ports, `www.` and fragments.
- Deterministic requirements always win; AI output is a strict subset merge.
- Sources must respect robots.txt, terms, rate limits and access controls;
  never bypass CAPTCHA, authentication, paywalls or anti-bot protections.
- Everything is local: no job data leaves the machine in this phase.