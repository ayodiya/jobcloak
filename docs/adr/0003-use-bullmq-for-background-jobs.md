# ADR-0003: Use BullMQ for background jobs

## Status

Accepted

## Context

The pipeline has many long-running, retryable, bursty operations: job discovery,
job parsing, AI matching, document generation, application preparation, browser
automation, notifications, and scheduled runs. Running these inline in the API would
make HTTP requests slow and fragile. We need queues, retries with backoff,
concurrency control, scheduled jobs, and observability of running/failed work.

## Decision

Use BullMQ backed by Redis for background jobs. Workers run in `apps/worker`;
the scheduler enqueues recurring jobs. Queues: `jobDiscovery`, `jobParsing`,
`aiMatching`, `documentGeneration`, `applicationPreparation`, `browserAutomation`,
`notifications`.

## Alternatives Considered

- **In-process async (setImmediate/worker_threads)** — no durability, no retry
  semantics, no observability, no cross-process distribution.
- **Redis pub/sub alone** — no durable delivery or retry guarantees.
- **Node BullMQ alternatives (Bee-Queue, Bull, pg-boss, Agenda, Temporal)** —
  BullMQ is actively maintained, TypeScript-first, built on Redis (already a
  dependency), supports scheduling via `repeat`, and has first-class failure handling.

## Consequences

**Benefits**

- Durable, observable, retryable jobs with exponential backoff.
- Concurrency control and per-queue config.
- Scheduled discovery/matching/reports via repeatable jobs.
- Redis is already in the stack, so no new infrastructure.

**Tradeoffs**

- Workers are a separate process to run (`npm run dev:worker`) — documented.
- Requires Redis for development (Docker Compose).

**Risks**

- Jobs must be idempotent (see the idempotency section of ARCHITECTURE.md); unique
  constraints and dedup keys prevent double-submission when a worker retries.
- Redis durability vs Postgres is deliberately not used for source-of-truth data —
  queues are transient, state lives in Postgres.