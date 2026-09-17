/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@masterbrain/agents',
    '@masterbrain/orchestration',
    '@masterbrain/canon',
    '@masterbrain/db',
    '@masterbrain/shared',
  ],
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
