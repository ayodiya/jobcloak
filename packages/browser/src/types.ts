/**
 * Shared types for the browser session layer (Phase 7).
 *
 * The browser package exposes Playwright-backed session primitives only
 * (ADR-0004, docs/architecture/automation.md). It contains no business rules,
 * no database, and never exposes cookies/session material. Audit events carry
 * metadata (field labels, sources, confidence) but never filled values.
 */

export type BrowserEngine = 'chromium';

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'url'
  | 'date'
  | 'number'
  | 'file'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'password'
  | 'unknown';

export interface SelectOption {
  value: string;
  label: string;
}

export interface FormField {
  /** Stable opaque key for this field within the current session. */
  key: string;
  /** Conservative selector usable with `page.locator` (id/name first). */
  selector: string;
  name: string | null;
  label: string;
  type: FormFieldType;
  required: boolean;
  /** Visible options for selects and radio groups. */
  options: SelectOption[];
  placeholder: string | null;
  /** Open-ended fields (textareas, long "why/how" inputs). */
  isQuestion: boolean;
  /** Shared grouping for radio/checkbox sets (the `name` attribute). */
  group: string | null;
}

export type MappingConfidence = 'high' | 'medium' | 'low' | 'none';

export interface MappingDecision {
  field: FormField;
  /** Value to fill; `null` when nothing matched (never fabricated). */
  value: string | null;
  /** Key of the `AvailableValue` that produced this decision. */
  sourceKey: string | null;
  confidence: MappingConfidence;
  /** True when the value must never be recorded in audit events. */
  sensitive: boolean;
  reason: string;
}

export type QuestionCategory =
  | 'identity'
  | 'contact'
  | 'education'
  | 'experience'
  | 'cv'
  | 'cover_letter'
  | 'answer'
  | 'salary'
  | 'availability'
  | 'work_authorization'
  | 'legal'
  | 'unknown';

export type ClassifierSource = 'deterministic' | 'ai';

export interface QuestionClassification {
  question: FormField;
  category: QuestionCategory;
  source: ClassifierSource;
  confidence: 'high' | 'medium' | 'low';
  /** Human-friendly label of the value that would answer this question. */
  answerLabel: string | null;
  /** True when the field must not be auto-filled (a stop point). */
  requiresHuman: boolean;
}

export type GateKind =
  'captcha' | 'mfa' | 'challenge' | 'identity' | 'legal' | 'work_authorization';

export type GateSeverity = 'stop' | 'info';

export interface GateVerdict {
  kind: GateKind;
  severity: GateSeverity;
  detector: 'dom' | 'url';
  evidence: string;
}

export type VerificationStatus = 'verified' | 'pending' | 'inconclusive' | 'failed';

export interface VerificationResult {
  status: VerificationStatus;
  evidence: string[];
}

export type SessionStage =
  | 'idle'
  | 'opening'
  | 'mapping'
  | 'filling'
  | 'waiting-approval'
  | 'submitting'
  | 'submitted'
  | 'closed'
  | 'cancelled';

/** Plain DOM snapshot used by the pure gate/verification logic. */
export interface PageSnapshot {
  url: string;
  html: string;
  title: string;
  bodyText: string;
}

export type SessionEventType =
  | 'session.opened'
  | 'page.ready'
  | 'form.mapped'
  | 'field.mapped'
  | 'form.filled'
  | 'question.classified'
  | 'file.uploaded'
  | 'gate.detected'
  | 'submission.blocked'
  | 'submission.submitted'
  | 'verification.result'
  | 'session.paused'
  | 'session.resumed'
  | 'session.cancelled'
  | 'session.closed'
  | 'error.thrown';

export interface SessionEvent {
  type: SessionEventType;
  /** Epoch milliseconds. */
  at: number;
  stage: SessionStage;
  payload?: Record<string, unknown>;
}

export interface EventSink {
  emit(event: SessionEvent): void | Promise<void>;
}

export interface SessionOptions {
  headless?: boolean;
  /** Per-session profile directory. Defaults to a fresh temp dir. */
  userDataDir?: string;
  locale?: string;
  viewport?: { width: number; height: number };
  sink?: EventSink;
}
