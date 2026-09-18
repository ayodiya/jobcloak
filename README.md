# Jobs Applications — Local-First AI Job Assistant

A privacy-first, locally operated AI job discovery, matching and application assistant.
It runs entirely on your machine: [Ollama](https://ollama.com) + a local model (default `qwen2.5-coder:3b`) power the AI features, and no candidate data is sent to external AI APIs by default.

**This is not recruitment spam automation.** Human approval is required before anything is submitted. The system is built as a professional, testable, open-source project.

---

## Why it exists

Job research produces a mountain of manual, repetitive work: reading descriptions, comparing them against your real experience, drafting tailored documents, and filling in repetitive forms. Most tooling for this uploads your CV to a third party.

This project keeps the entire pipeline local so your candidate data stays on your machine, while making every step **evidence-based**, **explainable**, and **reviewable**.

## Features

- **Local-first AI** — Ollama provider abstraction; model is configurable, never hard-coded
- **Candidate knowledge base** — identity, experience, skills, projects, education, certifications, achievements, evidence
- **Evidence-backed generation** — CVs and cover letters are built from your real evidence; a factuality validator flags unsupported claims
- **Pluggable job sources** — clean `JobSource` interface, isolated sources, no tos-bypassing
- **Explainable matching** — deterministic weighted scoring with matched/partial/missing requirements and confidence
- **Browser automation** — Playwright-based sessions with pause/resume/retry, human-in-the-loop stop points (CAPTCHA, MFA, legal declarations, work authorization)
- **Full audit trail** — every application is reproducible: job snapshot, match result, materials versions, model + prompt version, timestamps
- **Dashboard** — Next.js + MUI dashboard: jobs, matches, applications, candidate, automation, sources, settings, audit
- **Scheduling** — BullMQ + Redis background workers for discovery, matching, document generation, notifications

## Architecture

```mermaid
flowchart TD
    UI[apps/web — Next.js + MUI + TanStack Query]
    API[apps/api — Fastify]
    DB[(PostgreSQL)]
    REDIS[(Redis)]
    QUEUE[BullMQ]
    WORKER[apps/worker — BullMQ workers]
    OLLAMA[Ollama — local model]
    BROWSER[Playwright — isolated contexts]
    AI[packages/ai — provider + router + validator]

    UI --> API --> DB
    UI --> API --> REDIS
    WORKER --> REDIS
    WORKER --> DB
    WORKER --> AI --> OLLAMA
    WORKER --> BROWSER
```

Full details in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Requirements

| Component | Requirement |
|---|---|
| Node.js | >= 22 (see `.nvmrc`) |
| Package manager | npm >= 11 |
| Docker | >= 24 (for PostgreSQL + Redis in dev) |
| Ollama | >= 0.3 with a model pulled (default `qwen2.5-coder:3b`) |
| Playwright browsers | `npx playwright install chromium` |

## Installation

See [SETUP.md](./SETUP.md) for the complete guide. Quick start:

```bash
git clone <your-fork-or-this-repo>
cd jobs-applications
npm install

cp .env.example .env

docker compose up -d postgres redis
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma

ollama pull qwen2.5-coder:3b   # if you have not pulled it yet

npm run dev
```

- Dashboard: <http://localhost:3000>
- API health check: <http://localhost:3100/health>
- Worker logs: in the `npm run dev:worker` terminal

## Configuration

All configuration is validated through Zod and lives in `.env` (see `.env.example`).

```env
NODE_ENV=development

DATABASE_URL=postgresql://app:app@localhost:15432/jobs_applications?schema=public
REDIS_URL=redis://localhost:6380

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:3b

AUTOMATION_MODE=review           # safe | review | auto_apply
JOB_MATCH_THRESHOLD=70
AUTO_APPLY_THRESHOLD=85
APPLICATION_DAILY_LIMIT=10

LOG_LEVEL=info
```

See [DEVELOPMENT.md](./DEVELOPMENT.md) for the full reference of commands:

```bash
npm run dev              # dashboard + API
npm run dev:worker
npm test                 # all tests
npm run lint
npm run typecheck
npm run build
npm run db:migrate
npm run db:seed
```

## Supported AI models

Any model served by Ollama at `OLLAMA_BASE_URL`. Tested with:

- `qwen2.5-coder:3b` (default)
- `qwen2.5-coder:7b`
- `llama3.1:8b`

Structured outputs are supported through Ollama's JSON/tool mode; output is always validated with Zod and never trusted blindly.

## Supported job sources

The `JobSource` interface is designed so any accessible source — public listings and employer ATS pages that permit it — can be added. See [docs/guides/adding-a-job-source.md](./docs/guides/adding-a-job-source.md). The repository includes a safe HTML **mock source** used in development and tests. The project does **not** bypass CAPTCHAs, auth, rate limits, robots directives, or anti-bot protections; if automation is not permitted, a manual workflow is provided instead.

## Automation modes

| Mode | Description |
|---|---|
| `safe` | Discovery and preparation only. Nothing is ever submitted automatically. |
| `review` (default) | Materials are prepared to review; browser sessions pause at every stop point. |
| `auto_apply` | Approved templates submit automatically, still stopping at CAPTCHA, MFA, legal and uncertain-sensitivity gates. |

Daily submission limits are configurable and conservatively defaulted (`APPLICATION_DAILY_LIMIT=10`).

## Security & privacy

- Candidate data stays local. Nothing is sent to external AI APIs unless you explicitly configure a provider that does and elect to use it.
- Browser automation uses isolated contexts; cookies and session data are never exposed to the model.
- Credentials and tokens are never logged.
- See [SECURITY.md](./SECURITY.md) and the [privacy](./docs/architecture/privacy.md) document.

## Development

- [SETUP.md](./SETUP.md) — prerequisites, local stack
- [DEVELOPMENT.md](./DEVELOPMENT.md) — commands, workflows, testing
- [ARCHITECTURE.md](./ARCHITECTURE.md) — system design, boundaries, ADRs
- [CONTRIBUTING.md](./CONTRIBUTING.md) — how to contribute
- [docs/guides/](./docs/guides/) — how-to guides (adding a job source, adding an AI provider, browser adapter, running tests)

## Roadmap

See [ROADMAP.md](./ROADMAP.md).

## License

MIT — see [LICENSE](./LICENSE).