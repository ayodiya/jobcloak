import type { Metadata } from 'next';
import { Providers } from '../components/providers';
import { AppShell } from '../components/app-shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Jobcloak — Local AI Job Assistant',
  description:
    'Privacy-first, locally operated AI job discovery, matching and application assistant.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
