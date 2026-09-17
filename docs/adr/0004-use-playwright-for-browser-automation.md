# ADR-0004: Use Playwright for browser automation

## Status

Accepted

## Context

Automating job applications requires driving a real browser: filling forms, uploading
files, waiting on async UI, detecting CAPTCHA/MFA gates, and verifying submission success.
We need reliable waiting, network interception, screenshots, persistent user-data-dir
options, and a robust API for multi-step sessions. Local-first means running on the
user's machine; tests must run against local fixtures and never against real sites.

## Decision

Use Playwright to implement browser automation in `packages/browser`. Sessions run in
isolated browser contexts. The package exposes a session interface (open, map fields,
fill, submit, verify, pause, resume, cancel) so the rest of the system never depends on
Playwright specifics.

## Alternatives Considered

- **Puppeteer** — comparable power, but Playwright has better cross-context isolation,
  auto-waiting, and fixture-friendly tooling.
- **Selenium WebDriver** — heavier, slower, and less ergonomic for instrumented local
  automation.
- **raw CDP** — too low-level to maintain as a contributor-facing layer.

## Consequences

**Benefits**

- Reliable selectors with auto-wait, network events, screenshots, per-context isolation.
- Tests run against local fixture HTML (no real sites, no real submissions in tests).
- Well-maintained, MIT/generous licensing, huge contributor base.

**Tradeoffs**

- Downloads browsers (~100+ MB) — documented; CI installs only Chromium.
- JS-heavy sites can occasionally change selectors; mitigated by the
  `FormDetector`/`FieldMapper` layer and by human-in-the-loop review.

**Risks**

- Never bypass security controls (CAPTCHA, MFA, auth, rate limits, robots, paywalls),
  and automation is only offered where permitted/appropriate; otherwise a manual
  workflow is provided. See [SECURITY.md](../SECURITY.md) and the automation
  architecture doc.