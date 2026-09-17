# How to add a browser adapter

`packages/browser` automates application forms. Playwright is the reference adapter.
The package exposes a session abstraction so the rest of the system never depends on a
specific browser library.

## The adapter contract

`packages/browser/src/adapters/BrowserAdapter.ts`:

```ts
interface BrowserSession {
  open(url: string, opts: SessionOptions): Promise<void>;
  detectForm(): Promise<FormDetection>;
  getFields(): Promise<FormField[]>;
  fillField(fieldId: string, value: string): Promise<void>;
  selectOption(fieldId: string, option: string): Promise<void>;
  uploadFile(fieldId: string, path: string): Promise<void>;
  answerQuestion(questionId: string, answer: string): Promise<void>;
  submit(): Promise<SubmitResult>;
  verifySuccess(opts?: VerifyOptions): Promise<SubmissionStatus>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  cancel(): Promise<void>;
  screenshot(path?: string): Promise<string>;
  onEvent(cb: (evt: BrowserEvent) => void): void;
}
```

Rules:

- An adapter has **no business rules**: it detects, maps, fills, submits, and reports
  events. Pause/stop decisions live in `packages/applications` / the worker that
  orchestrates the session.
- It must **detect** security gates (CAPTCHA, MFA, identity, legal, work-authorization
  surfaces) and surface them as events; it never tries to defeat them.
- It never sends cookies, tokens, or session state outside the session.

## 1. Implement the adapter

Create `packages/browser/src/adapters/<Name>Adapter.ts` implementing
`BrowserSession` (see the Playwright adapter for the reference shape:
dom content wait, `locator` polling, `MutationObserver`-via-evaluate for field
mapping, `page.screenshot` for captures).

Map detected elements through `FieldMapper` to `FormField`s:

```ts
type FormField = {
  id: string;
  kind: 'text' | 'email' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'file' | 'unknown';
  label?: string;
  required: boolean;
  sensitive?: boolean;
};
```

Classify questions through `QuestionClassifier` (uses `packages/ai` for optional
AI-augmented confidence). Low-confidence `required`/`unknown` fields are surfaced for
review — never filled from guesses.

## 2. Tests

Browser tests live in `packages/browser/test/` and run against fixture pages in
`tests/fixtures/browser/`. Cover with Playwright tests:

- form detection on fixture HTML
- field mapping (labels/placeholders/aria labels)
- CAPTCHA detection → pause event
- MFA detection → pause event
- upload via `<input type=file>`
- submission verification (success page fixture)
- pause/resume
- unknown/required field → review event, not a fill

Tests never hit a real site. Install the browser first:

```bash
npx playwright install chromium
```

Run:

```bash
npm run test:browser
```

## 3. Commit

```text
feat(browser): add <Name>Adapter
test(browser): add adapter fixtures and tests
docs(guides): update adding-a-browser-adapter
```