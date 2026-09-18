import { describe, expect, it, vi } from 'vitest';
import { Queue } from 'bullmq';
import { DEFAULT_JOB_OPTIONS, createQueue, queueConnectionOptions, type QueueName } from '../src/queues.js';
import { registerProcessor } from '../src/worker.js';

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({ name: 'mocked-queue' } as any)),
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn(), close: vi.fn() })),
})) as any;

describe('registerProcessor', () => {
  it('accepts known queues', () => {
    expect(registerProcessor('jobDiscovery', async () => undefined).queue).toBe('jobDiscovery');
  });

  it('rejects unknown queues at registration time', () => {
    expect(() =>
      registerProcessor('doesNotExist' as QueueName, async () => undefined),
    ).toThrow(/unknown queue/);
  });
});

describe('Queue creation', () => {
  it('constructs a queue with default options', () => {
    const config = { REDIS_URL: 'redis://localhost:6380' };
    const queue = createQueue('jobDiscovery', config as never);
    expect(Queue).toHaveBeenCalled();
    expect(DEFAULT_JOB_OPTIONS.attempts).toBeGreaterThan(0);
    expect((queueConnectionOptions(config as never) as { url: string }).url).toBe(
      'redis://localhost:6380',
    );
    expect(queue).toBeDefined();
  });
});