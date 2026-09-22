# Contributing

Thank you for your interest in contributing to **jobs-applications**. This guide is written so a contributor who knows nothing about the project can go from `git clone` to running tests.

## What this project is

A privacy-first, local-first AI job discovery, matching and application assistant. It runs on Ollama, keeps candidate data on your machine, and requires human approval before any submission. See [README.md](./README.md) and [ARCHITECTURE.md](./ARCHITECTURE.md).

## Repository layout

```text
apps/
  web/          Next.js + MUI dashboard
  api/          Fastify REST API
  worker/       BullMQ background workers + scheduler
packages/
  config/       validated application configuration (Zod)
  database/     Prisma schema, migrations, seed
  shared/       shared domain types, errors, logging
  candidate/    candidate knowledge base + evidence
  ai/           LLM provider abstraction, prompts, structured outputs, validation
  jobs/         JobSource interface, normalization, dedup, requirement extraction
  matching/     deterministic + AI-assisted scoring
  documents/    CV / cover letter generation, factuality validation, versioning
  browser/      Playwright sessions, form detection, human-in-the-loop
  applications/ application lifecycle + audit trail
  notifications/ notification channel abstraction
docs/
  adr/          architecture decision records
  guides/       how-to guides
  architecture/ deeper design notes
tests/
  fixtures/     reusable, realistic-but-fictional test fixtures
```

## Prerequisites

- Node.js >= 22 (`nvm install && nvm use`, or match `.nvmrc`)
- npm >= 11
- Docker (for PostgreSQL + Redis in dev)
- Ollama with a model pulled (default `qwen2.5-coder:3b`) — required only for AI features, not for running tests
- Playwright Chromium: `npx playwright install chromium`

## Environment setup

```bash
git clone <repository-url>
cd jobs-applications
npm install
cp .env.example .env
docker compose up -d postgres redis
npm run db:migrate
npm run db:seed
```

Generated `.env` values are correct for local development. Do not commit `.env`.

## Running services

| Command | What it runs |
|---|---|
| `npm run dev` | Dashboard (port 3000) + API (port 3100) |
| `npm run dev:worker` | BullMQ workers + scheduler |
| `npm run dev:web` | Dashboard only |
| `npm run dev:api` | API only |

## Running tests

```bash
npm test                    # all tests
npm run test:unit           # unit tests (fast, no external services)
npm run test:integration    # integration tests (needs Postgres/Redis via docker compose)
```

Tests never contact a real job site or submit a real application. The `ai` provider is mocked, and browser tests run against local fixture HTML pages.

## Running lint, typecheck, build

```bash
npm run lint
npm run typecheck
npm run build
```

## Database migrations

Migrations live in `packages/database/prisma/migrations`.

```bash
npm run db:migrate          # apply migrations
npm run db:generate         # regenerate Prisma client
npm run db:seed             # load development seed data
npm run db:reset            # drop, migrate, seed (destructive; dev only)
```

When you change `packages/database/prisma/schema.prisma`:

1. Edit the schema.
2. Create a migration with a descriptive name:
   ```bash
   npx prisma migrate dev --name <describe-the-change> --schema packages/database/prisma/schema.prisma
   ```
3. Keep the migration focused; do not bundle unrelated schema changes.

## Running Ollama

Ollama must be running for AI features:

```bash
ollama serve
ollama pull qwen2.5-coder:3b
```

Config: `OLLAMA_BASE_URL=http://localhost:11434`, `OLLAMA_MODEL=qwen2.5-coder:3b`.

## Running workers

`npm run dev:worker` starts the BullMQ workers (discovery, parsing, matching, document generation, browser automation, notifications). They need Redis: `docker compose up -d redis` or a local Redis on `REDIS_URL`.

## Running browser tests

```bash
npm run test:browser
```

Browser tests use Playwright against local fixture pages (`tests/fixtures/browser/`). Install the browser with:

```bash
npx playwright install chromium
```

## Branch naming

```text
feature/<name>        new functionality
fix/<name>            bug fixes
docs/<name>           documentation
refactor/<name>       behavior-preserving refactors
test/<name>           tests only
chore/<name>          maintenance
ci/<name>             CI/CD changes
```

Example: `feature/job-matching-engine`, `fix/job-deduplication`, `docs/contributing-guide`.

## Commit convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`, `perf`, `security`, `style`.

Good examples:

```text
feat(matching): implement weighted requirement scoring
test(matching): cover missing-salary job edge case
fix(browser): persist interrupted application state
docs(contributing): document local development workflow
```

Rules:

- Commit logically complete work. Never commit broken code.
- Keep commits focused — don't mix unrelated changes.
- Run `npm run lint`, `npm run typecheck` and the relevant tests before committing.
- Review with `git diff --staged` before committing.
- Never commit `.env`, secrets, cookies, browser profiles, or private candidate data.

