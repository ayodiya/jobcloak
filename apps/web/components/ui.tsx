'use client';

import { Box, Chip, CircularProgress, LinearProgress, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Link from 'next/link';
import { formatSalary, scorePercent } from '../lib/format';

const STATUS_COLORS: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  Active: 'success',
  Verified: 'success',
  Submitted: 'success',
  InProgress: 'warning',
  Prepared: 'info',
  Failed: 'error',
  Cancelled: 'default',
  Rejected: 'error',
  Closed: 'default',
  Unknown: 'default',
};

export function StatusChip({ status }: { status: string }) {
  return (
    <Chip
      label={status}
      color={STATUS_COLORS[status] ?? 'default'}
      size="small"
      variant="outlined"
    />
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'success.main' : score >= 55 ? 'warning.main' : 'error.main';
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 44,
        px: 1,
        py: 0.5,
        borderRadius: 2,
        bgcolor: `${color}1f`,
        color,
        fontWeight: 700,
        fontSize: '0.8rem',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {scorePercent(score)}
    </Box>
  );
}

export function JobLink({ href, title }: { href: string; title: string }) {
  return (
    <Box
      component={Link}
      href={href}
      sx={{ color: 'primary.main', textDecoration: 'none' }}
      title={title}
    >
      {title}
    </Box>
  );
}

export function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <Box
      component="a"
      href={href}
      target="_blank"
      rel="noreferrer"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        color: 'text.secondary',
        fontSize: '0.8rem',
      }}
      title={href}
    >
      {label}
      <OpenInNewIcon sx={{ fontSize: 14 }} aria-hidden />
    </Box>
  );
}

export function MoneyText({
  min,
  max,
  currency,
}: {
  min: number | null;
  max: number | null;
  currency: string | null;
}) {
  return <>{formatSalary(min, max, currency)}</>;
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h4" component="h2">
        {title}
      </Typography>
      {subtitle ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {subtitle}
        </Typography>
      ) : null}
    </Box>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 8 }}>
      <LinearProgress sx={{ width: 240 }} aria-label={label} />
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
    </Box>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 8 }}
      role="alert"
    >
      <Typography variant="body1" sx={{ color: 'error.main' }}>
        {message}
      </Typography>
      {onRetry ? (
        <Typography
          component="button"
          onClick={onRetry}
          sx={{
            color: 'primary.main',
            bgcolor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          Retry
        </Typography>
      ) : null}
    </Box>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, py: 8 }}>
      <Typography variant="body1">{title}</Typography>
      {hint ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}

export function CenteredSpinner() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }} aria-label="Loading">
      <CircularProgress size={24} />
    </Box>
  );
}
