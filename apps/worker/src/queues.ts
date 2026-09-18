import { Queue, type ConnectionOptions, type JobsOptions } from 'bullmq';
import type { Env } from '@jobs-app/config';

export const QUEUE_NAMES = [
  'jobDiscovery',
  'jobParsing',
  'aiMatching',
  'documentGeneration',
  'applicationPreparation',
  'browserAutomation',
  'notifications',
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

export function isQueueName(value: string): value is QueueName {
  return (QUEUE_NAMES as readonly string[]).includes(value);
}

/** Default job options: retry with exponential backoff, kept modest for local runs. */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

export function queueConnectionOptions(config: Env): ConnectionOptions {
  return {
    url: config.REDIS_URL,
    maxRetriesPerRequest: null,
  } as ConnectionOptions;
}

export function createQueue(name: QueueName, config: Env): Queue {
  return new Queue(name, {
    connection: queueConnectionOptions(config),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
}