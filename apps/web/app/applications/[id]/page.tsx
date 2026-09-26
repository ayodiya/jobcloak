'use client';

import { useParams } from 'next/navigation';
import { Box, Button, Card, CardContent, Chip, Divider, Typography } from '@mui/material';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useQuery } from '@tanstack/react-query';
import {
  apiFetch,
  APPLICATION_STATUSES,
  useTransitionStatus,
  type ApplicationDetail,
} from '../../../lib/api';
import {
  EmptyState,
  ErrorState,
  ExternalLink,
  LoadingState,
  StatusChip,
} from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const query = useQuery({
    queryKey: ['application', id],
    queryFn: () => apiFetch<ApplicationDetail>(`/applications/${encodeURIComponent(id)}`),
  });

  if (query.isError) {
    return (
      <ErrorState
        message={`Could not load this application: ${query.error?.message ?? 'unknown error'}`}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.isPending || !query.data) {
    return <LoadingState label="Loading application…" />;
  }

  const application = query.data;
  return (
    <>
      <Box
        component={Link}
        href="/applications"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          mb: 2,
          color: 'text.secondary',
          textDecoration: 'none',
        }}
      >
        <ArrowBackIcon sx={{ fontSize: 16 }} aria-hidden />
        Back to applications
      </Box>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 1 }}
          >
            <Typography variant="h4" component="h2" sx={{ mr: 1 }}>
              {application.job.title}
            </Typography>
            <StatusChip status={application.status} />
            <Chip label={application.mode} size="small" variant="outlined" />
          </Box>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {application.job.company}
            {application.job.location ? ` · ${application.job.location}` : ''}
            {application.job.remote ? ' · Remote' : ''}
          </Typography>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <ExternalLink href={application.job.url} label="View job posting" />
            {application.url ? (
              <ExternalLink href={application.url} label="Application URL" />
            ) : null}
            <Box
              component={Link}
              href={`/jobs/${application.job.id}`}
              sx={{ color: 'primary.main', fontSize: '0.8rem', textDecoration: 'none' }}
            >
              Job detail
            </Box>
          </div>
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Created {formatDateTime(application.createdAt)} · Updated{' '}
            {formatDateTime(application.updatedAt)}
            {application.submittedAt
              ? ` · Submitted ${formatDateTime(application.submittedAt)}`
              : ''}
            {application.verifiedAt
              ? ` · Verified ${formatDateTime(application.verifiedAt)}`
              : ''}
            {application.sourceName ? ` · Source ${application.sourceName}` : ''}
            {application.submissionKey ? ` · Submission key ${application.submissionKey}` : ''}
          </Typography>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
            Change status
          </Typography>
          <StatusTransition current={application.status} id={application.id} />
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
            Event history ({application.events.length})
          </Typography>
          {application.events.length === 0 ? (
            <EmptyState title="No events recorded yet" />
          ) : (
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {application.events.map((event) => (
                <Box
                  component="li"
                  key={event.id}
                  sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {event.type}
                    </Typography>
                    {event.stage ? (
                      <Chip label={event.stage} size="small" variant="outlined" />
                    ) : null}
                    <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
                      {formatDateTime(event.at)}
                    </Typography>
                  </div>
                  {event.payload !== undefined && event.payload !== null ? (
                    <Typography
                      component="pre"
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        m: 0,
                        overflowX: 'auto',
                        fontSize: '0.72rem',
                        lineHeight: 1.5,
                      }}
                    >
                      {JSON.stringify(event.payload, null, 2)}
                    </Typography>
                  ) : null}
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function StatusTransition({ current, id }: { current: string; id: string }) {
  const transition = useTransitionStatus(id);
  const options = APPLICATION_STATUSES.filter((status) => status !== current);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((status) => (
        <Button
          key={status}
          size="small"
          variant="outlined"
          disabled={transition.isPending}
          onClick={() => transition.mutate(status)}
        >
          {status}
        </Button>
      ))}
      {transition.isError ? (
        <Typography variant="caption" sx={{ color: 'error.main', width: '100%' }}>
          Transition failed: {transition.error?.message ?? 'unknown error'}
        </Typography>
      ) : null}
    </div>
  );
}
