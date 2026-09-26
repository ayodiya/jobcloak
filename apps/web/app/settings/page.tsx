'use client';

import { Card, CardContent, Grid, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, type SettingsResponse } from '../../lib/api';
import { ErrorState, LoadingState, StatusChip } from '../../components/ui';
import { formatDateTime } from '../../lib/format';

export default function SettingsPage() {
  const query = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<SettingsResponse>('/settings'),
  });

  if (query.isError) {
    return (
      <ErrorState
        message={`Could not load settings: ${query.error?.message ?? 'unknown error'}`}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.isPending || !query.data) {
    return <LoadingState label="Loading settings…" />;
  }

  const settings = query.data;
  const statuses = settings.countsPresence.applications;

  return (
    <>
      <Typography variant="h4" component="h2">
        Settings
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Runtime configuration exposed by the API ({formatDateTime(settings.generatedAt)}).
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h3" sx={{ mb: 1.5 }}>
                Environment
              </Typography>
              <Stack spacing={0.75}>
                <Row label="Node environment" value={settings.environment.nodeEnv} />
                <Row label="API host" value={settings.environment.apiHost} />
                <Row label="API port" value={String(settings.environment.apiPort)} />
                <Row label="Web origin" value={settings.environment.webOrigin} />
                <Row label="Pipeline mode" value={settings.mode} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h3" sx={{ mb: 1.5 }}>
                Automation
              </Typography>
              <Stack spacing={0.75} sx={{ mb: 2 }}>
                <Row
                  label="Sources healthy"
                  value={`${settings.automation.sourcesHealthy}/${settings.automation.sourcesTotal}`}
                />
                <Row
                  label="Browser clients"
                  value={settings.automation.clients.join(', ') || '—'}
                />
              </Stack>
              <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                Applications by status
              </Typography>
              {Object.keys(statuses).length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  None recorded.
                </Typography>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(statuses).map(([status, count]) => (
                    <StatusChip key={status} status={`${status} · ${count}`} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
    </div>
  );
}
