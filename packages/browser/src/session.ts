import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import type { BrowserContext, Page } from 'playwright';
import { AiQuestionClassifierBackend } from './ai-question.js';
import { classifyQuestion } from './classify.js';
import type { QuestionClassifierBackend } from './classify.js';
import { buildFields, harvestForm } from './detect.js';
import { SessionBlockedError, SessionError } from './errors.js';
import { detectGates, hasStopGates } from './gates.js';
import { mapFields, unresolvedRequired } from './map.js';
import type { AvailableValue } from './map.js';
import type {
  EventSink,
  FormField,
  GateVerdict,
  MappingDecision,
  PageSnapshot,
  QuestionClassification,
  SessionEvent,
  SessionEventType,
  SessionOptions,
  SessionStage,
} from './types.js';
import { verifySubmission } from './verify.js';

interface SessionInternals extends SessionOptions {
  now?: () => number;
  classifierBackend?: QuestionClassifierBackend;
}

/**
 * Playwright-backed session primitives (ADR-0004). One session = one browser
 * context backed by a per-session profile directory. The session holds no
 * business rules and never exposes cookies or session state; audit events
 * carry metadata, never field values.
 */
export class BrowserSession {
  private readonly headless: boolean;
  private readonly userDataDir: string;
  private readonly locale?: string;
  private readonly viewport?: { width: number; height: number };
  private readonly sink?: EventSink;
  private readonly now: () => number;
  private readonly backend?: QuestionClassifierBackend;

  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private stage: SessionStage = 'idle';
  private readonly events: SessionEvent[] = [];
  private unresolved: MappingDecision[] = [];
  private priorStage: SessionStage = 'mapping';

  constructor(options: SessionInternals = {}) {
    this.headless = options.headless ?? true;
    this.userDataDir = options.userDataDir ?? mkdtempSync(join(tmpdir(), 'jobs-browser-'));
    this.locale = options.locale;
    this.viewport = options.viewport;
    this.sink = options.sink;
    this.now = options.now ?? Date.now;
    this.backend = options.classifierBackend;
  }

  get userDataDirPath(): string {
    return this.userDataDir;
  }

  get stageName(): SessionStage {
    return this.stage;
  }

  get url(): string | null {
    return this.page ? this.page.url() : null;
  }

  eventsList(): SessionEvent[] {
    return [...this.events];
  }

  private record(type: SessionEventType, payload?: Record<string, unknown>): void {
    const event: SessionEvent = {
      type,
      at: this.now(),
      stage: this.stage,
      ...(payload ? { payload } : {}),
    };
    this.events.push(event);
    if (this.sink) {
      const result = this.sink.emit(event);
      if (result instanceof Promise) void result.catch(() => undefined);
    }
  }

  private requirePage(): Page {
    if (!this.page || !this.context) throw new SessionError('Session is not open');
    return this.page;
  }

  private async snapshot(): Promise<PageSnapshot> {
    const page = this.requirePage();
    const html = await page.content();
    const bodyText = await page
      .locator('body')
      .innerText()
      .catch(() => '');
    return { url: page.url(), html, title: await page.title().catch(() => ''), bodyText };
  }

  /** Open a freshly isolated context and navigate to the target URL. */
  async open(url: string): Promise<void> {
    if (this.stage !== 'idle') throw new SessionError('Session has already been opened');
    this.stage = 'opening';
    this.record('session.opened');
    try {
      this.context = await chromium.launchPersistentContext(this.userDataDir, {
        headless: this.headless,
        locale: this.locale,
        viewport: this.viewport,
        acceptDownloads: true,
      });
      const page = this.context.pages()[0] ?? (await this.context.newPage());
      this.page = page;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      this.stage = 'mapping';
      this.record('page.ready', { url: page.url() });
    } catch (error) {
      if (this.context) await this.context.close().catch(() => undefined);
      this.context = null;
      this.page = null;
      this.stage = 'idle';
      throw error;
    }
  }

  /** Detect and describe every fillable field on the current page. */
  async map(): Promise<FormField[]> {
    const page = this.requirePage();
    const fields = buildFields(await harvestForm(page));
    this.stage = 'mapping';
    this.record('form.mapped', { count: fields.length });
    return fields;
  }

  /** Classify open-ended fields; security categories become stop points. */
  async classify(fields: readonly FormField[]): Promise<QuestionClassification[]> {
    this.requirePage();
    const questions = fields.filter((field) => field.isQuestion);
    const classifications = await Promise.all(
      questions.map((question) => classifyQuestion(question, this.backend)),
    );
    for (const classification of classifications) {
      this.record('question.classified', {
        key: classification.question.key,
        label: classification.question.label,
        category: classification.category,
        confidence: classification.confidence,
        source: classification.source,
        requiresHuman: classification.requiresHuman,
      });
    }
    return classifications;
  }

