# @jobs-app/shared

Shared, dependency-light building blocks used by every app and package:

- **Semantic errors** — `AppError` hierarchy with stable machine-readable codes,
  structured details, and `appErrorToHttpStatus` for API serialization.
- **Structured logging** — pino factory with service name, level from config, and
  automatic redaction of credential-shaped keys.
- **Correlation ids** — `AsyncLocalStorage`-scoped `correlationId` for request and
  job tracing; logging binds it automatically as `cid`.
- **Runtime identity** — `SERVICE_VERSION` / `SERVICE_ALIAS`.

## Rules

- Do not import from `@jobs-app/*` packages here (it is a leaf for the rest).
- Never log credentials; the redaction list covers the common shapes, and callers
  must avoid emitting secrets into log payloads in the first place.