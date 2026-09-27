'use client';

import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import { API_BASE, type WorkerActivityEvent } from '../lib/api';

const MAX_ITEMS = 100;

type ConnectionState = 'connecting' | 'live' | 'reconnecting';

const OUTCOME_LABEL: Record<WorkerActivityEvent['outcome'], string> = {
  completed: 'Done',
  skipped: 'Skipped',
  failed: 'Failed',
};

function outcomeColor(outcome: WorkerActivityEvent['outcome']) {
  if (outcome === 'completed') return 'success.main';
  if (outcome === 'skipped') return 'warning.main';
  return 'error.main';
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Live "Worker activity" feed: subscribes to the API's SSE stream and shows
 * every background job the worker has completed, skipped or failed. New
 * events are prepended; the stream replays the last ~50 on connect so the
 * panel never looks empty right after a page load.
 */
export default function ActivityFeed() {
  const [events, setEvents] = useState<WorkerActivityEvent[]>([]);
  const [status, setStatus] = useState<ConnectionState>('connecting');

  useEffect(() => {
    const source = new EventSource(`${API_BASE}/activity/stream`);
    source.onopen = () => setStatus('live');
    source.onerror = () => setStatus('reconnecting');
    const onActivity = (message: MessageEvent) => {
      try {
        const event = JSON.parse(message.data as string) as WorkerActivityEvent;
        setEvents((prev) => [event, ...prev].slice(0, MAX_ITEMS));
      } catch {
        // malformed frame → ignore
      }
    };
    source.addEventListener('activity', onActivity);
    return () => {
      source.close();
    };
  }, []);

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="h6" component="h3" sx={{ flexGrow: 1 }}>
            Worker activity
          </Typography>
          <Chip
            label={status}
            size="small"
            variant="outlined"
            sx={{
              color: status === 'live' ? 'success.main' : 'warning.main',
              borderColor: 'divider',
            }}
          />
        </Box>
        {events.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Waiting for background jobs…
          </Typography>
        ) : (
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {events.map((event) => (
              <Box
                component="li"
                key={event.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  py: 0.75,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    flexShrink: 0,
                    bgcolor: outcomeColor(event.outcome),
                  }}
                />
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography variant="body2" noWrap>
                    {event.queue}
                    <Typography
                      component="span"
                      variant="body2"
                      sx={{ color: 'text.secondary' }}
                    >
                      {' · '}
                    </Typography>
                    {event.jobName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    #{event.jobId} · {timeAgo(event.at)}
                    {event.durationMs != null
                      ? ` · ${(event.durationMs / 1000).toFixed(1)}s`
                      : ''}
                  </Typography>
                </Box>
                <Chip label={OUTCOME_LABEL[event.outcome]} size="small" variant="outlined" />
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
