# @jobs-app/browser

Privacy-safe, Playwright-backed session primitives for human-gated job
applications. Phase 7 of the build. The package contains **no business rules** —
it maps form fields, classifies questions, detects security gates, fills and
submits a page, and verifies the outcome, while stopping whenever a human
decision is required.

## Surface

- **`BrowserSession`** — one isolated Playwright session per application.
  - `open(url)` / `close()` — launch a persistent context in a per-session
    `userDataDir` (cleanup on close); `pause()` / `resume()` halts the closing
    flow for a human.
  - `map()` — harvest visible form controls (`harvestForm`, capped at 200) and
    build `FormField`s (`buildFields`): radio inputs are grouped by `name` with
    their options, selects carry their `<option>` labels, hidden/submit/button
    controls are skipped.
  - `mapValues(fields, values)` / `fill(...)` — score each known `AvailableValue`
    against every field (exact → aliases → fuzzy) with `high`/`medium`/`none`
    confidence. Nothing is fabricated: unmatched fields keep `value: null` and an
    unresolved **required** field stops submission.
  - `classify(fields)` / `fillQuestions(...)` — tag open-ended fields as
    questions and classify them deterministically (strong → `high`, weak →
    `medium`, unknown → `low` and `requiresHuman`). Deterministic-unknown
    questions fall back to an AI classifier backend
    (`AiQuestionClassifierBackend`) at `temperature: 0`.
  - `upload(field, paths)` — attach local files to a `file` field (supports
    multi-file via a hidden `input[type=file]` shim).
  - `gates()` / `submit()` — `detectGates` re-scans the page before submit;
    `stop` gates (captcha, mfa/2fa, identity, challenge, legal, work
    authorization) throw `SessionBlockedError` instead of submitting.
  - `verify()` — classify the post-submit page into
    `verified` / `failed` / `pending` / `inconclusive` from success/failure
    markers.
  - `eventsList()` — an append-only audit trail of typed `SessionEvent`s. Events
    carry labels, sources and confidence — **never field values**.
- **`harvestForm` / `buildFields` / `inferType` / `isRequired` / `looksLikeQuestion` /
  `selectorFor`** — pure, unit-testable DOM helpers.
- **`classifyQuestion`** + `RULES` — deterministic question taxonomy; stop
  categories short-circuit (`stop: true`).
- **`detectGates` / `verifySubmission`** — deterministic marker lists in
  `gates.ts` / `verify.ts`.

## Rules

- Session data (cookies, DOM values, submitted answers) is **never** exposed to
  the model or the dashboard API; only metadata and events leave a session.
- CAPTCHA/2FA/identity/legal/work-authorization gates and any fabricatable-value
  situation are hard stops for `submit()`. `review` mode pauses for the human at
  every stop point.
- The classifier, gates and verifier are deterministic rule floors; AI is only a
  backfill for deterministic-unknown questions and mistrusted prompts.
- Tests use local fixture pages (`tests/fixtures/`); browser tests **never
  contact real job sites and never submit real applications.**

## Testing

- `npm run test:unit -w @jobs-app/browser` — unit tests for detect/map/classify/
  gates/verify/ai-question.
- `npm run test:browser -w @jobs-app/browser` — Playwright integration against a
  small static fixture server (`tests/server.mjs`, port 8787):
  happy-path end-to-end submit, CAPTCHA stop, unresolved-required stop, radio/
  select mapping + file upload. Requires Playwright's Chromium
  (`npx playwright install chromium-headless-shell`).