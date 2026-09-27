import { describe, expect, it } from 'vitest';
import { ACTIVITY_CHANNEL } from '@jobs-app/shared';
import { createActivityHub } from '../src/activity.js';
import { FakeSubscriber, makeEvent } from './activity-helpers.js';

describe('createActivityHub', () => {
  it('keeps history bounded, oldest dropped first', () => {
    const hub = createActivityHub(() => new FakeSubscriber(), 2);
    hub.ingest(makeEvent({ id: 'a' }));
    hub.ingest(makeEvent({ id: 'b' }));
    hub.ingest(makeEvent({ id: 'c' }));
    expect(hub.list().map((e) => e.id)).toEqual(['b', 'c']);
  });

  it('notifies subscribers and returns an unsubscribe function', () => {
    const hub = createActivityHub(() => new FakeSubscriber());
    const seen: string[] = [];
    const unsubscribe = hub.subscribe((event) => seen.push(event.id));
    hub.ingest(makeEvent({ id: 'a' }));
    unsubscribe();
    hub.ingest(makeEvent({ id: 'b' }));
    expect(seen).toEqual(['a']);
  });

  it('subscribes to the shared channel and pushes live messages', async () => {
    const client = new FakeSubscriber();
    const hub = createActivityHub(() => client);
    await hub.start();
    expect(client.subscribed).toEqual([ACTIVITY_CHANNEL]);
    client.emitJson(JSON.stringify(makeEvent({ id: 'live' })));
    expect(hub.list().map((e) => e.id)).toEqual(['live']);
  });

  it('ignores malformed pub/sub frames', async () => {
    const client = new FakeSubscriber();
    const hub = createActivityHub(() => client);
    await hub.start();
    client.emitJson('{not-json');
    expect(hub.list()).toEqual([]);
  });

  it('seeds durable history once, on the first start only', async () => {
    const client = new FakeSubscriber();
    const hub = createActivityHub(() => client);
    await hub.start(async () => [makeEvent({ id: 'seeded' })]);
    await hub.start(async () => [makeEvent({ id: 'again' })]);
    expect(hub.list().map((e) => e.id)).toEqual(['seeded']);
  });

  it('stop unsubscribes and quits the client', async () => {
    const client = new FakeSubscriber();
    const hub = createActivityHub(() => client);
    await hub.start();
    await hub.stop();
    expect(client.unsubscribed).toEqual([ACTIVITY_CHANNEL]);
    expect(client.quitCalls).toBe(1);
  });

  it('recovers after a failed subscription attempt', async () => {
    class FailingSubscriber extends FakeSubscriber {
      override async subscribe(): Promise<void> {
        throw new Error('boom');
      }

      override async quit(): Promise<void> {
        throw new Error('quit-boom');
      }
    }
    let attempts = 0;
    const hub = createActivityHub(() => {
      attempts += 1;
      return attempts === 1 ? new FailingSubscriber() : new FakeSubscriber();
    });
    await expect(hub.start()).rejects.toThrow('boom');
    // second call retries with a fresh client instead of wedging stopped
    await hub.start();
    expect(attempts).toBe(2);
  });
});
