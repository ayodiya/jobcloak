'use client';

import { useState } from 'react';
import {
  Box,
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
  JOB_STATUSES,
  listParams,
  type JobListItem,
  type Paginated,
} from '../../lib/api';
import {
  EmptyState,
  ErrorState,
  JobLink,
  LoadingState,
  ScoreBadge,
  StatusChip,
} from '../../components/ui';
import { formatDate } from '../../lib/format';

const SORT_OPTIONS = [
  { value: '-discoveredAt', label: 'Newest discovered' },
  { value: 'discoveredAt', label: 'Oldest discovered' },
  { value: 'title', label: 'Title (A–Z)' },
  { value: 'company', label: 'Company (A–Z)' },
  { value: '-postedAt', label: 'Recently posted' },
];

export default function JobsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [remote, setRemote] = useState('');
  const [sort, setSort] = useState('-discoveredAt');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);

  const params = listParams({
    search,
    status,
    remote: remote === '' ? undefined : remote,
    sort,
    page: page + 1,
    limit,
  });

  const query = useQuery({
    queryKey: ['jobs', params],
    queryFn: () => apiFetch<Paginated<JobListItem>>(`/jobs${params}`),
  });

  return (
    <>
      <Typography variant="h4" component="h2">
        Jobs
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Discovered listings from connected sources.
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
          sx={{ width: 260 }}
        />
        <IconButton type="submit" aria-label="Search jobs" color="primary">
          <SearchIcon />
        </IconButton>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="jobs-status-label">Status</InputLabel>
          <Select
            labelId="jobs-status-label"
            label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="">Any</MenuItem>
            {JOB_STATUSES.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="jobs-remote-label">Remote</InputLabel>
          <Select
            labelId="jobs-remote-label"
            label="Remote"
            value={remote}
            onChange={(event) => {
              setRemote(event.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="">Any</MenuItem>
            <MenuItem value="true">Remote only</MenuItem>
            <MenuItem value="false">On-site only</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="jobs-sort-label">Sort</InputLabel>
          <Select
            labelId="jobs-sort-label"
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
          message={`Could not load jobs: ${query.error?.message ?? 'unknown error'}`}
          onRetry={() => void query.refetch()}
        />
      ) : query.isPending || !query.data ? (
        <LoadingState label="Loading jobs…" />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          title="No jobs match these filters"
          hint="Try clearing the search or changing the status."
        />
      ) : (
        <Paper variant="outlined">
          <TableContainer>
            <Table size="small" aria-label="Jobs">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Remote</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Match</TableCell>
                  <TableCell align="right">Posted</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {query.data.items.map((job) => (
                  <TableRow key={job.id} hover>
                    <TableCell>
                      <JobLink href={`/jobs/${job.id}`} title={job.title} />
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', display: 'block' }}
                      >
                        {job.location ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>{job.company}</TableCell>
                    <TableCell>{job.remote ? 'Remote' : 'On-site'}</TableCell>
                    <TableCell>
                      <StatusChip status={job.status} />
                    </TableCell>
                    <TableCell align="right">
                      {job.match ? (
                        <ScoreBadge score={job.match.totalScore} />
                      ) : (
                        <span aria-label="Not matched">—</span>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {formatDate(job.postedAt)}
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
