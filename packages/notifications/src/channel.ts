export interface NotificationMessage {
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'error';
  channel?: string;
  fields?: Record<string, unknown>;
  at: string;
}

/**
 * A notification destination. Channels are registered centrally (see registry.js);
 * processor code never imports a channel directly so tests can swap in a memory
 * channel and production can fan out to many sinks.
 */
export interface NotificationChannel {
  readonly name: string;
  send(message: NotificationMessage): Promise<void>;
}
