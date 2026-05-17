/* @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@tati/hub-core'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gkziqqjswecteekanwnv.supabase.co',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
};

module.exports = nextConfig;
