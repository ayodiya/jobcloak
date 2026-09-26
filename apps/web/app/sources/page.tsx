'use client';

import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import Chip from '@mui/material/Chip';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, type SourceItem } from '../../lib/api';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { formatDateTime } from '../../lib/format';

export default function SourcesPage() {
  const query = useQuery({
    queryKey: ['sources'],
    queryFn: () => apiFetch<{ items: SourceItem[]; total: number; limit: number }>('/sources'),
  });

  if (query.isError) {
    return (
      <ErrorState
        message={`Could not load sources: ${query.error?.message ?? 'unknown error'}`}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.isPending || !query.data) {
    return <LoadingState label="Loading sources…" />;
  }

  const { items, total } = query.data;

  return (
    <>
      <Typography variant="h4" component="h2">
        Sources
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        {total} {total === 1 ? 'source' : 'sources'} with browser clients and health checks.
      </Typography>

      {items.length === 0 ? (
        <EmptyState
          title="No sources connected"
          hint="Configure a source in the data pipeline to see health here."
        />
      ) : (
        <Paper variant="outlined">
          <TableContainer>
            <Table size="small" aria-label="Sources">
              <TableHead>
                <TableRow>
                  <TableCell>Source</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Jobs</TableCell>
                  <TableCell align="right">Failures</TableCell>
                  <TableCell>Last checked</TableCell>
                  <TableCell>Last success</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((source) => (
                  <TableRow key={source.sourceName} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {source.sourceName}
                      </Typography>
                      {source.lastError ? (
                        <Typography
                          variant="caption"
                          sx={{ color: 'error.main', display: 'block' }}
                          title={source.lastError}
                        >
                          {source.lastError}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {source.healthy ? (
                        <Chip label="Healthy" color="success" size="small" />
                      ) : (
                        <Chip label="Unhealthy" color="error" size="small" />
                      )}
                    </TableCell>
                    <TableCell align="right">{source.jobsCount}</TableCell>
                    <TableCell align="right">{source.consecutiveFailures}</TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {formatDateTime(source.lastCheckedAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {formatDateTime(source.lastSuccessAt)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </>
  );
}
