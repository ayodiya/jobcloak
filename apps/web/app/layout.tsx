import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Jobs Applications — Local AI Job Assistant',
  description: 'Privacy-first, locally operated AI job discovery, matching and application assistant.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}