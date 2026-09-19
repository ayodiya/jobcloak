# @jobs-app/matching

Deterministic, explainable job matching for the single local candidate.
Scores a job against the candidate profile dimension-by-dimension, applies hard
disqualifiers, estimates confidence from how much evidence supported the result,
and persists the outcome idempotently (one match per job). Phase 5 of the build.

## Surface

- **`MatchingService`** — orchestration: `matchJob(jobId)` loads the candidate
  profile and the job, scores them, and persists the result; `matchAll(source?)`
  does this best-effort for every active job. `loadCandidate` / `loadJob`
  defaults read through `CandidateRepository` and `JobRepository` and can be
  swapped for tests.
- **`scoreJob`** — the pure scorer. Seven weighted dimensions (tech 30,
  experience 20, seniority 15, role 15, location 10, domain 5, salary 5), each
  returning a 0–1 score plus evidence. Non-applicable dimensions are excluded
  from the weighted average; the total is re-normalized over the applicable set.
- **`MatchRepository`** — Prisma persistence for `JobMatch` / `JobMatchDimension`.
  Re-matching a job replaces its dimensions atomically; `getMatch`, `listMatches`,
  `countMatches` support the review surface.
- **`lexicon`** — small deterministic vocabularies: seniority bands, role
  keywords, industry domains, sponsorship-marker detection.
- **`experience` / `weights`** — merged overlap-aware experience totals and the
  weight table (guaranteed to sum to 100).

## Rules

- Scoring is deterministic and local; AI learns nothing during scoring. It is a
  suitability indicator for the one candidate, never a hiring prediction.
- Hard disqualifiers (missing mandatory work authorization while the listing
  demands it; required experience ≥ 8y with the candidate below half of that)
  set `eligible = false` but the job is still scored and shown.
- Confidence starts at 1.0 and is reduced when evidence was thin: AI-sourced
  requirements, short descriptions, undisclosed salary, sparse skills or
  experience, few applicable dimensions.
- A job is matched at most once; repeated `matchJob` calls update in place and
  never duplicate (keyed on the unique `jobId`).
- Matching consumes only the local candidate profile and local job data —
  nothing leaves the machine in this phase.