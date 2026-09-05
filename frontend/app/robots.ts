import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tati-ai.vercel.app';

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/login', '/reset-password', '/hub'],
      disallow: ['/api/', '/django-admin/', '/receipt/', '/settings/'],
    },
    sitemap: baseUrl + '/sitemap.xml',
  };
}
