# Threat Model

Local-first, single-machine deployment with an eye toward safe exposure.

## Assets

| Asset | Value | Risk concern |
|---|---|---|
| Candidate profile, CVs, evidence | Highest | Personal data leakage |
| Application materials + submissions | High | Misrepresentation, leakage |
| Browser session state | High | Session hijack, cross-user leakage |
| Job/matching analysis | Medium | Prompt injection surface |
| Local secrets (.env, cookies) | High | Credential compromise |
| Ollama host access | Medium | RCE if model output were executed (it is not) |

## Trust boundaries

1. **Local machine** — trusted (the operator's machine).
2. **Web app + API (127.0.0.1)** — semi-trusted; all inbound HTTP is attacker input.
3. **External websites (job sources, ATS pages)** — **untrusted**. Their HTML/JS text
   can contain prompt injection, malicious links, or tracker content.
4. **Ollama model output** — **untrusted**. Never executed, never controls business logic.

## Attack vectors and mitigations

### Prompt injection via external content (job listings, site text)

- Site-provided text is untrusted input. It is never concatenated into instructions
  that can override application rules.
- `PromptManager` separates instructions from data (`<data>` delimiters), and
  model output is validated with Zod; anything outside the schema is rejected.
- Matching and requirement extraction are deterministic by default; AI only interprets.

### Executing model output

- Model output is never used as code and never evaluated. It is data validated by Zod,
  and state changes always flow through application services.
- Browser automation treats extracted form actions as data; sensitive gates stop for
  human review.

### Credential / session leakage

- Cookies, tokens and passwords are never sent to the model.
- Browser sessions persist in an isolated `userDataDir` (gitignored).
- Logs are structured and redact credential fields; CI fails on leaked secrets.

### Local dashboard exposure

- Bind to `127.0.0.1` by default. If exposed beyond localhost, the operator accepts
  responsibility for: TLS, authentication, CSRF, rate limiting, and secrets handling.
  Documented in SECURITY.md.

### Dependency supply chain

- Dependabot + `npm audit` in CI (`.github/workflows/security.yml`).
- Dependencies added only against the criteria in CONTRIBUTING.md (maintained, license
  compatible, no gratuitous complexity).

### File upload / path traversal (CV import, generated docs)

- Document storage writes derived files under a single root, with slug/path validation
  using `path.normalize` and segment checks. No user-controlled directory traversal.
- Uploads are validated by extension and size; content is parsed, never executed.

## Residual risk notes

- The operator ultimately authorizes any submission (default `review` mode). The tool
  cannot make submission decisions for them, by design.
- A machine compromise (attacker with shell access) can read everything; local secrets
  follow standard OS protections.