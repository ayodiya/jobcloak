import type { NotificationChannel, NotificationMessage } from './channel.js';

export interface SendResult {
  channel: string;
  ok: boolean;
  error?: string;
}

/**
 * Central channel registry. Duplicate registration is a programmer error and
 * throws; a failed channel delivery is an operational condition and is reported
 * per-channel instead of failing the fan-out (one dead sink must not take the
 * others down with it).
 */
export interface NotificationRegistry {
  register(channel: NotificationChannel): void;
  has(name: string): boolean;
  get(name: string): NotificationChannel | undefined;
  names(): string[];
  /** Deliver to one channel. Throws when the channel was never registered. */
  sendTo(name: string, message: NotificationMessage): Promise<SendResult>;
  /** Deliver to every registered channel; never throws. */
  send(message: NotificationMessage): Promise<SendResult[]>;
}

export function createNotificationRegistry(
  initial: NotificationChannel[] = [],
): NotificationRegistry {
  const channels = new Map<string, NotificationChannel>();

  const register = (channel: NotificationChannel): void => {
    if (channels.has(channel.name)) {
      throw new Error(`Duplicate notification channel "${channel.name}"`);
    }
    channels.set(channel.name, channel);
  };

  for (const channel of initial) {
    register(channel);
  }

  return {
    register,
    has: (name) => channels.has(name),
    get: (name) => channels.get(name),
    names: () => [...channels.keys()],
    async sendTo(name, message) {
      const channel = channels.get(name);
      if (!channel) {
        throw new Error(`Unknown notification channel "${name}"`);
      }
      try {
        await channel.send(message);
        return { channel: name, ok: true };
      } catch (error) {
        return {
          channel: name,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    async send(message) {
      return Promise.all(
        [...channels.values()].map((channel) =>
          (async (): Promise<SendResult> => {
            try {
              await channel.send(message);
              return { channel: channel.name, ok: true };
            } catch (error) {
              return {
                channel: channel.name,
                ok: false,
                error: error instanceof Error ? error.message : String(error),
              };
            }
          })(),
        ),
      );
    },
  };
}
