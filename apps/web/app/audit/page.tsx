'use client';

import { useState } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, listParams, type AuditItem, type Paginated } from '../../lib/api';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { formatDateTime } from '../../lib/format';

export default function AuditPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(50);

  const params = listParams({ search, sort: '-createdAt', page: page + 1, limit });

  const query = useQuery({
    queryKey: ['audit', params],
    queryFn: () => apiFetch<Paginated<AuditItem>>(`/audit${params}`),
  });

  return (
    <>
      <Typography variant="h4" component="h2">
        Audit
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Append-only record of actions taken by the system.
      </Typography>

      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(0);
          setSearch(searchInput);
        }}
        sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}
      >
        <TextField
          label="Search action or entity"
          size="small"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          sx={{ width: 280 }}
        />
        <IconButton type="submit" aria-label="Search audit log" color="primary">
          <SearchIcon />
        </IconButton>
      </Box>

      {query.isError ? (
        <ErrorState
          message={`Could not load the audit log: ${query.error?.message ?? 'unknown error'}`}
          onRetry={() => void query.refetch()}
        />
      ) : query.isPending || !query.data ? (
        <LoadingState label="Loading audit log…" />
      ) : query.data.items.length === 0 ? (
        <EmptyState title="No audit entries match" />
      ) : (
        <Paper variant="outlined">
          <TableContainer>
            <Table size="small" aria-label="Audit log">
              <TableHead>
                <TableRow>
                  <TableCell>Action</TableCell>
                  <TableCell>Entity</TableCell>
                  <TableCell>Entity ID</TableCell>
                  <TableCell>Correlation</TableCell>
                  <TableCell align="right">When</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {query.data.items.map((entry) => (
                  <TableRow key={entry.id} hover>
                    <TableCell>{entry.action}</TableCell>
                    <TableCell>{entry.entityType ?? '—'}</TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                        {entry.entityId ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="caption"
                        sx={{ fontFamily: 'monospace', color: 'text.secondary' }}
                      >
                        {entry.correlationId ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {formatDateTime(entry.createdAt)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={query.data.total}
            page={page}
            rowsPerPage={limit}
            rowsPerPageOptions={[20, 50, 100]}
            onPageChange={(_event, nextPage) => setPage(nextPage)}
            onRowsPerPageChange={(event) => {
              setLimit(Number.parseInt(event.target.value, 10));
              setPage(0);
            }}
          />
        </Paper>
      )}
    </>
  );
}