Always use `--no-verify` is **not** a thing here — if a pre-commit check would catch a problem, fix the problem.

## PR process

1. Create a branch from `develop` (or `main` if you are fixing a release blocker): `git checkout -b feature/my-feature`.
2. Implement, test, and commit according to the conventions above.
3. Push and open a PR against `develop`.
4. Use the PR template (fill in Summary, Motivation, Changes, Testing, Security Considerations, Documentation, Checklist).
5. Keep PRs small and reviewable. Split big changes into stacked PRs when possible.
6. Expected checks on a PR: typecheck, lint, unit tests, integration tests, build. Make them pass.
7. CI runs with mocked LLM and containerized Postgres/Redis — you do **not** need Ollama locally for CI.

## Code style

- Strict TypeScript. No `any` except in explicitly documented escape hatches (and even then prefer `unknown` + narrowing).
- Small services over giant classes. Explicit dependencies over hidden globals.
- Never duplicate business logic; if something is reused, extract it into a package.
- Follow the existing patterns in the package you touch before inventing new ones.
- No magic numbers: name constants.
- Structured, typed errors; never `throw new Error('something failed')` where a semantic error type exists.
- Formatting and lint are enforced by ESLint + Prettier:

```bash
npm run lint
npm run format:check
npm run format:write
```

## Adding a new job source

Sources implement `JobSource` in `packages/jobs/src/sources/`. The full guide is at [docs/guides/adding-a-job-source.md](./docs/guides/adding-a-job-source.md). In short:

```ts
class ExampleJobSource implements JobSource {
  name = 'example';
  async search(params: JobSearchParams): Promise<Job[]> { /* ... */ }
  async getJob(url: string): Promise<Job> { /* ... */ }
  async healthCheck(): Promise<boolean> { /* ... */ }
}
```

- Return normalized jobs (the package normalizes further).
- Register the source in the source registry.
- Never bypass CAPTCHA, auth, rate limits, robots/access controls or anti-bot protections. If the source does not permit automation, provide a manual workflow and document it.

## Adding an AI provider

`LLMProvider` in `packages/ai/src/providers/` is the seam. Guide: [docs/guides/adding-an-ai-provider.md](./docs/guides/adding-an-ai-provider.md).

You implement `complete()`, `chat()`, `structured()` and `healthCheck()` — keep formatting/prompting in `PromptManager` and validation in `StructuredOutputParser`, not in the provider.

## Adding a browser adapter

Browser automation is isolated in `packages/browser`. Adapters (Playwright is the reference) implement the session interface and must not contain business rules. Guide: [docs/guides/adding-a-browser-adapter.md](./docs/guides/adding-a-browser-adapter.md).

## Adding tests

- Unit tests: `packages/*/src/**/*.test.ts` via Vitest.
- Integration tests: `packages/*/src/**/*.integration.test.ts` — use real Postgres/Redis.
- AI tests: mock the provider (`packages/ai/src/testing/` provides `MockLLMProvider`).
- Browser tests: `packages/browser/test/` against fixture pages.
- Fixtures live in `tests/fixtures/` and must use realistic but **fictional** data only.

Every PR that changes behavior should add or update tests. Use `npm run test:unit -- <package>` to run a subset.

## Good first issues

We tag GitHub issues with `good first issue` for beginner-friendly work:

- Documentation improvements (docs/*)
- Additional test coverage and edge cases (test/*)
- UI polish on the dashboard (apps/web)
- New fixture data (tests/fixtures)
- New mock/safe job source adapters (packages/jobs)
- AI prompt improvements with recorded before/after output (packages/ai)
- Developer tooling (chore/*, ci/*)

Ways to find them: the `good first issue` label, or the issue templates. If an issue is unassigned, drop a comment and we will help you get oriented. See also [ROADMAP.md](./ROADMAP.md) for incoming work areas.

## Releases & tags

- Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html); the
  changelog is [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) — see
  [CHANGELOG.md](./CHANGELOG.md) and update it in the same PR as the change.
- `develop` is the integration branch; `main` holds released code only.
- To release: open a PR from `develop` into `main` that moves `[Unreleased]` into a
  `[<version>] - <YYYY-MM-DD>` section, then, after merge, create an annotated tag on
  `main`: `git tag -a v<MAJOR>.<MINOR>.<PATCH> -m "Release <version>"`.
- Tag format: `v<MAJOR>.<MINOR>.<PATCH>` (e.g. `v0.1.0`). Only `main` is tagged.
- GitHub release notes are assembled from the CHANGELOG entries for that version.
- Pre-`1.0.0` minor bumps are expected to carry breaking changes.

## Code of conduct

Please note our [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) — be excellent to each other.

## Questions

Open a discussion or issue. For security problems, do **not** open a public issue — see [SECURITY.md](./SECURITY.md).