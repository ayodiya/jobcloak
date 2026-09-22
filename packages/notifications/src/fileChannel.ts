import type { Logger } from '@jobs-app/shared';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { NotificationChannel, NotificationMessage } from './channel.js';

export interface FileChannelOptions {
  /** Absolute path of the JSONL file to append to. */
  path: string;
  logger: Logger;
}

/**
 * Append-only JSONL notification sink for a daily journal. The parent directory is
 * created on first send; every notification is one JSON line so the trail is
 * greppable and machine-readable while staying append-only.
 */
export function createFileChannel(options: FileChannelOptions): NotificationChannel {
  const { path, logger } = options;
  return {
    name: path,
    async send(message: NotificationMessage): Promise<void> {
      await mkdir(dirname(path), { recursive: true });
      await appendFile(path, `${JSON.stringify(message)}\n`, { encoding: 'utf8' });
      logger.debug(
        { path, title: message.title, severity: message.severity },
        'notification appended to file channel',
      );
    },
  };
}
