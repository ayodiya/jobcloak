import { describe, expect, it } from 'vitest';
import type { NotificationChannel, NotificationMessage } from './channel.js';
import { createNotificationRegistry } from './registry.js';

const message: NotificationMessage = {
  title: 't',
  body: 'b',
  severity: 'info',
  at: '2026-09-11T00:00:00.000Z',
};

function memoryChannel(name: string, sink: string[]): NotificationChannel {
  return {
    name,
    async send(m) {
      sink.push(`${name}:${m.title}`);
    },
  };
}

function failingChannel(name: string): NotificationChannel {
  return {
    name,
    async send() {
      throw new Error('boom');
    },
  };
}

describe('createNotificationRegistry', () => {
  it('registers channels and rejects duplicates', () => {
    const registry = createNotificationRegistry();
    registry.register(memoryChannel('a', []));
    expect(registry.has('a')).toBe(true);
    expect(registry.get('a')?.name).toBe('a');
    expect(registry.names()).toEqual(['a']);
    expect(() => registry.register(memoryChannel('a', []))).toThrow(/duplicate/i);
  });

  it('sendTo delivers to a named channel and throws on unknown names', async () => {
    const sink: string[] = [];
    const registry = createNotificationRegistry([memoryChannel('mem', sink)]);
    const result = await registry.sendTo('mem', message);
    expect(result).toEqual({ channel: 'mem', ok: true });
    expect(sink).toEqual(['mem:t']);
    await expect(registry.sendTo('nope', message)).rejects.toThrow(/unknown/i);
  });

  it('send fans out to every channel and collects failures without throwing', async () => {
    const sink: string[] = [];
    const registry = createNotificationRegistry([
      memoryChannel('ok', sink),
      failingChannel('bad'),
    ]);
    const results = await registry.send(message);
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.channel === 'ok')?.ok).toBe(true);
    const bad = results.find((r) => r.channel === 'bad');
    expect(bad?.ok).toBe(false);
    expect(bad?.error).toBe('boom');
    expect(sink).toEqual(['ok:t']);
  });
});
