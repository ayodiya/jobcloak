'use client';

import { useParams } from 'next/navigation';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, type JobDetail } from '../../../lib/api';
import {
  ErrorState,
  ExternalLink,
  LoadingState,
  MoneyText,
  ScoreBadge,
  StatusChip,
} from '../../../components/ui';
import { formatDate, formatDateTime } from '../../../lib/format';

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const query = useQuery({
    queryKey: ['job', id],
    queryFn: () => apiFetch<JobDetail>(`/jobs/${encodeURIComponent(id)}`),
  });

  if (query.isError) {
    return (
      <ErrorState
        message={`Could not load this job: ${query.error?.message ?? 'unknown error'}`}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.isPending || !query.data) {
    return <LoadingState label="Loading job…" />;
  }

  const job = query.data;

  return (
    <>
      <Box
        component={Link}
        href="/jobs"
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
        Back to jobs
      </Box>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 1.5, mb: 1 }}
          >
            <Typography variant="h4" component="h2" sx={{ mr: 1 }}>
              {job.title}
            </Typography>
          </Box>
          <Box
            sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 1.5 }}
          >
            <Chip label={job.company} size="small" />
            <StatusChip status={job.status} />
            <Chip label={job.remote ? 'Remote' : 'On-site'} size="small" variant="outlined" />
            {job.location ? (
              <Chip label={job.location} size="small" variant="outlined" />
            ) : null}
            {job.employmentType ? (
              <Chip label={job.employmentType} size="small" variant="outlined" />
            ) : null}
            {job.seniority ? (
              <Chip label={job.seniority} size="small" variant="outlined" />
            ) : null}
            <ExternalLink href={job.url} label="Original posting" />
          </Box>
          <Typography variant="body2">
            Salary:{' '}
            <MoneyText min={job.salaryMin} max={job.salaryMax} currency={job.salaryCurrency} />{' '}
            · Source: {job.sourceName}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Posted {formatDate(job.postedAt)} · discovered {formatDateTime(job.discoveredAt)} ·
            last seen {formatDateTime(job.lastSeenAt)} · {job.applicationsCount}{' '}
            {job.applicationsCount === 1 ? 'application' : 'applications'}
          </Typography>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                Description
              </Typography>
              {job.description.trim() ? (
                <Typography
                  variant="body2"
                  component="div"
                  sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}
                >
                  {job.description.trim()}
                </Typography>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  No description stored.
                </Typography>
              )}
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                Requirements ({job.requirements.length})
              </Typography>
              {job.requirements.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  No requirements extracted.
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small" aria-label="Job requirements">
                    <TableHead>
                      <TableRow>
                        <TableCell>Requirement</TableCell>
                        <TableCell>Kind</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell align="right">Years</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {job.requirements.map((requirement) => (
                        <TableRow key={`${requirement.category}-${requirement.key}`} hover>
                          <TableCell>{requirement.name}</TableCell>
                          <TableCell>{requirement.kind}</TableCell>
                          <TableCell>{requirement.category}</TableCell>
                          <TableCell align="right">{requirement.minYears ?? '—'}</TableCell>
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
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <Typography variant="h6" component="h3" sx={{ mb: 0 }}>
                  Match
                </Typography>
                {job.match ? (
                  <ScoreBadge score={job.match.totalScore} />
                ) : (
                  <Chip label="Not scored" size="small" />
                )}
                {job.match?.eligible ? (
                  <Chip label="Eligible" color="success" size="small" />
                ) : null}
              </Box>
              {job.matchDimensions.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Run matching for this job to see dimension scores.
                </Typography>
              ) : (
                <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                  {job.matchDimensions.map((dimension) => (
                    <Box
                      component="li"
                      key={dimension.key}
                      sx={{ py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {dimension.key}
                        </Typography>
                        <ScoreBadge score={dimension.score} />
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {dimension.status}
                        {dimension.detail ? ` — ${dimension.detail}` : ''}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
