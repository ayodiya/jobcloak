import { Worker, type Job, type Processor } from 'bullmq';
import type { Env } from '@jobs-app/config';
import type { Logger } from '@jobs-app/shared';
import { isQueueName, queueConnectionOptions, type QueueName } from './queues.js';

export interface WorkerRegistration<T> {
  queue: QueueName;
  processor: Processor<T>;
}

export interface StartWorkersOptions {
  config: Env;
  logger: Logger;
  /** The queues this process will process. Empty set = process all known queues. */
  queues?: QueueName[];
}

/**
 * Start BullMQ workers for the requested queues.
 *
 * All workers are idempotent by contract: processors must tolerate being run
 * more than once for the same job (unique constraints / idempotency keys carry
 * the deduplication burden).
 */
export async function startWorkers(
  options: StartWorkersOptions,
  fns: Array<WorkerRegistration<unknown>>,
): Promise<Worker[]> {
  const { config, logger } = options;
  const enabled = new Set<QueueName>(options.queues ?? (fns.map((fn) => fn.queue) as QueueName[]));

  const workers: Worker[] = [];
  try {
    for (const fn of fns) {
      if (!enabled.has(fn.queue)) continue;
      const worker = new Worker(fn.queue, fn.processor, {
        connection: queueConnectionOptions(config),
        concurrency: 4,
      });
      worker.on('completed', (job: Job) =>
        logger.info({ queue: fn.queue, jobId: job.id }, 'job completed'),
      );
      worker.on('failed', (job: Job | undefined, error: Error) =>
        logger.error(
          { queue: fn.queue, jobId: job?.id, error: { message: error.message } },
          'job failed',
        ),
      );
      worker.on('error', (error: Error) =>
        logger.error({ queue: fn.queue, error: { message: error.message } }, 'worker error'),
      );
      workers.push(worker);
      logger.info({ queue: fn.queue }, 'worker started');
    }
  } catch (error) {
    // best-effort cleanup: close whatever started, then rethrow
    await Promise.allSettled(workers.map((w) => w.close()));
    throw error;
  }
  return workers;
}

export async function stopWorkers(workers: Worker[]): Promise<void> {
  await Promise.allSettled(workers.map((worker) => worker.close()));
}

/**
 * Registry helper so processors can be registered from any package.
 * Central wiring happens in apps/worker/src/registry.
 */
export function registerProcessor<T>(
  queue: QueueName,
  processor: Processor<T>,
): WorkerRegistration<T> {
  if (!isQueueName(queue)) {
    throw new Error(`Attempted to register unknown queue "${queue}"`);
  }
  return { queue, processor };
}

export type { Processor, Job };