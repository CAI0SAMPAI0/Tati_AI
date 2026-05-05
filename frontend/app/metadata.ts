import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Teacher Tati - AI English Learning',
  description: 'Practice English with an AI teacher 24/7.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#6C63FF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};
