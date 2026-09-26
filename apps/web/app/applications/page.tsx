'use client';

import { useState } from 'react';
import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import {
  apiFetch,
  APPLICATION_MODES,
  APPLICATION_STATUSES,
  listParams,
  type ApplicationListItem,
  type Paginated,
} from '../../lib/api';
import { EmptyState, ErrorState, JobLink, LoadingState, StatusChip } from '../../components/ui';
import { formatDate } from '../../lib/format';

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest' },
  { value: '-updatedAt', label: 'Recently updated' },
  { value: '-submittedAt', label: 'Recently submitted' },
  { value: 'jobTitle', label: 'Job (A–Z)' },
];

export default function ApplicationsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('');
  const [sort, setSort] = useState('-createdAt');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);

  const params = listParams({
    search,
    status,
    mode,
    sort,
    page: page + 1,
    limit,
  });

  const query = useQuery({
    queryKey: ['applications', params],
    queryFn: () => apiFetch<Paginated<ApplicationListItem>>(`/applications${params}`),
  });

  return (
    <>
      <Typography variant="h4" component="h2">
        Applications
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Every application prepared or submitted through the automation pipeline.
      </Typography>

      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(0);
          setSearch(searchInput);
        }}
        sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}
      >
        <TextField
          label="Search"
          size="small"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          sx={{ width: 240 }}
        />
        <IconButton type="submit" aria-label="Search applications" color="primary">
          <SearchIcon />
        </IconButton>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="applications-status-label">Status</InputLabel>
          <Select
            labelId="applications-status-label"
            label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="">Any</MenuItem>
            {APPLICATION_STATUSES.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="applications-mode-label">Mode</InputLabel>
          <Select
            labelId="applications-mode-label"
            label="Mode"
            value={mode}
            onChange={(event) => {
              setMode(event.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="">Any</MenuItem>
            {APPLICATION_MODES.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="applications-sort-label">Sort</InputLabel>
          <Select
            labelId="applications-sort-label"
            label="Sort"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(0);
            }}
          >
            {SORT_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {query.isError ? (
        <ErrorState
          message={`Could not load applications: ${query.error?.message ?? 'unknown error'}`}
          onRetry={() => void query.refetch()}
        />
      ) : query.isPending || !query.data ? (
        <LoadingState label="Loading applications…" />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          title="No applications match these filters"
          hint="Run matching, then prepare applications to see them here."
        />
      ) : (
        <Paper variant="outlined">
          <TableContainer>
            <Table size="small" aria-label="Applications">
              <TableHead>
                <TableRow>
                  <TableCell>Job</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Mode</TableCell>
                  <TableCell align="right">Submitted</TableCell>
                  <TableCell align="right">Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {query.data.items.map((application) => (
                  <TableRow key={application.id} hover>
                    <TableCell>
                      <JobLink
                        href={`/applications/${application.id}`}
                        title={application.job.title}
                      />
                    </TableCell>
                    <TableCell>{application.job.company}</TableCell>
                    <TableCell>
                      <StatusChip status={application.status} />
                    </TableCell>
                    <TableCell>
                      <Chip label={application.mode} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {formatDate(application.submittedAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {formatDate(application.updatedAt)}
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
