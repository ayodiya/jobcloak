import { describe, expect, it } from 'vitest';
import { toActivityEvent } from '../src/activity.js';

describe('toActivityEvent', () => {
  it('maps a completed job with its duration', () => {
    const event = toActivityEvent(
      'jobDiscovery',
      { id: 'job-1', name: 'scheduled-discovery', processedOn: 1000, finishedOn: 5000 },
      'completed',
      new Date(6000),
    );
    expect(event.queue).toBe('jobDiscovery');
    expect(event.jobId).toBe('job-1');
    expect(event.jobName).toBe('scheduled-discovery');
    expect(event.outcome).toBe('completed');
    expect(event.at).toBe(new Date(5000).toISOString());
    expect(event.durationMs).toBe(4000);
    expect(event.error).toBeNull();
    expect(event.detail).toBeNull();
  });

  it('marks limit-guarded processors as skipped', () => {
    const event = toActivityEvent(
      'applicationPreparation',
      {
        id: 'job-2',
        name: 'prepare-123',
        processedOn: 100,
        finishedOn: 200,
        returnvalue: { skipped: true, kind: 'application', used: 1, remaining: 1 },
      },
      'completed',
      new Date(300),
    );
    expect(event.outcome).toBe('skipped');
    expect(event.detail).toMatch(/limit/i);
  });

  it('maps failures with the failed reason', () => {
    const event = toActivityEvent(
      'aiMatching',
      { id: 'job-3', name: 'scheduled-matching', failedReason: 'llm timeout' },
      'failed',
      new Date(1000),
    );
    expect(event.outcome).toBe('failed');
    expect(event.error).toBe('llm timeout');
    expect(event.durationMs).toBeNull();
  });

  it('falls back to now when timestamps are missing', () => {
    const event = toActivityEvent(
      'notifications',
      { id: 'job-4', name: 'ping' },
      'completed',
      new Date(42),
    );
    expect(event.at).toBe(new Date(42).toISOString());
    expect(event.durationMs).toBeNull();
  });

  it('never reports a negative duration on clock skew', () => {
    const event = toActivityEvent(
      'jobDiscovery',
      { id: 'job-5', name: 'x', processedOn: 5000, finishedOn: 1000 },
      'completed',
      new Date(6000),
    );
    expect(event.durationMs).toBe(0);
  });
});
