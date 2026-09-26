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
import { apiFetch, type CandidateResponse } from '../../lib/api';
import { ErrorState, LoadingState } from '../../components/ui';
import { formatDate } from '../../lib/format';

export default function CandidatePage() {
  const query = useQuery({
    queryKey: ['candidate'],
    queryFn: () => apiFetch<CandidateResponse>('/candidate'),
  });

  if (query.isError) {
    return (
      <ErrorState
        message={`Could not load the candidate profile: ${query.error?.message ?? 'unknown error'}`}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.isPending || !query.data) {
    return <LoadingState label="Loading candidate profile…" />;
  }

  const { profile, skills, experience, stats } = query.data;
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Candidate';

  const statCards = [
    { label: 'Skills', value: stats.skillsCount },
    { label: 'Experience', value: `${stats.experienceYears}y` },
    { label: 'Matches', value: stats.matchesCount },
    { label: 'Eligible matches', value: stats.matchesEligible },
    { label: 'Applications', value: stats.applicationsCount },
    { label: 'Active applications', value: stats.applicationsActive },
    { label: 'Education entries', value: stats.educationEntries },
    { label: 'Certifications', value: stats.certificationCount },
    { label: 'Achievements', value: stats.achievementCount },
    { label: 'Evidence records', value: stats.evidenceCount },
    { label: 'Materials', value: stats.materialsCount },
  ];

  return (
    <>
      <Typography variant="h4" component="h2">
        Candidate
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        The profile used to score matches and generate applications.
      </Typography>

      <Typography variant="h6" component="h3" sx={{ mb: 1.5 }}>
        {name}
        {profile.title ? (
          <span style={{ color: 'var(--muted)' }}> — {profile.title}</span>
        ) : null}
      </Typography>

      <Grid container spacing={1.5} sx={{ mb: 3 }}>
        {statCards.map((stat) => (
          <Grid size={{ xs: 6, sm: 4, md: 3 }} key={stat.label}>
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5, textAlign: 'center' }}>
                <Typography variant="h6" component="p" sx={{ my: 0, fontWeight: 700 }}>
                  {stat.value}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {stat.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                Profile
              </Typography>
              <Typography variant="body2" component="div">
                <div>
                  <strong>City:</strong> {profile.city ?? '—'}
                </div>
                <div>
                  <strong>Country:</strong> {profile.country ?? '—'}
                </div>
                <div>
                  <strong>Work authorization:</strong> {profile.workAuthorization ?? '—'}
                </div>
                <div>
                  <strong>Remote preferred:</strong>{' '}
                  {profile.remotePreferred === null
                    ? '—'
                    : profile.remotePreferred
                      ? 'Yes'
                      : 'No'}
                </div>
                <div>
                  <strong>Relocation willing:</strong>{' '}
                  {profile.relocationWilling === null
                    ? '—'
                    : profile.relocationWilling
                      ? 'Yes'
                      : 'No'}
                </div>
                <div>
                  <strong>Expected salary:</strong>{' '}
                  {(profile.expectedSalaryMin ?? profile.expectedSalaryMax)
                    ? `${profile.expectedSalaryMin ?? '—'} – ${profile.expectedSalaryMax ?? '—'} ${profile.currency ?? ''}`
                    : '—'}
                </div>
                <div>
                  <strong>Languages:</strong> {stringifyMaybe(profile.languages)}
                </div>
                <div>
                  <strong>Target roles:</strong> {stringifyMaybe(profile.targetRoles)}
                </div>
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                Experience
              </Typography>
              {experience.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  No experience entries.
                </Typography>
              ) : (
                <Box>
                  {experience.map((entry, index) => (
                    <Box
                      key={`${entry.organization}-${index}`}
                      sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {entry.title}
                      </Typography>
                      <Typography variant="body2">{entry.organization}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {entry.startDate ? formatDate(entry.startDate) : '?'} –{' '}
                        {entry.current
                          ? 'Present'
                          : entry.endDate
                            ? formatDate(entry.endDate)
                            : '?'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card variant="outlined" sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
            Skills
          </Typography>
          {skills.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No skills recorded.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small" aria-label="Candidate skills">
                <TableHead>
                  <TableRow>
                    <TableCell>Skill</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Level</TableCell>
                    <TableCell align="right">Years</TableCell>
                    <TableCell align="right">Last used</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {skills.map((skill) => (
                    <TableRow key={skill.id} hover>
                      <TableCell>{skill.name}</TableCell>
                      <TableCell>{skill.category ?? '—'}</TableCell>
                      <TableCell>{skill.level ?? '—'}</TableCell>
                      <TableCell align="right">{skill.years ?? '—'}</TableCell>
                      <TableCell align="right">{skill.lastUsedYear ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function stringifyMaybe(value: unknown): string {
  if (null === value || undefined === value) return '—';
  if (Array.isArray(value)) return value.length === 0 ? '—' : value.join(', ');
  if (typeof value === 'string') return value;
  return '—';
}
