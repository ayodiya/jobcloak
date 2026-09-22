import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from '@jobs-app/shared';
import type { NotificationMessage } from './channel.js';
import { createFileChannel } from './fileChannel.js';

describe('createFileChannel', () => {
  let dir: string;
  let path: string;
  const logger = { debug: vi.fn(), info: vi.fn() } as unknown as Logger;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'notifications-test-'));
    path = join(dir, 'nested', 'notifications.jsonl');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('creates the parent directory and appends one JSON line per message', async () => {
    const channel = createFileChannel({ path, logger });
    expect(channel.name).toBe(path);

    const first: NotificationMessage = {
      title: 'one',
      body: 'first',
      severity: 'info',
      at: '2026-09-11T18:00:00.000Z',
    };
    const second: NotificationMessage = {
      title: 'two',
      body: 'second',
      severity: 'warning',
      at: '2026-09-11T19:00:00.000Z',
    };
    await channel.send(first);
    await channel.send(second);

    const lines = (await readFile(path, 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!)).toMatchObject({ title: 'one', severity: 'info' });
    expect(JSON.parse(lines[1]!)).toMatchObject({ title: 'two', severity: 'warning' });
  });
});
