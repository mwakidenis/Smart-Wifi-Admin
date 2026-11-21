import type { NextConfig } from 'next';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/Smart-WiFi-Admin-Portal';
const assetPrefix = process.env.NEXT_PUBLIC_ASSET_PREFIX || `${basePath}/`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  basePath,
  assetPrefix,
};

export default nextConfig;
