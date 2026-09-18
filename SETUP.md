# Setup

Complete guide to getting the project running locally.

## Prerequisites

| Requirement | Minimum | Notes |
|---|---|---|
| Node.js | >= 22 | `.nvmrc` pins the version; use `nvm install && nvm use` |
| npm | >= 11 | ships with recent Node |
| Docker | >= 24 | Docker Desktop or Docker Engine on Linux |
| Ollama | >= 0.3 | needed only for AI features |
| Playwright Chromium | — | installed via `npx playwright install chromium` |

PostgreSQL and Redis run inside Docker during local development. You do **not**
need to install them natively.

## 1. Clone and install

```bash
git clone <repository-url>
cd jobs-applications
npm install
```

## 2. Environment

```bash
cp .env.example .env
```

`Docker Compose` starts Postgres and Redis on the default ports and addresses
matching `DATABASE_URL` and `REDIS_URL` in `.env`. Do not change them unless you
know what you are doing.

## 3. Start Postgres and Redis

```bash
docker compose up -d postgres redis
docker compose ps          # both should be healthy
```

## 4. Database migrations + seed

```bash
npm run db:migrate
npm run db:seed
```

This creates the schema and loads fictional development data. To reset:

```bash
npm run db:reset
```

## 5. Start Ollama (for AI features)

```bash
ollama serve              # in a separate terminal if not running already
ollama pull qwen2.5-coder:3b
```

Verify:

```bash
curl -s http://localhost:11434/api/version
```

## 6. Install Playwright browsers (for browser features)

```bash
npx playwright install chromium
```

## 7. Start the application

```bash
npm run dev
```

- Dashboard: <http://localhost:3000>
- API health: <http://localhost:3100/health>

In a second terminal:

```bash
npm run dev:worker
```

This starts the BullMQ workers and scheduler.

## 8. Running tests

```bash
npm run test:unit         # fast, no Docker needed
```

With Postgres + Redis running (docker compose):

```bash
npm run test:integration  # uses real DB/Redis, mocked LLM
npm run test:browser      # Playwright against local fixture pages
```

All tests in CI run against containerized databases; Ollama is mocked everywhere.

## Services and ports

| Service | Port | Notes |
|---|---|---|
| Dashboard | 3000 | Next.js dev server |
| API | 3100 | Fastify dev server |
| PostgreSQL | 15432 | via `docker compose` (host port) |
| Redis | 6380 | via `docker compose` (host port) |
| Ollama | 11434 | local Ollama server |

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

## Next steps

- [DEVELOPMENT.md](./DEVELOPMENT.md) — commands and workflow reference
- [ARCHITECTURE.md](./ARCHITECTURE.md) — how the system is designed
- [CONTRIBUTING.md](./CONTRIBUTING.md) — how to contribute