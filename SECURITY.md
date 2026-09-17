# Security

**Please do not open a public issue to report a security vulnerability.**

## Reporting a vulnerability

Report vulnerabilities privately via GitHub's Security Advisories feature:

- Go to <https://github.com/<owner>/<repo>/security/advisories/new>
- or email the maintainers at the address configured in the repository description.

**Never include credentials, live CV data, cookies, or session material in a report or issue.**

Things we care most about:

- Leaking candidate data (CVs, evidence, application materials) outside the machine
- Leaking secrets, tokens, cookies, or session data to logs or to model providers
- Injection into prompts via untrusted job/candidate content (prompt injection)
- Path traversal / unsafe file handling in document generation or browser automation
- Weak session/auth handling on the local web dashboard
- Committing secrets to the repository by accident

## Supported surfaces

The dashboard and API bind to `127.0.0.1` by default and are intended for local use.
If you expose them beyond localhost, you are taking on transport security, authentication,
CSRF, and rate-limit responsibilities yourself — see [docs/architecture/threat-model.md](./docs/architecture/threat-model.md).

## Reporting expectations

We will acknowledge receipt of a report promptly, work on a fix, and — together with you —
decide on a coordinated disclosure timeline. Reasonable reports are appreciated and
attributed unless you prefer anonymity.

## Security properties of the project

- Candidate data stays on the machine by default; nothing is sent to external AI APIs
  without explicit configuration.
- Browser automation uses isolated browser contexts; cookies and session data are never
  passed to the model or logged.
- All AI output is validated with Zod and never trusted as executable/business logic.
- Structured logging never includes credentials.
- `.env`, browser profiles, and generated materials are gitignored; CI fails on secret
  leaks (`security.yml`).
- Dependency vulnerabilities are monitored by Dependabot and `npm audit` in CI.

## Disclosures

For the security report template and how to escalate private findings, see
[.github/ISSUE_TEMPLATE/security.md](./.github/ISSUE_TEMPLATE/security.md).