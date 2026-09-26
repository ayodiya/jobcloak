'use client';

import {
  Box,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, type DashboardResponse } from '../../lib/api';
import {
  EmptyState,
  ErrorState,
  JobLink,
  LoadingState,
  ScoreBadge,
  StatusChip,
} from '../../components/ui';
import { formatDateTime } from '../../lib/format';

interface Kpi {
  label: string;
  value: number | string;
  tone?: 'good' | 'warn' | 'bad';
}

export default function DashboardPage() {
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<DashboardResponse>('/dashboard'),
  });

  if (query.isError) {
    return (
      <ErrorState
        message={`Could not load the dashboard: ${query.error?.message ?? 'unknown error'}`}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.isPending || !query.data) {
    return <LoadingState label="Loading dashboard…" />;
  }

  const data = query.data;
  const statuses = data.counts.applicationsByStatus;
  const statusTotal = Object.values(statuses).reduce((sum, count) => sum + count, 0);

  const kpis: Kpi[] = [
    { label: 'Active jobs', value: data.counts.activeJobs },
    { label: 'Total jobs', value: data.counts.jobs },
    {
      label: 'Eligible matches',
      value: data.counts.matchesEligible,
      tone: data.counts.matchesEligible > 0 ? 'good' : undefined,
    },
    { label: 'Applications', value: statusTotal },
    {
      label: 'In queue',
      value: data.automation.inQueue,
      tone: data.automation.inQueue > 0 ? 'warn' : undefined,
    },
    {
      label: 'Blocked events',
      value: data.automation.blockedEvents,
      tone: data.automation.blockedEvents > 0 ? 'bad' : undefined,
    },
    {
      label: 'Sources healthy',
      value:
        data.counts.sourcesTotal > 0
          ? `${data.counts.sourcesHealthy}/${data.counts.sourcesTotal}`
          : '—',
    },
    { label: 'Materials', value: data.counts.materials },
  ];

  return (
    <>
      <Typography variant="h4" component="h2">
        Dashboard
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Generated {formatDateTime(data.generatedAt)}
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {kpis.map((kpi) => (
          <Grid size={{ xs: 6, sm: 4, md: 3 }} key={kpi.label}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Typography
                  variant="h5"
                  component="p"
                  sx={{
                    fontWeight: 700,
                    color:
                      kpi.tone === 'good'
                        ? 'success.main'
                        : kpi.tone === 'warn'
                          ? 'warning.main'
                          : kpi.tone === 'bad'
                            ? 'error.main'
                            : 'text.primary',
                  }}
                >
                  {kpi.value}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {kpi.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                Recent applications
              </Typography>
              {data.recentApplications.length === 0 ? (
                <EmptyState
                  title="No applications yet"
                  hint="Candidates flow here once applications are prepared."
                />
              ) : (
                <TableContainer>
                  <Table size="small" aria-label="Recent applications">
                    <TableHead>
                      <TableRow>
                        <TableCell>Job</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Updated</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.recentApplications.map((app) => (
                        <TableRow key={app.id} hover>
                          <TableCell>
                            <JobLink href={`/applications/${app.id}`} title={app.job.title} />
                            <Typography
                              variant="caption"
                              sx={{ color: 'text.secondary', display: 'block' }}
                            >
                              {app.job.company}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <StatusChip status={app.status} />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {formatDateTime(app.updatedAt)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <StackContent data={data} statuses={statuses} statusTotal={statusTotal} />
        </Grid>
      </Grid>
    </>
  );
}

function StackContent({
  data,
  statuses,
  statusTotal,
}: {
  data: DashboardResponse;
  statuses: Record<string, number>;
  statusTotal: number;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
            Applications by status
          </Typography>
          {statusTotal === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              None yet.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {Object.entries(statuses).map(([status, count]) => (
                <StatusChip key={status} status={`${status} · ${count}`} />
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
            Top matches
          </Typography>
          {data.topMatches.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No matches scored yet — run discovery, then matching.
            </Typography>
          ) : (
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {data.topMatches.map((match) => (
                <Box
                  component="li"
                  key={match.matchId}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    py: 0.75,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <ScoreBadge score={match.totalScore} />
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <JobLink href={`/jobs/${match.jobId}`} title={match.jobTitle} />
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'block' }}
                    >
                      {match.company}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
