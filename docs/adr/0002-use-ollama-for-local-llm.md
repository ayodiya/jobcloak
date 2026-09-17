# ADR-0002: Use Ollama for the local LLM

## Status

Accepted

## Context

Candidate data (CVs, evidence, job application materials) is private by design
(see ADR-0005 and the privacy architecture). Sending it to a hosted AI API conflicts
with the project's privacy-first goal. We still need capable extraction, classification,
summarization, generation, and structured-output support.

Variants considered: a hosted API (OpenAI, Anthropic, etc.), a local model served via
Ollama, native local inference (llama.cpp bindings), and a small on-device model after
prompt engineering. The default target model is `qwen2.5-coder:3b`, which is small enough
to run on a laptop while producing usable structured JSON for requirement extraction and
matching interpretation.

## Decision

Use Ollama as the default local model server, addressed via a provider abstraction
(`LLMProvider` in `packages/ai`) so the transport is replaceable. Model and base URL are
configuration, never hard-coded:

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:3b
```

## Alternatives Considered

- **Hosted APIs (OpenAI/Anthropic/etc.)** — significantly higher output quality, but they
  require sending private candidate data to a third party and add cost and network
  dependency. Available opt-in later via the same `LLMProvider` seam if a user explicitly
  configures it. Not the default.
- **llama.cpp / node bindings** — more moving parts for setup and less contributor
  friendliness than Ollama's single daemon + `ollama pull`.
- **Bigger local models (qwen2.5-coder:7b / llama3.1:8b)** — supported via config, but
  not the default: 3b is the lowest that reliably produced the structured JSON used by
  the pipeline in local testing, and keeps laptops usable.

## Consequences

**Benefits**

- Candidate data stays on the machine by default.
- Offline-capable: discovery/matching/generation work without internet.
- Simple contributor setup (`brew install ollama && ollama pull qwen2.5-coder:3b`).
- The provider seam keeps future model options open without coupling.

**Tradeoffs**

- Output quality is lower than top hosted models; mitigated by Zod-validated structured
  output with retry/reject, and by keeping the LLM out of business logic (it only
  extracts/classifies/generates/suggests).
- Running a local model consumes CPU/GPU and RAM while active.

**Risks**

- Model hallucinations: mitigated by the factuality validation subsystem (ADR-0005)
  and by never letting model output control business logic.