  /** Deterministically map fields to provided values (never fabricates). */
  mapValues(
    fields: readonly FormField[],
    values: readonly AvailableValue[],
  ): MappingDecision[] {
    const decisions = mapFields(fields, values);
    for (const decision of decisions) {
      this.record('field.mapped', {
        key: decision.field.key,
        label: decision.field.label,
        sourceKey: decision.sourceKey,
        confidence: decision.confidence,
        required: decision.field.required,
      });
    }
    return decisions;
  }

  /** Fill mapped fields with high/medium-confidence decisions. */
  async fill(decisions: readonly MappingDecision[]): Promise<void> {
    this.stage = 'filling';
    let filled = 0;
    for (const decision of decisions) {
      if (decision.value === null) continue;
      if (decision.confidence !== 'high' && decision.confidence !== 'medium') continue;
      await this.fillField(decision);
      filled += 1;
    }
    this.unresolved = unresolvedRequired(decisions);
    this.record('form.filled', { filled, unresolved: this.unresolved.length });
  }

  private async fillField(decision: MappingDecision): Promise<void> {
    const page = this.requirePage();
    const { field } = decision;
    const value = decision.value;
    if (value === null) return;
    switch (field.type) {
      case 'select':
        await page
          .locator(field.selector)
          .selectOption({ label: value })
          .catch(() => page.locator(field.selector).selectOption(value));
        return;
      case 'radio': {
        const option = field.options.find(
          (option) => option.label === value || option.value === value,
        );
        if (!option) return;
        await page
          .locator(
            `${field.selector}[value="${option.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`,
          )
          .check();
        return;
      }
      case 'checkbox':
        if (/^(true|yes|1)$/i.test(value)) await page.locator(field.selector).check();
        else await page.locator(field.selector).uncheck();
        return;
      case 'text':
      case 'textarea':
      case 'email':
      case 'tel':
      case 'url':
      case 'date':
      case 'number':
      case 'password':
        await page.locator(field.selector).fill(value);
        return;
      default:
        return;
    }
  }

  /** Answer questions with material/generated values where classification allows. */
  async fillQuestions(
    classifications: readonly QuestionClassification[],
    values: readonly AvailableValue[],
  ): Promise<void> {
    const page = this.requirePage();
    for (const classification of classifications) {
      if (classification.requiresHuman || classification.answerLabel === null) continue;
      const value = findAnswerValue(values, classification);
      if (!value) continue;
      const target = classification.question;
      await page.locator(target.selector).fill(value.value);
      this.record('question.classified', {
        key: target.key,
        label: target.label,
        answered: true,
        sourceKey: value.key,
      });
    }
  }

  /** Attach files to a file input. */
  async upload(field: FormField, paths: readonly string[]): Promise<void> {
    const page = this.requirePage();
    await page.locator(field.selector).setInputFiles([...paths]);
    const names = paths.map((path) => path.split(/[\\/]/).pop() ?? path);
    this.record('file.uploaded', {
      key: field.key,
      count: paths.length,
      digest: createHash('sha256').update(names.join('\u0000')).digest('hex').slice(0, 16),
    });
  }

  /** Detect security gates on the current page (no action taken). */
  async gates(): Promise<GateVerdict[]> {
    const verdicts = detectGates(await this.snapshot());
    if (hasStopGates(verdicts)) this.stage = 'waiting-approval';
    this.record('gate.detected', {
      count: verdicts.length,
      kinds: verdicts.map((verdict) => verdict.kind),
    });
    return verdicts;
  }

