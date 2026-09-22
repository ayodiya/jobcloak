import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '@jobs-app/shared';
import { createConsoleChannel } from './consoleChannel.js';

describe('createConsoleChannel', () => {
  it('logs title, body, and metadata through the logger', async () => {
    const info = vi.fn();
    const logger = { info } as unknown as Logger;
    const channel = createConsoleChannel(logger);
    expect(channel.name).toBe('console');
    await channel.send({
      title: 'Daily report',
      body: 'all good',
      severity: 'info',
      at: '2026-09-11T18:00:00.000Z',
      fields: { a: 1 },
    });
    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      { severity: 'info', fields: { a: 1 }, at: '2026-09-11T18:00:00.000Z' },
      'Daily report: all good',
    );
  });
});
