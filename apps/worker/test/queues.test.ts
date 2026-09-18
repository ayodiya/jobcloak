import { describe, expect, it } from 'vitest';
import { DEFAULT_JOB_OPTIONS, QUEUE_NAMES, isQueueName } from '../src/queues.js';

describe('queues', () => {
  it('declares the documented queue set', () => {
    expect(QUEUE_NAMES).toEqual([
      'jobDiscovery',
      'jobParsing',
      'aiMatching',
      'documentGeneration',
      'applicationPreparation',
      'browserAutomation',
      'notifications',
    ]);
  });

  it('guards unknown queue names', () => {
    expect(isQueueName('jobDiscovery')).toBe(true);
    expect(isQueueName('nope')).toBe(false);
  });

  it('defaults to exponential backoff and bounded retention', () => {
    expect(DEFAULT_JOB_OPTIONS.attempts).toBe(5);
    expect(DEFAULT_JOB_OPTIONS.backoff).toEqual({ type: 'exponential', delay: 1000 });
    expect(DEFAULT_JOB_OPTIONS.removeOnComplete).toBeDefined();
    expect(DEFAULT_JOB_OPTIONS.removeOnFail).toBeDefined();
  });
});