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
2. Record a real session by wrapping the provider:

   ```ts
   import { OllamaProvider } from '@jobs-app/ai';
   import { RecordingLLMProvider } from '@jobs-app/ai/testing';

   const recorder = RecordingLLMProvider.recording(
     new OllamaProvider({ baseUrl: 'http://localhost:11434', model: 'qwen2.5-coder:3b' }),
   );
   await recorder.structured({ prompt, schema });
   await recorder.save('packages/ai/src/testing/fixtures/extract-requirements.json');
   ```

3. Replay the fixture in a test:

   ```ts
   import { RecordingLLMProvider, loadRecording } from '@jobs-app/ai/testing';

   const recording = await loadRecording('packages/ai/src/testing/fixtures/extract-requirements.json');
   const llm = RecordingLLMProvider.replaying(recording);
   ```

Replayed `structured` output is validated against the caller's schema again, and
recorded failures replay as the same error type. Recordings keep tests hermetic
while locking in the real model's behavior for the scenarios that matter
(requirement extraction, claim classification).

## Verifying structured JSON reliability

The 3b default model can emit trailing prose around JSON. `StructuredOutputParser`
handles:

1. Attempt strict JSON parse of the full response.
2. Extract a JSON object fragment (brace/array balancing).
3. Zod `safeParse`; on failure, retry once with a corrective prompt; on second
   failure, `throw AIValidationError` (never return `undefined`/`null` silently).

## What is NOT testable in CI

- Live job sites / ATS pages — banned in CI; browser tests use fixtures only.
- Live Ollama availability — CI uses mock; `OllamaProvider.healthCheck()` is
  exercised in local dev and in API health endpoints.