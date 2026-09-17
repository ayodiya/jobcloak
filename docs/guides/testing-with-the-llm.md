# Testing with the LLM

CI never requires a real LLM: AI code is tested against `MockLLMProvider` from
`packages/ai/src/testing`. For local development you may want to compare real Ollama
output while keeping tests deterministic.

## Mock provider

```ts
import { MockLLMProvider } from '@jobs-app/ai/testing';

const llm = new MockLLMProvider({
  complete: { text: 'lorem ipsum' },
  structured: {
    requiredSkills: [{ name: 'TypeScript', justification: 'explicit in description' }],
  },
});
```

Every consumer accepts an injected `LLMProvider`, so tests inject the mock. There is
no global/actual LLM in tests.

## Record and replay locally

1. Run Ollama: `ollama serve`.
2. Record a session:
   ```bash
   npm run ai:record -- --model qwen2.5-coder:3b --scenario extract-requirements
   ```
   This writes a fixture under `packages/ai/src/testing/fixtures/`.
3. Add a test that replays the fixture through `RecordingLLMProvider`.

Signature-style recordings keep tests hermetic while still locking in the real
model's behavior for the scenarios that matter (requirement extraction, claim
classification).

## Verifying structured JSON reliability

The 3b default model can emit trailing prose around JSON. `StructuredOutputParser`
handles:

1. Attempt strict JSON parse of the full response.
2. Extract a JSON object fragment (brace/array balancing).
3. Zod `safeParse`; on failure, retry once with a corrective prompt; on second
   failure, `throw AAAIValidationError` (never return `undefined`/`null` silently).

## What is NOT testable in CI

- Live job sites / ATS pages — banned in CI; browser tests use fixtures only.
- Live Ollama availability — CI uses mock; `OllamaProvider.healthCheck()` is
  exercised in local dev and in API health endpoints.