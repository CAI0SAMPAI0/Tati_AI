import type { Metadata } from 'next';
import { Sora, DM_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/auth-provider';
import HubLayoutWrapper from '@/components/HubLayoutWrapper';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: "Tati Hub | Taty's English Class",
  description:
    'Catálogo de materiais premium da Teacher Tati — e-books, exercícios e guias de estudo.',
  icons: {
    icon: '/images/tati_logo.jpg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sora.variable} ${dmSans.variable}`}>
      <head>
        <link rel="icon" href="/images/tati_logo.jpg" />
      </head>
      <body className="min-h-screen bg-bg font-body text-ink antialiased">
        <span className="grain-overlay" aria-hidden />
        <AuthProvider>
          <HubLayoutWrapper>{children}</HubLayoutWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
