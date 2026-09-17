# Privacy

Privacy is a core product feature, not a compliance afterthought. This document states
exactly what data exists, where it lives, and what leaves the machine.

## What data is stored

| Data | Where | Notes |
|---|---|---|
| Candidate identity + contact | Local PostgreSQL | Never coerced; presence is optional |
| Experience / projects / education / certifications / achievements | Local PostgreSQL | |
| Candidate evidence records | Local PostgreSQL | Factual source of truth for generation |
| Job discoveries | Local PostgreSQL | Normalized + raw snapshot fields |
| Matches and explanations | Local PostgreSQL | |
| Application materials (CV / cover letter / answers) | Local PostgreSQL + generated artifacts on disk | Versioned |
| Applications + events (audit trail) | Local PostgreSQL | |
| Browser session state | Isolated `userDataDir` under `data/browser-profiles/` (gitignored) | Per-session scope |
| Logs | Local files/console | Structured, credential-free |

## What goes to Ollama

Only the payload required for a specific operation is sent to the local Ollama server:

- requirement extraction: job text + prompt
- matching interpretation: job text + candidate skill summary (no session cookies)
- document generation: job text + relevant evidence slices (selected by the caller)
- factuality validation: candidate claims + evidence slices

**No authentication tokens, no cookies, no browser session data, no passwords, and no
raw evidence dumps** are ever sent to the model unless a caller explicitly selects
minimal slices for a defined feature.

## What never leaves the machine by default

- Candidate data is **never** sent to external AI APIs or any third party.
- Only local Ollama is called, and you can operate fully offline after model download.
- No telemetry is collected by the project.

If a user later configures an external provider (e.g. a hosted LLM) via the provider
abstraction, that is explicit and per-provider; it is never the implicit default.

## What external job sources receive

- Whatever you search for (queries) and whatever a manual/automated visit to their
  site naturally exchanges (HTTP traffic including your IP and browser fingerprint
  when browsing).
- Nothing from your candidate profile is sent to a job listing site by our code.
- We never log the content of fields filled into forms with sensitive values beyond
  the audit trail metadata (which fields, which timestamps), and we scrub values that
  look like credentials.

## What browser sessions store

- Isolated profile data under `data/browser-profiles/` (gitignored), preserved only so
  an interrupted application can resume.
- Cookies and site state are never exposed to the model or the API.
- Sessions can be deleted at any time; deleting a profile removes those cookies/state.

## How data can be deleted

- **Dashboard**: candidate, jobs, applications, and audit entries can be deleted in the
  UI.
- **CLI**: `npm run db:reset` drops and recreates the development database.
- **Cookies/sessions**: delete `data/browser-profiles/` (or stop the session),
  or remove the container volume for the compose stack.
- **Everything**: stop containers, remove the `data/` directory and the compose volume.

## Design invariants

1. External AI is always opt-in, never default.
2. Model input is minimized to a feature's exact need.
3. Logs never contain credentials or session tokens.
4. Evidence and materials are yours; nothing is federated.
5. Deletion is possible and documented above.