import type { Logger } from '@jobs-app/shared';
import type { NotificationChannel, NotificationMessage } from './channel.js';

/**
 * Log-based channel. The default local sink — structured output through the
 * existing logger keeps correlation/redaction for free.
 */
export function createConsoleChannel(logger: Logger): NotificationChannel {
  const name = 'console';
  return {
    name,
    async send(message: NotificationMessage): Promise<void> {
      logger.info(
        { severity: message.severity, fields: message.fields, at: message.at },
        `${message.title}: ${message.body}`,
      );
    },
  };
}
