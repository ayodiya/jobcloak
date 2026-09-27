import { ACTIVITY_CHANNEL, type WorkerActivityEvent } from '@jobs-app/shared';

export const ACTIVITY_HISTORY_LIMIT = 200;

/**
 * Minimal redis client surface the hub talks to. Narrow enough to satisfy
 * ioredis and trivially fakeable in unit tests (EventEmitter works).
 */
export interface ActivitySubscriberClient {
  subscribe(channel: string): Promise<unknown>;
  unsubscribe(channel: string): Promise<unknown>;
  on(event: 'message', listener: (channel: string, message: string) => void): this;
  off(event: 'message', listener: (channel: string, message: string) => void): this;
  quit(): Promise<unknown>;
}

export interface ActivityHub {
  /** Buffered events, oldest first. */
  list(): WorkerActivityEvent[];
  /** Subscribe to new events; returns an unsubscribe function. */
  subscribe(listener: (event: WorkerActivityEvent) => void): () => void;
  /** Push an event directly (used by tests and the pub/sub listener). */
  ingest(event: WorkerActivityEvent): void;
  /**
   * Connect the subscriber and (on first call) optionally seed history from a
   * durable source. Idempotent: safe to call on every request; failures are
   * swallowed by callers and the hub keeps serving buffered history.
   */
  start(historyLoader?: () => Promise<WorkerActivityEvent[]>): Promise<void>;
  stop(): Promise<void>;
}

export function createActivityHub(
  clientFactory: () => ActivitySubscriberClient,
  historyLimit = ACTIVITY_HISTORY_LIMIT,
): ActivityHub {
  let client: ActivitySubscriberClient | null = null;
  let started = false;
  const listeners = new Set<(event: WorkerActivityEvent) => void>();
  const history: WorkerActivityEvent[] = [];

  const onMessage = (channel: string, message: string): void => {
    if (channel !== ACTIVITY_CHANNEL) return;
    try {
      ingest(JSON.parse(message) as WorkerActivityEvent);
    } catch {
      // malformed frame → ignore, never take the feed down
    }
  };

  function ingest(event: WorkerActivityEvent): void {
    history.push(event);
    if (history.length > historyLimit) {
      history.splice(0, history.length - historyLimit);
    }
    for (const listener of listeners) listener(event);
  }

  return {
    list: () => [...history],
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    ingest,
    async start(historyLoader) {
      if (started) return;
      started = true;
      try {
        if (historyLoader) {
          try {
            for (const event of await historyLoader()) ingest(event);
          } catch {
            // durable-history read failed; keep going on live pub/sub only
          }
        }
        client = clientFactory();
        client.on('message', onMessage);
        await client.subscribe(ACTIVITY_CHANNEL);
      } catch (error) {
        started = false;
        if (client) {
          client.off('message', onMessage);
          void client.quit().catch(() => undefined);
          client = null;
        }
        throw error;
      }
    },
    async stop() {
      if (client) {
        client.off('message', onMessage);
        try {
          await client.unsubscribe(ACTIVITY_CHANNEL);
        } catch {
          // ignore
        }
        await client.quit().catch(() => undefined);
        client = null;
      }
      started = false;
    },
  };
}
