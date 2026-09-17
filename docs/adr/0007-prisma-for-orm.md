# ADR-0007: Prisma as ORM and migration tool

## Status

Accepted

## Context

We need a typed database client and versioned migrations for PostgreSQL. The schema is
large (candidate, evidence, jobs, requirements, matches, materials, applications,
browser sessions, automation runs, audit logs) and evolves across the roadmap.
Contributor experience matters: a new contributor should be able to apply migrations and
run seed data with one command.

## Decision

Use Prisma for the `packages/database` package: schema definition, generated typed
client, migrations (`prisma migrate`), and seed data. Wrap it behind repository
interfaces so the rest of the codebase does not couple to Prisma specifics.

## Alternatives Considered

- **Drizzle ORM** — lighter and SQL-first; powerful, but migration workflow and
  tooling ergonomics are less approachable for broader contributions, and the team
  favors Prisma's explicit `schema.prisma` review surface.
- **Kysely** — excellent typed SQL, but schema management is DIY.
- **node-pg + handwritten SQL/migrations** — maximum control, maximum boilerplate,
  worse contributor ergonomics.

## Consequences

**Benefits**

- One declarative schema, generated migrations, typed client, easy seed.
- `npm run db:migrate` / `db:reset` / `db:seed` match the documented workflow.

**Tradeoffs**

- Prisma generates a client (build step) and has schema-specific idioms; documented
  in DEVELOPMENT.md and package README.
- Some advanced SQL features require raw `$queryRaw` escape hatches — used
  sparingly and covered by tests.

**Risks**

- Prisma version upgrades occasionally change engine behavior; Dependabot groups
  keep updates reviewable.