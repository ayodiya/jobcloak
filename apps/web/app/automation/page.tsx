'use client';

import { Box, Card, CardContent, Chip, Grid, Typography } from '@mui/material';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, type AutomationResponse } from '../../lib/api';
import { ErrorState, LoadingState } from '../../components/ui';
import { formatDateTime } from '../../lib/format';

export default function AutomationPage() {
  const query = useQuery({
    queryKey: ['automation'],
    queryFn: () => apiFetch<AutomationResponse>('/automation'),
  });

  if (query.isError) {
    return (
      <ErrorState
        message={`Could not load automation state: ${query.error?.message ?? 'unknown error'}`}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.isPending || !query.data) {
    return <LoadingState label="Loading automation state…" />;
  }

  const { pipeline, recentBlocked } = query.data;

  const cards = [
    {
      label: 'Review mode',
      value: pipeline.reviewMode ? 'On' : 'Off',
      tone: pipeline.reviewMode ? 'good' : 'warn',
    },
    { label: 'Active jobs', value: pipeline.jobsActive },
    { label: 'Eligible matches', value: pipeline.matchesEligible },
    { label: 'In queue', value: pipeline.inQueue, tone: pipeline.inQueue ? 'warn' : undefined },
    { label: 'Prepared', value: pipeline.prepared },
    { label: 'In progress', value: pipeline.inProgress },
    { label: 'Submitted', value: pipeline.submitted },
    { label: 'Verified', value: pipeline.verified },
    { label: 'Failed', value: pipeline.failed, tone: pipeline.failed ? 'bad' : undefined },
    { label: 'Cancelled', value: pipeline.cancelled },
    {
      label: 'Rejected',
      value: pipeline.rejected,
      tone: pipeline.rejected ? 'bad' : undefined,
    },
    { label: 'Submission-keyed', value: pipeline.submissionKeyed },
    {
      label: 'Blocked events',
      value: pipeline.blockedEvents,
      tone: pipeline.blockedEvents ? 'bad' : undefined,
    },
    { label: 'Sources healthy', value: `${pipeline.sourcesHealthy}/${pipeline.sourcesTotal}` },
  ];

  return (
    <>
      <Typography variant="h4" component="h2">
        Automation
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        End-to-end pipeline from discovery to submission.
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 3 }}>
        Generated {formatDateTime(query.data.generatedAt)}
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {cards.map((card) => (
          <Grid size={{ xs: 6, sm: 4, md: 3 }} key={card.label}>
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5, textAlign: 'center' }}>
                <Typography
                  variant="h5"
                  component="p"
                  sx={{
                    fontWeight: 700,
                    color:
                      card.tone === 'good'
                        ? 'success.main'
                        : card.tone === 'warn'
                          ? 'warning.main'
                          : card.tone === 'bad'
                            ? 'error.main'
                            : 'text.primary',
                  }}
                >
                  {card.value}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {card.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
            Recently blocked events
          </Typography>
          {recentBlocked.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No blocked events recorded.
            </Typography>
          ) : (
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {recentBlocked.map((event) => (
                <Box
                  component="li"
                  key={event.applicationId}
                  sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}
                >
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={event.eventType}
                      size="small"
                      color="warning"
                      variant="outlined"
                    />
                    <Typography variant="body2">
                      {event.jobTitle ?? 'Unknown job'}
                      {event.company ? ` at ${event.company}` : ''}
                    </Typography>
                    <Box
                      component={Link}
                      href={`/applications/${event.applicationId}`}
                      sx={{ ml: 'auto', color: 'primary.main', fontSize: '0.8rem' }}
                    >
                      Application
                    </Box>
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {event.stage ? `Stage ${event.stage} · ` : ''}
                    {formatDateTime(event.at)}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    </>
  );
}
