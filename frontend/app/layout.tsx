import { AppProviders } from '@/providers/app-providers';
import type { Metadata } from 'next';
import { DM_Sans, Sora } from 'next/font/google';
import './globals.css';

export const metadata: Metadata = {
  title: "Teacher Tati AI | Plataforma Inteligente de Inglês",
  description: 'Pratique conversação em inglês 24/7 com a Teacher Tati AI. Faça o teste de nivelamento CEFR gratuito e receba seu relatório em PDF.',
  manifest: '/manifest.json',
  verification: {
    google: '2pUtbPwWrV8Q1kdAj8fmkYUIY7a-BI0NRj_WKjAHoLM',
  },
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
        <meta name="apple-mobile-web-app-title" content="Taty's Hub" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta
          name="google-site-verification"
          content="2pUtbPwWrV8Q1kdAj8fmkYUIY7a-BI0NRj_WKjAHoLM"
        />
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