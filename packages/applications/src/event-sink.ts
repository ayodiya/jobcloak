/**
 * Adapter that persists browser session events into the application event
 * trail (autowire Phase 7 → Phase 8). Pass an instance as `sink` to a
 * BrowserSession; every emitted event becomes an ApplicationEvent row so an
 * interrupted application resumes from its last recorded event
 * (docs/architecture/automation.md).
 *
 * The structural `SessionEventInput`/`EventSink` types mirror the browser
 * package's event shape on purpose (no package import, no DOM dependency):
 * a BrowserSession accepts any sink implementing `emit`, and these shapes are
 * structurally identical to `@jobs-app/browser`'s `SessionEvent`/`EventSink`.
 *
 * The sink is fire-and-forget by design: BrowserSession intentionally ignores
 * sink failures (`void result.catch`), so a storage hiccup never aborts a
 * live browser session. A monitoring layer can watch the application trail.
 */
import type { ApplicationRepository } from './repository.js';

/** Structural subset of the browser SessionEvent (type, at, stage, payload). */
export interface SessionEventInput {
  type: string;
  /** Epoch milliseconds, matching the browser clock. */
  at: number;
  stage: string;
  payload?: Record<string, unknown>;
}

/** Structural subset of the browser EventSink contract. */
export interface EventSinkInput {
  emit(event: SessionEventInput): void | Promise<void>;
}

export class ApplicationEventSink implements EventSinkInput {
  constructor(
    private readonly applicationId: string,
    private readonly repository: ApplicationRepository,
  ) {}

  async emit(event: SessionEventInput): Promise<void> {
    await this.repository.addEvent(this.applicationId, {
      type: event.type,
      stage: event.stage,
      payload: event.payload,
      at: new Date(event.at),
    });
  }
}