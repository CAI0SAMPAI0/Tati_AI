/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs/config');

const nextConfig = {
  reactStrictMode: true,

  // Não expõe o header "X-Powered-By: Next.js" (segurança + performance)
  poweredByHeader: false,

  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: [
    'framer-motion',
    'lucide-react',
    'recharts',
    'zustand',
  ],

  // Compressão ativa
  compress: true,

  // Otimizações experimentais
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'recharts',
    ],
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      ...(process.env.NEXT_PUBLIC_API_BASE_URL ? (() => {
        try {
          const url = new URL(process.env.NEXT_PUBLIC_API_BASE_URL);
          return [{
            protocol: url.protocol.replace(':', ''),
            hostname: url.hostname,
          }];
        } catch {
          return [];
        }
      })() : []),
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'gkziqqjswecteekanwnv.supabase.co',
      },
    ],
  },

  async rewrites() {
    const backendUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.INTERNAL_API_URL;

    if (!backendUrl) return [];

    return [
      {
        source: '/media/:path*',
        destination: `${backendUrl.replace(/\/$/, '')}/media/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0, must-revalidate' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
    ];
  },

  webpack(config) {
    config.module.rules.push({
      test: /\.m?js$/,
      include: /node_modules/,
      resolve: {
        fullySpecified: false,
      },
    });

    return config;
  },
};

// IMPORTANTE:
// 1. O App Router do Next.js gerencia chunks automaticamente via optimizePackageImports.
// 2. Se SENTRY_AUTH_TOKEN não estiver definido, desativa upload de sourcemaps para evitar que o build trave no Vercel.
module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  telemetry: false,
});