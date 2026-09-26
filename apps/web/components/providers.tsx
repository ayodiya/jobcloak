'use client';

import { useState } from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#5b8cff' },
    success: { main: '#37c57b' },
    error: { main: '#e5554e' },
    warning: { main: '#e0a63c' },
    background: { default: '#0f1115', paper: '#171a21' },
    text: { primary: '#e7eaf0', secondary: '#9aa4b5' },
    divider: '#2a3140',
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    h4: { fontSize: '1.5rem', fontWeight: 700 },
    h6: { fontSize: '1.05rem', fontWeight: 600 },
    button: { textTransform: 'none' },
  },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiChip: { defaultProps: { size: 'small' } },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
