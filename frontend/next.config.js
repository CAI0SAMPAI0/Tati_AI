/** @type {import('next').NextConfig} */
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

  webpack(config, { dev }) {
    config.module.rules.push({
      test: /\.m?js$/,
      include: /node_modules/,
      resolve: {
        fullySpecified: false,
      },
    });

    // Em produção, otimiza o split de chunks para carregar menos JS por página
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'async',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'async',
              priority: 10,
            },
            framerMotion: {
              test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
              name: 'framer-motion',
              chunks: 'async',
              priority: 20,
            },
            recharts: {
              test: /[\\/]node_modules[\\/]recharts[\\/]/,
              name: 'recharts',
              chunks: 'async',
              priority: 20,
            },
          },
        },
      };
    }

    return config;
  },
};

// IMPORTANTE: productionBrowserSourceMaps removido — infla bundles 2-3x em produção.
// Para depurar erros em produção, use error tracking (ex: Sentry) em vez de source maps inline.
module.exports = {
  ...nextConfig,
}