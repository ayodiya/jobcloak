/**
 * Application lifecycle package (Phase 8).
 *
 * Owns one Application per (profile, job) with an immutable ApplicationEvent
 * trail. The service state machine follows docs/architecture/automation.md
 * (Prepared → InProgress → Submitted → Verified, Failed/Cancelled for blocked
 * runs, Rejected as a later manual outcome). Browser session events (Phase 7)
 * are persisted through ApplicationEventSink so interrupted applications
 * resume from their last recorded event.
 *
 * Design rules honored here:
 *  - State changes only flow through ApplicationService (threat model).
 *  - Every state change appends an ApplicationEvent and an AuditLog row.
 *  - Never stored: credentials, cookies, session material, or field values.
 *  - Event payloads carry metadata only; display text is sanitized on write.
 */
export { ApplicationRepository } from './repository.js';
export { ApplicationService } from './service.js';
export { ApplicationEventSink, type EventSinkInput, type SessionEventInput } from './event-sink.js';
export { ACTIVE_STATUSES, TERMINAL_STATUSES, canTransition, statusEventType } from './transitions.js';
export type {
  ApplicationEventInput,
  ApplicationEventRow,
  ApplicationListItem,
  ApplicationListFilter,
  ApplicationMode,
  ApplicationRow,
  ApplicationStatus,
  ApplicationStatusCount,
  ApplicationWithEvents,
  CreateApplicationInput,
} from './types.js';
export {
  APPLICATION_MODES,
  APPLICATION_STATUSES,
  isApplicationMode,
  isApplicationStatus,
} from './types.js';