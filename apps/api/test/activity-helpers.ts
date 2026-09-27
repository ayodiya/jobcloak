import { EventEmitter } from 'node:events';
import { ACTIVITY_CHANNEL, type WorkerActivityEvent } from '@jobs-app/shared';
import type { ActivitySubscriberClient } from '../src/activity.js';

export function makeEvent(overrides: Partial<WorkerActivityEvent> = {}): WorkerActivityEvent {
  return {
    id: 'evt-1',
    queue: 'jobDiscovery',
    jobId: 'job-1',
    jobName: 'scheduled-discovery',
    outcome: 'completed',
    at: '2026-09-27T10:00:00.000Z',
    durationMs: 4,
    error: null,
    detail: null,
    ...overrides,
  };
}

/** In-memory stand-in for ioredis; Exerciseable without a live server. */
export class FakeSubscriber extends EventEmitter implements ActivitySubscriberClient {
  public subscribed: string[] = [];
  public unsubscribed: string[] = [];
  public quitCalls = 0;

  async subscribe(channel: string): Promise<void> {
    this.subscribed.push(channel);
  }

  async unsubscribe(channel: string): Promise<void> {
    this.unsubscribed.push(channel);
  }

  async quit(): Promise<void> {
    this.quitCalls += 1;
  }

  emitMessage(channel: string, message: string): void {
    this.emit('message', channel, message);
  }

  emitJson(message: string): void {
    this.emitMessage(ACTIVITY_CHANNEL, message);
  }
}
