import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tati-ai.vercel.app';
  const lastModified = new Date();

  const routes = [
    '',
    '/login',
    '/reset-password',
    '/hub',
    '/chat',
    '/voice',
    '/dashboard',
    '/activities',
    '/competitions',
    '/vocab',
    '/flashcards',
    '/listenings',
    '/progress',
  ];

  return routes.map((route) => ({
    url: baseUrl + route,
    lastModified,
    changeFrequency: (route === '' || route === '/hub' ? 'daily' : 'weekly') as 'daily' | 'weekly',
    priority: route === '' ? 1.0 : route === '/hub' || route === '/login' ? 0.8 : 0.6,
  }));
}
