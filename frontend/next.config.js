/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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

  async headers() {
    return [
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

module.exports = {
  ...nextConfig,
  productionBrowserSourceMaps: true,
}