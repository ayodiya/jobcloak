# @jobs-app/ai

The single seam through which all model calls flow. Ollama is the reference
provider (ADR-0002); every consumer accepts an injected `LLMProvider`, so tests
run against a deterministic mock with no network and no model.

Candidate data never leaves the machine by default: the default provider talks
only to the configured local Ollama base URL. Hosted providers are opt-in and
must implement the same seam.

## Structure

```text
src/
  providers/
    LLMProvider.ts        # the interface (complete, chat, structured, healthCheck)
    OllamaProvider.ts     # local Ollama adapter (generate/chat JSON)
  StructuredOutputParser.ts  # strict JSON → fragment extraction → Zod validation
  PromptManager.ts        # versioned, pinned prompt templates
  ModelRouter.ts          # task → provider/model, health gating + fallback
  AIValidator.ts          # schema gate + evidence-grounded factuality gate
  EvidenceRetriever.ts    # deterministic lexical evidence retrieval
  types.ts                # requests, responses, claims, evidence
  testing/                # MockLLMProvider, RecordingLLMProvider (subpath export)
```

## Usage

```ts
import { createDefaultModelRouter, PromptManager } from '@jobs-app/ai';

const router = createDefaultModelRouter({
  baseUrl: config.OLLAMA_BASE_URL,
  model: config.OLLAMA_MODEL,
  timeoutMs: config.OLLAMA_TIMEOUT_MS,
});

const prompts = new PromptManager();
prompts.register({ id: 'summarize', version: 1, template: 'Summarize: {{ text }}' });

const { text } = await router.complete('summarize', {
  prompt: prompts.render('summarize', { text: '...' }),
});
```

Structured output is schema-first:

```ts
import { z } from 'zod';

const Result = z.object({ requiredSkills: z.array(z.string()) });
const result = await router.structured('extract', { prompt, schema: Result });
```

`structured` returns a Zod-validated object or throws `AIValidationError`. If
the model wraps JSON in prose or fences, the parser recovers it; if it is still
invalid, the provider retries once with a corrective prompt before throwing.

## Contract rules

- `complete`/`chat` return model text verbatim; validation is the caller's job.
- `structured` returns `z.output<S>` or throws `AIValidationError`.
- Providers never contain business logic, prompt formatting, or scoring.
- Model output is data and is never executed.
- Routing falls back only on `AIProviderError` (unreachable/timeout); a
  validation failure is surfaced, never hidden by switching providers.

## Factuality (ADR-0005)

`AIValidator` is the mechanical gate for generated prose: it extracts claims and
checks each against the candidate evidence base via `EvidenceRetriever`, then
returns a `FactualityReport` listing unsupported claims. Unsupported claims must
be regenerated or sent for human review — never shipped.

## Testing

```ts
import { MockLLMProvider } from '@jobs-app/ai/testing';

const llm = new MockLLMProvider({
  complete: 'text',
  structured: { requiredSkills: ['TypeScript'] },
});
```

`RecordingLLMProvider` records a real session and replays it hermetically; see
[docs/guides/testing-with-the-llm.md](../../docs/guides/testing-with-the-llm.md).
