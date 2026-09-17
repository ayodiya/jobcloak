# ADR-0005: Evidence-based candidate generation

## Status

Accepted

## Context

AI-generated application materials (CVs, cover letters, application answers) are the
biggest risk area: a model can confidently invent experience, projects, companies,
technologies, metrics, education, employment dates, and work authorization. In job
applications, a fabricated claim is not just a quality issue — it damages a candidate's
integrity and employability. Prompt instructions alone are insufficient; hallucination
must be caught mechanically.

## Decision

The candidate's **evidence base** is the single factual source of truth. Generated text
must pass a **factuality validation** pipeline before it can be associated with an
application:

```text
generated text
  → claim extraction
  → candidate evidence comparison
  → unsupported claim detection
  → regenerate or require human review
```

Claims that match evidence pass; unsupported claims are flagged, and the generator must
regenerate or the text is quarantined for human review. Every claim supported by AI must
reference an evidence record. Application materials are versioned and pinned to the
evidence snapshot used, so a submitted application is reproducible.

## Alternatives Considered

- **Prompt-only honesty instructions** — common but unreliable; demonstrated failure mode.
- **Post-generation human proofreading only** — valuable but not a mechanical gate
  and does not scale to regular workflows.
- **RAG citation for every sentence** — stronger but heavier and still LLM-dependent;
  we implement claim-vs-evidence comparison as the correctness bar for v1, and keep the
  evidence store shaped so RAG citation can be added later.

## Consequences

**Benefits**

- Mechanically prevents unsupported claims from shipping to an application.
- Clear UX: generated text exposes its evidence and confidence.
- Encourages the user to enrich the evidence base, which improves everything downstream.

**Tradeoffs**

- Generation is a deliberate multi-step pipeline (generate → validate → review),
  which costs a little latency.
- The validator is itself an LLM component and can err; its output is treated as a
  gate requiring human review on any flag, never as silent authority.

**Risks**

- Over-rejection of stylistically rephrased evidence; calibration work is part of the
  validator's prompt/versioning (PromptManager keeps prompt versions pinned).