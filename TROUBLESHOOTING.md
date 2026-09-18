# Troubleshooting

## `npm run dev` starts but the dashboard shows an error

The dashboard needs the API running on port 3100. Make sure you run `npm run dev`
(not just `npm run dev:web`), or start the API separately in another terminal:

```bash
npm run dev:api
```

Check the API health:

```bash
curl http://localhost:3100/health
```

## `database` connection refused

PostgreSQL must be running. Start the stack:

```bash
docker compose up -d postgres
docker compose ps
```

Check the connection directly:

```bash
PGPASSWORD=app psql -h localhost -p 15432 -U app -d jobs_applications -c "select 1;"
```

If the `psql` client is not installed locally, use the docker version:

```bash
docker compose exec postgres psql -U app -d jobs_applications -c "select 1;"
```

## Prisma migration fails / schema out of sync

Re-sync from scratch (this is fine for local development — it drops and recreates):

```bash
npm run db:reset
```

If you just changed the schema and need a new migration:

```bash
npx prisma migrate dev --name <describe-the-change> \
  --schema packages/database/prisma/schema.prisma
```

## Redis connection error

```bash
docker compose up -d redis
docker compose ps
```

Quick test:

```bash
curl -s http://localhost:6379   # should fail gracefully; try:
docker compose exec redis redis-cli ping
```

## Ollama is not responding

Make sure Ollama is running and the model is pulled:

```bash
ollama serve               # in another terminal if needed
ollama pull qwen2.5-coder:3b
curl http://localhost:11434/api/version
```

AI features degrade gracefully when Ollama is unavailable: the application will
return configuration/service errors but will not crash. Tests use
`MockLLMProvider` and do not need Ollama.

## `typecheck` fails with "cannot find module"

Make sure dependencies are installed after adding new workspace packages:

```bash
npm install
```

Check that the new package's `tsconfig.json` is included in the root `references[]`
and that the root `workspaces` array includes it.

## Browser tests fail with "Chromium not found"

Install the Playwright browser:

```bash
npx playwright install chromium
```

## `npm run test:integration` fails with "connection refused" errors

Integration tests need Postgres and Redis via Docker Compose:

```bash
docker compose up -d postgres redis
npm run test:integration
```

## A test passes locally but fails in CI

Common causes:

- The test contacts Ollama or a real site — use `MockLLMProvider` and fixture pages.
- The test writes to a file outside the expected workspace mount.
- The test assumes data from a previous test that ran in isolation locally.

## `npm run lint` complains about formatting

Auto-fix:

```bash
npm run format:write
npm run lint -- --fix
```

## How do I add a new package?

1. Create `packages/<name>/package.json` with `"name": "@jobs-app/<name>"`
   and `"private": true`.
2. Create `packages/<name>/tsconfig.json` extending the root base.
3. Add the package path to the root `workspaces` array in `package.json`.
4. Run `npm install`.
5. Add a `references[]` entry in the root `tsconfig.json`.
6. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full steps.

## I see a "reject" or "skip" state in a browser automation run

This is intentional. The default automation mode is `review` (see `.env`). A run
skips or pauses at security-sensitive stops (CAPTCHA, MFA, legal, work authorization,
unknown critical fields). Edit and approve in the dashboard, or switch to `safe` for
discovery-only behavior.

## I have a question or a security concern

- General questions: open a GitHub Discussion or Issue.
- Security vulnerabilities: **do not open a public issue** — follow
  [SECURITY.md](./SECURITY.md).