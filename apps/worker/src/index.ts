import { resolve } from 'node:path';
import type { Queue } from 'bullmq';
import { loadConfig, loadEnvFileIfExists } from '@jobs-app/config';
import {
  createConsoleChannel,
  createFileChannel,
  createNotificationRegistry,
} from '@jobs-app/notifications';
import { createLogger } from '@jobs-app/shared';
import { Redis } from 'ioredis';
import { redisLimitStore } from './limits.js';
import {
  createLimitGuardedProcessor,
  createLogOnlyProcessor,
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

const deps: ProcessorDeps = { config, logger, registry, store, queues };

const registrations = [
  registerProcessor('notifications', createNotificationsProcessor(deps)),
  registerProcessor('jobDiscovery', createLimitGuardedProcessor('jobDiscovery', deps)),
  registerProcessor(
    'applicationPreparation',
    createLimitGuardedProcessor('applicationPreparation', deps),
  ),
  registerProcessor('browserAutomation', createLimitGuardedProcessor('application', deps)),
  registerProcessor('aiMatching', createLogOnlyProcessor('aiMatching', deps)),
];

// Schedulers live in Redis on their own; upserting every boot keeps them in
// sync with code and deliberately leaves them in place across restarts.
const schedulerIds = await upsertSchedulers(queues);
logger.info({ schedulers: schedulerIds }, 'repeatable schedulers upserted');

const workers = await startWorkers({ config, logger }, registrations);

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'shutting down workers');
  await stopWorkers(workers);
  await Promise.allSettled([...queues.values()].map((queue) => queue.close()));
  await redis.quit().catch(() => undefined);
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
