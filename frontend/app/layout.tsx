import { Sora, DM_Sans } from 'next/font/google';
import './globals.css';
import { AppProviders } from '@/providers/app-providers';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Teacher Tati - AI English Learning',
  description: 'Practice English with an AI teacher 24/7.',
  manifest: '/manifest.json',
};

// Apenas o weight usado em display (h1/h2/h3) — reduz download da fonte
const sora = Sora({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['700'],
  preload: true,
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['400', '500'],
  style: ['normal'],
  preload: true,
});

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en-US"
      suppressHydrationWarning
      className={`${sora.variable} ${dmSans.variable}`}
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Tati AI" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="icon" href="/images/tati_logo.jpg" />

        {/* Preconnect ao backend para reduzir latência de rede nas primeiras requests */}
        {API_BASE && <link rel="preconnect" href={API_BASE} />}
        {API_BASE && <link rel="dns-prefetch" href={API_BASE} />}
      </head>
      <body>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}