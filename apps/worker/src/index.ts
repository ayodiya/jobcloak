import { resolve } from 'node:path';
import type { Queue } from 'bullmq';
import { prisma } from '@jobs-app/database';
import { loadConfig, loadEnvFileIfExists } from '@jobs-app/config';
import { JobService } from '@jobs-app/jobs';
import { MatchingService } from '@jobs-app/matching';
import {
  createConsoleChannel,
  createFileChannel,
  createNotificationRegistry,
} from '@jobs-app/notifications';
import { ACTIVITY_CHANNEL, createLogger, type WorkerActivityEvent } from '@jobs-app/shared';
import { Redis } from 'ioredis';
import { redisLimitStore } from './limits.js';
import {
  createJobDiscoveryProcessor,
  createLimitGuardedProcessor,
  createMatchingProcessor,
  createNotificationsProcessor,
  type ProcessorDeps,
} from './processors.js';
import { createQueue, QUEUE_NAMES, type QueueName } from './queues.js';
import { upsertSchedulers } from './scheduler.js';
import { registerProcessor, startWorkers, stopWorkers } from './worker.js';

loadEnvFileIfExists();

const config = loadConfig();
const logger = createLogger({ service: 'worker', level: config.LOG_LEVEL });

// Notification channels: structured log (console) + append-only JSONL journal.
const registry = createNotificationRegistry([
  createConsoleChannel(logger),
  createFileChannel({ path: resolve('data', 'notifications.jsonl'), logger }),
]);

const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const store = redisLimitStore(redis);

const queues = new Map<QueueName, Queue>(
  QUEUE_NAMES.map((name) => [name, createQueue(name, config)]),
);

// Discovery persists listings and source health into Postgres. Injected as
// `discover` so processor deps stay decoupled from the jobs package. Matching
// is deterministic scoring against the candidate profile; injected as
// `matchAll` for the scheduled aiMatching processor.
const jobService = new JobService();
const matchingService = new MatchingService();
const deps: ProcessorDeps = {
  config,
  logger,
  registry,
  store,
  queues,
  discover: (sourceName, keywords) =>
    jobService.discover({
      sourceName,
      ...(keywords && keywords.length > 0 ? { keywords } : {}),
    }),
  matchAll: (filter) => matchingService.matchAll(filter),
};

// Dedicated publish client for the realtime activity feed. Subscribers
// (the API) listen on one redis connection; publishing on a second
// connection avoids buffering contention with the worker connections.
const activityPub = redis.duplicate({ maxRetriesPerRequest: null });

/**
 * Fire-and-forget publisher for the realtime activity feed. Every finished
 * job is broadcast on the shared pub/sub channel and appended to the audit
 * trail so the dashboard can replay history across restarts.
 */
const publishActivity = async (event: WorkerActivityEvent): Promise<void> => {
  try {
    await activityPub.publish(ACTIVITY_CHANNEL, JSON.stringify(event));
  } catch (error) {
    logger.warn({ error: String(error) }, 'activity pub/sub publish failed');
  }
  try {
    await prisma.auditLog.create({
      data: {
        action: `worker.${event.outcome}`,
        entityType: event.queue,
        entityId: event.jobId,
        metadata: {
          jobName: event.jobName,
          durationMs: event.durationMs,
          error: event.error,
          detail: event.detail,
          at: event.at,
        },
      },
    });
  } catch (error) {
    logger.warn({ error: String(error) }, 'activity audit write failed');
  }
};

const registrations = [
  registerProcessor('notifications', createNotificationsProcessor(deps)),
  registerProcessor('jobDiscovery', createJobDiscoveryProcessor(deps)),
  registerProcessor(
    'applicationPreparation',
    createLimitGuardedProcessor('applicationPreparation', deps),
  ),
  registerProcessor('browserAutomation', createLimitGuardedProcessor('application', deps)),
  registerProcessor('aiMatching', createMatchingProcessor(deps)),
];

// Schedulers live in Redis on their own; upserting every boot keeps them in
// sync with code and deliberately leaves them in place across restarts.
const schedulerIds = await upsertSchedulers(queues);
logger.info({ schedulers: schedulerIds }, 'repeatable schedulers upserted');

const workers = await startWorkers({ config, logger, publish: publishActivity }, registrations);

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'shutting down workers');
  await stopWorkers(workers);
  await Promise.allSettled([...queues.values()].map((queue) => queue.close()));

  await activityPub.quit().catch(() => undefined);
  await redis.quit().catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