  /** Click submit. Refuses when security gates or unresolved required fields exist. */
  async submit(selector?: string): Promise<void> {
    if (
      this.stage !== 'mapping' &&
      this.stage !== 'filling' &&
      this.stage !== 'waiting-approval'
    ) {
      throw new SessionError('submit() requires a mapped/filling session');
    }
    const page = this.requirePage();

    const verdicts = detectGates(await this.snapshot());
    this.record('gate.detected', {
      count: verdicts.length,
      kinds: verdicts.map((verdict) => verdict.kind),
    });
    if (hasStopGates(verdicts)) {
      this.stage = 'waiting-approval';
      this.record('submission.blocked', {
        reason: 'security gate',
        kinds: verdicts.map((v) => v.kind),
      });
      throw new SessionBlockedError(verdicts);
    }

    const stillUnresolved: MappingDecision[] = [];
    for (const decision of this.unresolved) {
      const current = await page
        .locator(decision.field.selector)
        .inputValue()
        .catch(() => '');
      if (!current.trim()) stillUnresolved.push(decision);
    }
    if (stillUnresolved.length > 0) {
      this.stage = 'waiting-approval';
      this.record('submission.blocked', {
        reason: 'required fields',
        keys: stillUnresolved.map((d) => d.field.key),
      });
      throw new SessionBlockedError(
        [],
        'Stopped: required fields are not filled and cannot be fabricated. Review before submitting.',
      );
    }

    const submitSelector = selector ?? (await this.findSubmitButton(page));
    this.stage = 'submitting';
    const navigated = page.waitForNavigation({ timeout: 15_000 }).then(
      () => true,
      () => false,
    );
    await page.locator(submitSelector).first().click();
    if (!(await navigated)) {
      this.stage = 'filling';
      this.record('submission.blocked', { reason: 'no navigation' });
      throw new SessionBlockedError(
        [],
        'Submit did not navigate away from the page; nothing was submitted.',
      );
    }

    const postVerdicts = detectGates(await this.snapshot());
    if (hasStopGates(postVerdicts)) {
      this.stage = 'waiting-approval';
      this.record('submission.blocked', {
        reason: 'post-submit security gate',
        kinds: postVerdicts.map((v) => v.kind),
      });
      throw new SessionBlockedError(postVerdicts);
    }

    this.stage = 'submitted';
    this.record('submission.submitted');
  }

  private async findSubmitButton(page: Page): Promise<string> {
    const found = await page.evaluate((): string | null => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>('button[type="submit"], input[type="submit"]'),
      );
      const visible = candidates.filter((el) => el.getClientRects().length > 0);
      const label = (el: HTMLElement): string =>
        ((el as HTMLInputElement).value ?? el.textContent ?? '').trim().toLowerCase();
      const preferred = visible.find((el) =>
        /(submit|apply|send|continue|next|confirm)/.test(label(el)),
      );
      const pick = preferred ?? visible[0];
      if (!pick) return null;
      const tag = pick.tagName.toLowerCase();
      const escapeAttr = (value: string): string =>
        value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const attr = (name: string): string => {
        const raw = pick.getAttribute(name);
        return raw ? `[${name}="${escapeAttr(raw)}"]` : '';
      };
      const type = tag === 'input' ? '[type="submit"]' : '';
      return `${tag}${type}${attr('name')}${attr('id')}`;
    });
    if (!found) throw new SessionError('No submit button found on the page');
    return found;
  }

  /** Verify the post-submit page for success/error markers. */
  async verify(): Promise<{ status: string; evidence: string[] }> {
    if (this.stage !== 'submitted')
      throw new SessionError('verify() requires a submitted session');
    const result = verifySubmission(await this.snapshot());
    this.record('verification.result', {
      status: result.status,
      evidence: result.evidence.slice(0, 4),
    });
    return result;
  }

  /** Always call before a security gate: stop for the human operator. */
  async pause(): Promise<void> {
    if (this.stage !== 'mapping' && this.stage !== 'filling') {
      throw new SessionError('pause() is only valid before submission');
    }
    this.priorStage = this.stage;
    this.stage = 'waiting-approval';
    this.record('session.paused');
  }

  /** Continue after the human resolved a stop point. */
  async resume(): Promise<void> {
    if (this.stage !== 'waiting-approval')
      throw new SessionError('resume() requires a paused session');
    this.stage = this.priorStage === 'submitting' ? 'filling' : this.priorStage;
    this.record('session.resumed');
  }

  /** Abort the session; the profile directory is left for the caller. */
  async cancel(): Promise<void> {
    if (!this.context) throw new SessionError('Session is not open');
    await this.context.close();
    this.context = null;
    this.page = null;
    this.stage = 'cancelled';
    this.record('session.cancelled');
  }

  /** Close the session normally. */
  async close(): Promise<void> {
    if (!this.context) throw new SessionError('Session is not open');
    await this.context.close();
    this.context = null;
    this.page = null;
    this.stage = 'closed';
    this.record('session.closed');
  }
}

function findAnswerValue(
  values: readonly AvailableValue[],
  classification: QuestionClassification,
): AvailableValue | null {
  const wanted = classification.answerLabel?.toLowerCase();
  if (!wanted) return null;
  const exact = values.find(
    (value) => value.label.toLowerCase() === wanted || value.key.toLowerCase() === wanted,
  );
  if (exact) return exact;
  const partial = values.find(
    (value) =>
      value.label.toLowerCase().includes(wanted) || value.key.toLowerCase().includes(wanted),
  );
  return partial ?? null;
}

export { AiQuestionClassifierBackend };
