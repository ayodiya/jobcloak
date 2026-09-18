# How to add an AI provider

`packages/ai` exposes one seam for LLM providers. Ollama is the reference
implementation; a new provider (hosted or local) implements `LLMProvider`.

## The provider interface

`packages/ai/src/providers/LLMProvider.ts`:

```ts
interface LLMProvider {
  readonly name: string;
  complete(request: LLMRequest): Promise<LLMResponse>;         // free text
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<LLMResponse>;
  structured<T>(request: StructuredLLMRequest<T>): Promise<T>; // Zod-validated object
  healthCheck(): Promise<boolean>;
}
```

Contract rules:

- `complete`/`chat` return the model's text verbatim (never re-validate; validation is
  the caller's job).
- `structured` **must** return a Zod-validated `T` or throw `AIValidationError`.
  Implement by asking the model for JSON (Ollama: JSON-mode / tool calls) and `parse`.
- Providers never perform business logic, prompt formatting, or scoring. Formatting
  lives in `PromptManager`; parsing/validation lives in `StructuredOutputParser`.
- Any model output is data. It is never executed.

## 1. Implement the provider

Create `packages/ai/src/providers/<Name>Provider.ts`:

```ts
export class ExampleProvider implements LLMProvider {
  readonly name = 'example';

  constructor(private readonly client: SomeClient) {}

  async complete(req: LLMRequest): Promise<LLMResponse> {
    const reply = await this.client.complete({ model: req.model, prompt: req.prompt });
    return { text: reply.text };
  }

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<LLMResponse> {
    const reply = await this.client.chat({ model: opts?.model, messages });
    return { text: reply.content };
  }

  async structured<T>(req: StructuredLLMRequest<T>): Promise<T> {
    const reply = await this.client.chat({
      model: req.model,
      messages: [{ role: 'user', content: req.prompt }],
      format: 'json',
    });
    return parseStructuredOutput(reply.content, req.schema); // from StructuredOutputParser
  }

  async healthCheck(): Promise<boolean> {
    return this.client.health().then(() => true).catch(() => false);
  }
}
```

## 2. Wire into the router

Register the provider in `packages/ai/src/ModelRouter.ts` (factory + health gating).
A `ModelRouter` chooses a provider/model for a task, with fallback rules; the default
config selects `ollama` + `qwen2.5-coder:3b`.

## 3. Tests

Tests use `MockLLMProvider` from `packages/ai/src/testing`. Contract tests live in
`packages/ai/src/providers/<Name>Provider.test.ts`:

- `complete` returns text
- `chat` maps messages + options to the client's shape
- `structured` parses into the schema and throws a validation error on malformed JSON
- network errors map to `AIProviderError`

CI runs against the mock; Ollama integration is tested locally with a recorded replay
(see [testing-with-the-llm.md](./testing-with-the-llm.md)).

## 4. Documentation + config

- Add provider options to the config schema (`packages/config`) and `.env.example`.
- Document the provider in `packages/ai/README.md` and note privacy implications in
  `docs/architecture/privacy.md` (external providers are opt-in by default).

## Commit

```text
feat(ai): add ExampleProvider adapter
test(ai): add ExampleProvider contract tests
docs(guides): update adding-an-ai-provider guide
```