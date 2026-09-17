# ADR-0001: Use PostgreSQL

## Status

Accepted

## Context

The system stores candidate profiles, evidence, jobs, matches, application materials,
applications, browser sessions, and audit logs. The workload is relational: entities are
linked by foreign keys, and application reproducibility requires transactionally consistent
snapshots (job snapshot, materials version, events). Queries are dominated by bounded
sequential scans / indexed lookups, not horizontal-scale analytical queries. The data is
private and local-first, so operational simplicity on a single machine matters more than
distributed scale.

## Decision

Use PostgreSQL as the primary database, managed via Prisma migrations (see ADR-0007).

## Alternatives Considered

- **SQLite** — simpler to embed, but weaker concurrency guarantees under parallel
  BullMQ workers, no native `JSONB` first-class behavior for matching/requirements
  storage, and poor fit for migrations at contributor scale.
- **MySQL** — adequate but the project has no MySQL-specific need; PostgreSQL's
  richer `JSONB`, partial indexes, and `citext` support are a better fit.
- **MongoDB** — documents would be convenient for jobs, but cross-entity integrity
  (application reproducibility snapshots, audit trails) favors a relational model.

## Consequences

**Benefits**

- Transactional integrity for application/audit pipelines.
- `JSONB` for flexible requirement and evidence structures.
- Strong migration tooling and a familiar contributor experience.
- Runs locally via Docker Compose with zero native install.

**Tradeoffs**

- Requires a running PostgreSQL for development (Docker Compose handles this).
- Schema changes require migrations (a deliberate, versioned process).

**Risks**

- None significant for this project's scale; the single-node deployment is intentional.