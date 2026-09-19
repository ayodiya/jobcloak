import type { GateVerdict } from './types.js';

/** Misuse of a session (e.g. an action called in the wrong stage). */
export class SessionError extends Error {}

/** Raised by `submit()` when a security gate requires the human operator. */
export class SessionBlockedError extends Error {
  constructor(
    readonly gates: GateVerdict[],
    hint?: string,
  ) {
    super(hint ?? `Blocked by security gate: ${gates.map((gate) => gate.kind).join(', ')}`);
    this.name = 'SessionBlockedError';
  }
}
