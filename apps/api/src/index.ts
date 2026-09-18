import { loadConfig, loadEnvFileIfExists } from '@jobs-app/config';
import { createLogger } from '@jobs-app/shared';
import { startServer } from './server.js';

loadEnvFileIfExists();

const config = loadConfig();
const logger = createLogger({ service: 'api', level: config.LOG_LEVEL });

try {
  await startServer({ config, logger });
} catch (error) {
  logger.error({ error }, 'api exited');
  process.exitCode = 1;
}