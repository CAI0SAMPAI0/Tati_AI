/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    'framer-motion',
    'lucide-react',
    'recharts',
    'zustand',
    '@tanstack/react-query',
    // react-markdown and its ESM-only dependencies must be transpiled
    // by Next.js/Webpack, otherwise the bundler crashes with
    // "Cannot read properties of undefined (reading 'call')"
    'react-markdown',
    'remark-gfm',
    'unified',
    'vfile',
    'remark-parse',
    'remark-rehype',
    'hast-util-to-jsx-runtime',
    'mdast-util-to-hast',
    'unist-util-visit',
    'html-url-attributes',
    'devlop',
    'bail',
    'is-plain-obj',
    'trough',
    'extend',
    'micromark',
    'decode-named-character-reference',
    'character-entities',
    'mdast-util-from-markdown',
    'mdast-util-gfm',
    'mdast-util-gfm-autolink-literal',
    'mdast-util-gfm-footnote',
    'mdast-util-gfm-strikethrough',
    'mdast-util-gfm-table',
    'mdast-util-gfm-task-list-item',
    'micromark-extension-gfm',
    'micromark-extension-gfm-autolink-literal',
    'micromark-extension-gfm-footnote',
    'micromark-extension-gfm-strikethrough',
    'micromark-extension-gfm-table',
    'micromark-extension-gfm-tagfilter',
    'micromark-extension-gfm-task-list-item',
    'micromark-util-combine-extensions',
    'micromark-util-chunked',
    'micromark-util-character',
    'micromark-util-classify-character',
    'micromark-util-decode-numeric-character-reference',
    'micromark-util-encode',
    'micromark-util-html-tag-name',
    'micromark-util-normalize-identifier',
    'micromark-util-resolve-all',
    'micromark-util-sanitize-uri',
    'micromark-util-subtokenize',
    'micromark-util-symbol',
    'micromark-util-types',
    'unist-util-is',
    'unist-util-position',
    'unist-util-stringify-position',
    'unist-util-visit-parents',
    'hast-util-whitespace',
    'property-information',
    'space-separated-tokens',
    'comma-separated-tokens',
    'hastscript',
    'web-namespaces',
    'zwitch',
    'ccount',
    'escape-string-regexp',
    'longest-streak',
    'mdast-util-find-and-replace',
    'mdast-util-to-markdown',
    'mdast-util-phrasing-content',
    'vfile-message',
  ],

  // Compressão ativa
  compress: true,

  // Otimizações experimentais
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'recharts',
      '@tanstack/react-query',
    ],
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tatiai-production.up.railway.app',
      },
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
  productionBrowserSourceMaps: true,
}