import { loadConfig, loadEnvFileIfExists } from '@jobs-app/config';
import { createLogger, withCorrelation } from '@jobs-app/shared';
import { stopWorkers, startWorkers } from '../src/worker.js';
import { registerProcessor } from '../src/worker.js';

loadEnvFileIfExists();

const config = loadConfig();
const logger = createLogger({ service: 'worker', level: config.LOG_LEVEL });

/**
 * Phase 1 bootstrap: prove the queue/worker/redis wiring end to end.
 * Domain processors attach from Phase 3 onwards.
 */
const registrations = [
  registerProcessor('notifications', async (job) => {
    withCorrelation(() => {
      logger.info({ jobId: job.id, payload: job.data }, 'sample notifications job processed');
    });
  }),
];

const workers = await startWorkers({ config, logger }, registrations);

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'shutting down workers');
  await stopWorkers(workers);
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));