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
import { apiFetch, listParams, type MatchListItem, type Paginated } from '../../lib/api';
import { EmptyState, ErrorState, JobLink, LoadingState, ScoreBadge } from '../../components/ui';
import { formatDate } from '../../lib/format';

const SORT_OPTIONS = [
  { value: '-totalScore', label: 'Highest score' },
  { value: 'totalScore', label: 'Lowest score' },
  { value: '-createdAt', label: 'Newest' },
  { value: 'jobTitle', label: 'Job (A–Z)' },
  { value: 'company', label: 'Company (A–Z)' },
];

export default function MatchesPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [minScore, setMinScore] = useState('');
  const [eligible, setEligible] = useState('');
  const [sort, setSort] = useState('-totalScore');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);

  const params = listParams({
    search,
    minScore: minScore === '' ? undefined : minScore,
    eligible: eligible === '' ? undefined : eligible,
    sort,
    page: page + 1,
    limit,
  });

  const query = useQuery({
    queryKey: ['matches', params],
    queryFn: () => apiFetch<Paginated<MatchListItem>>(`/matches${params}`),
  });

  return (
    <>
      <Typography variant="h4" component="h2">
        Matches
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Scored matches between the candidate profile and discovered jobs.
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
        <IconButton type="submit" aria-label="Search matches" color="primary">
          <SearchIcon />
        </IconButton>
        <TextField
          label="Min score"
          size="small"
          type="number"
          slotProps={{ htmlInput: { min: 0, max: 100 } }}
          value={minScore}
          onChange={(event) => {
            setMinScore(event.target.value);
            setPage(0);
          }}
          sx={{ width: 110 }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="matches-eligible-label">Eligibility</InputLabel>
          <Select
            labelId="matches-eligible-label"
            label="Eligibility"
            value={eligible}
            onChange={(event) => {
              setEligible(event.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="">Any</MenuItem>
            <MenuItem value="true">Eligible only</MenuItem>
            <MenuItem value="false">Ineligible only</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="matches-sort-label">Sort</InputLabel>
          <Select
            labelId="matches-sort-label"
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
          message={`Could not load matches: ${query.error?.message ?? 'unknown error'}`}
          onRetry={() => void query.refetch()}
        />
      ) : query.isPending || !query.data ? (
        <LoadingState label="Loading matches…" />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          title="No matches match these filters"
          hint="Try raising the minimum score or clearing the search."
        />
      ) : (
        <Paper variant="outlined">
          <TableContainer>
            <Table size="small" aria-label="Job matches">
              <TableHead>
                <TableRow>
                  <TableCell>Job</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell align="right">Score</TableCell>
                  <TableCell>Eligible</TableCell>
                  <TableCell align="right">Confidence</TableCell>
                  <TableCell align="right">Matched</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {query.data.items.map((match) => (
                  <TableRow key={match.id} hover>
                    <TableCell>
                      <JobLink href={`/jobs/${match.jobId}`} title={match.jobTitle} />
                    </TableCell>
                    <TableCell>{match.company}</TableCell>
                    <TableCell align="right">
                      <ScoreBadge score={match.totalScore} />
                    </TableCell>
                    <TableCell>
                      {match.eligible ? (
                        <Chip label="Eligible" color="success" size="small" />
                      ) : (
                        <Chip label="No" size="small" />
                      )}
                    </TableCell>
                    <TableCell align="right">{Math.round(match.confidence * 100)}%</TableCell>
                    <TableCell align="right">
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {formatDate(match.createdAt)}
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
