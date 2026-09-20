import { describe, expect, it } from 'vitest';
import {
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  canTransition,
  statusEventType,
} from './transitions.js';
import { isApplicationMode, isApplicationStatus } from './types.js';

describe('application status machine', () => {
  it('allows the happy path through submission and verification', () => {
    expect(canTransition('Prepared', 'InProgress')).toBe(true);
    expect(canTransition('InProgress', 'Submitted')).toBe(true);
    expect(canTransition('Submitted', 'Verified')).toBe(true);
  });

  it('accepts a human rejection verdict from a verified application', () => {
    expect(canTransition('Verified', 'Rejected')).toBe(true);
  });

  it('allows retrying failed or cancelled runs', () => {
    expect(canTransition('Failed', 'Prepared')).toBe(true);
    expect(canTransition('Failed', 'InProgress')).toBe(true);
    expect(canTransition('Cancelled', 'Prepared')).toBe(true);
    expect(canTransition('Cancelled', 'InProgress')).toBe(true);
  });

  it('blocks illegal and reversed jumps', () => {
    expect(canTransition('Prepared', 'Submitted')).toBe(false);
    expect(canTransition('Submitted', 'InProgress')).toBe(false);
    expect(canTransition('Verified', 'InProgress')).toBe(false);
    expect(canTransition('Rejected', 'Prepared')).toBe(false);
    expect(canTransition('Rejected', 'InProgress')).toBe(false);
    expect(canTransition('Submitted', 'Cancelled')).toBe(false);
  });

  it('classifies active and terminal sets', () => {
    expect([...ACTIVE_STATUSES].sort()).toEqual(['InProgress', 'Prepared']);
    expect([...TERMINAL_STATUSES].sort()).toEqual(['Rejected', 'Verified']);
  });

  it('maps statuses to stable event types', () => {
    expect(statusEventType('Prepared')).toBe('application.preparing');
    expect(statusEventType('InProgress')).toBe('application.in_progress');
    expect(statusEventType('Submitted')).toBe('application.submitted');
    expect(statusEventType('Verified')).toBe('application.verified');
    expect(statusEventType('Failed')).toBe('application.failed');
    expect(statusEventType('Cancelled')).toBe('application.cancelled');
    expect(statusEventType('Rejected')).toBe('application.rejected');
  });

  it('guards status and mode unions', () => {
    expect(isApplicationStatus('Verified')).toBe(true);
    expect(isApplicationStatus('Closed')).toBe(false);
    expect(isApplicationMode('auto_apply')).toBe(true);
    expect(isApplicationMode('nope')).toBe(false);
  });
});