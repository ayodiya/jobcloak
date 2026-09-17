# ADR-0006: npm-workspaces monorepo

## Status

Accepted

## Context

The system has a web app, an API, a worker process, and several domain packages. We need
shared builds, typechecks, lint, and tests across all of them, plus contribution
simplicity (a contributor should install once and run everything). We also need clear
architectural boundaries so responsibilities cannot creep between layers.

## Decision

Use a single repository (`monorepo`) managed with **npm workspaces**:

- `apps/web`, `apps/api`, `apps/worker`
- `packages/config`, `packages/database`, `packages/shared`, `packages/candidate`,
  `packages/ai`, `packages/jobs`, `packages/matching`, `packages/documents`,
  `packages/browser`, `packages/applications`, `packages/notifications`

TypeScript uses project references for a fast, strict typecheck of the whole graph.
Root scripts orchestrate dev/test/lint/typecheck/build/migrations.

## Alternatives Considered

- **Turborepo/pnpm workspaces** — faster caching; we standardize on npm (already
  required, zero extra tooling) with typed project references. Cache can be added
  later without a migration.
- **Multi-repo** — loses unified installs, cross-cutting refactors, and shared
  CI; an artificial burden for a project this cohesive.
- **Single flat app** — avoids package seams but invites hidden cross-layer coupling
  that ARCHITECTURE.md explicitly forbids.

## Consequences

**Benefits**

- One `npm install`; one `npm run build`/`test`/`lint`/`typecheck`.
- Clear dependency direction enforced by package structure.
- Contributors add packages without touching unrelated tooling.

**Tradeoffs**

- npm workspaces hoist dependencies; resolutions need care to avoid duplicated
  TypeScript/React instances (documented in DEVELOPMENT.md).
- Root-level config must cover heterogeneous apps (Node vs Next.js); scoped configs
  in packages handle the details.

**Risks**

- Next.js + Fastify in one repo is routine but requires `web` to stay out of Node-only
  contexts; handled by build separation.