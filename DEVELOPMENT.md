# Development

Commands, workflows, and testing strategy for local development.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start dashboard (3000) + API (3100) in parallel |
| `npm run dev:web` | Dashboard only |
| `npm run dev:api` | API only |
| `npm run dev:worker` | BullMQ workers + scheduler |
| `npm run build` | Build all apps and packages |
| `npm run test` | All tests (unit + integration) |
| `npm run test:unit` | Unit tests only (fast, no external services) |
| `npm run test:integration` | Integration tests (needs docker compose up postgres redis) |
| `npm run test:browser` | Playwright browser tests |
| `npm run lint` | ESLint across the monorepo |
| `npm run typecheck` | TypeScript project-refs build (type-check only) |
| `npm run format:check` | Prettier formatting check |
| `npm run format:write` | Auto-fix formatting |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:seed` | Load development seed data |
| `npm run db:reset` | Drop → migrate → seed (dev only) |

## Architecture at a glance

```mermaid
flowchart TD
    UI[apps/web] --> API[apps/api]
    API --> DB[(PostgreSQL)]
    API --> REDIS[(Redis)]
    WORKER[apps/worker] --> REDIS
    WORKER --> DB
    WORKER --> AI[packages/ai] --> OLLAMA[Ollama]
    WORKER --> BROWSER[packages/browser]
```

See [ARCHITECTURE.md](./ARCHITECTURE.md).

## Environment variables

```env
NODE_ENV=development
DATABASE_URL=postgresql://app:app@localhost:5432/jobs_applications?schema=public
REDIS_URL=redis://localhost:6379

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:3b

AUTOMATION_MODE=review
JOB_MATCH_THRESHOLD=70
AUTO_APPLY_THRESHOLD=85
APPLICATION_DAILY_LIMIT=10

LOG_LEVEL=info
```

Copy `.env.example` → `.env` after cloning. The `.env.example` file documents every
variable with safe development defaults.

## Testing strategy

- **Unit tests** (`packages/*/src/**/*.test.ts`): Fast, mocked dependencies.
  Example: match scoring, requirement extraction, structured-output validation,
  error types.
- **Integration tests** (`packages/*/src/**/*.integration.test.ts`): Run against
  real Postgres and Redis. No Ollama; `MockLLMProvider` is used.
  Example: job storage + dedup, application creation, audit trail append.
- **AI tests** (`packages/ai/src/**/*.test.ts`): Mocked `MockLLMProvider` tests for
  structured-output parsing, factuality validation, prompt formatting, malformed-output
  handling.
- **Browser tests** (`packages/browser/test/`): Playwright against local fixture HTML
  pages (`tests/fixtures/browser/`). Never contacts real sites; never submits real
  applications.
- **End-to-end** (`apps/web/test/` or as added): Integration-level checks against
  running apps against the local docker compose stack.

### What is never tested against real external systems

- Real job sites
- Real application submissions
- Real Ollama in CI (mocked)

Ollama is needed only for local dev; CI uses `MockLLMProvider`.

## Fixtures

Reusable test fixtures live in `tests/fixtures/`:

```text
tests/fixtures/
  jobs/
  applications/
  candidate/
  browser/
  ai/
```

Use realistic but **fictional** data. Never commit real candidate CVs, real job
listings with identifying details, or real credentials. Fixtures are git-tracked
and shared across all developers.

## LLM testing

```ts
import { MockLLMProvider } from '@jobs-app/ai/testing';

const llm = new MockLLMProvider({
  structured: { /* return predefined Zod-safe objects */ }
});
```

You can also record a real Ollama session locally and replay it for deterministic
test runs — see [docs/guides/testing-with-the-llm.md](./docs/guides/testing-with-the-llm.md).

## Database workflow

```bash
# edit schema
vim packages/database/prisma/schema.prisma

# create migration
npx prisma migrate dev --name <describe-the-change> \
  --schema packages/database/prisma/schema.prisma

# apply + regenerate client
npm run db:migrate
npm run db:generate
```

## Adding a new package

1. Create `packages/<name>/` with `package.json` (name `@jobs-app/<name>`, `"private": true`)
   and `tsconfig.json` extending the root config.
2. Add it to the root `workspaces` array.
3. Run `npm install`.
4. Add entry in root `tsconfig.json` `references[]` and `npm:scripts`.
5. Write a small README in the package root.

## CI vs local

CI (GitHub Actions) runs `install → typecheck → lint → unit → integration → build`
with Postgres and Redis as **service containers**. Ollama is **not** required in CI —
all AI code uses `MockLLMProvider`.

If a test fails in CI but passes locally, check:

1. Does the test contact an external service without a mock?
2. Does it write to a path not backed by the CI job mount?
3. Does it assume Ollama is running?