# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

### Security

## [0.2.0] - 2026-09-26

### Added

- Phase 11 — routed dashboard UI (Next.js + MUI + TanStack Query): dashboard,
  jobs list/detail, matches, applications list/detail with status transitions,
  candidate, automation, sources, settings, and audit pages.

### Changed

### Fixed

- API and worker now locate the repo-root `.env` even when started through npm
  workspace scripts (which set the workspace directory as cwd).

### Security

## [0.1.0] - 2026-09-26

### Added

- Local-first AI assistant architecture: candidate knowledge base, pluggable job
  sources, explainable matching, evidence-backed document generation, and
  Playwright-based browser automation with human-in-the-loop controls.
- Phase 0 — repository foundation (docs, license, CI, issue/PR templates).
- Phase 1 — monorepo foundation (config, database, API, worker, web shells).
- Phase 2 — candidate intelligence.
- Phase 3 — AI provider abstraction (Ollama) with structured output validation.
- Phase 4 — job discovery sources, normalization, deduplication.
- Phase 5 — matching engine with explainable scoring.
- Phase 6 — application material generation with factuality validation.
- Phase 7 — browser automation with review stops.
- Phase 8 — applications lifecycle, dashboard data seed, and API listing routes.
- Phase 9 — scheduling and notifications.
- Phase 10 — hardening, security and documentation review.

### Changed

- CI now enforces unit coverage thresholds (lines 55 / branches 70 / statements 55 / functions 55) across package, API, and worker source.

### Fixed

### Security

- Pinned `postcss` to ≥8.5.28 and `deepmerge-ts` to ≥8.0.2 via npm `overrides`, clearing the
  high-severity PostCSS XSS / arbitrary-file-read and DeepmergeTS stack-exhaustion advisories
  without version downgrades or breaking upgrades.