import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@usa-open-data-lab/ui', '@usa-open-data-connectors/usa-sources'],
  typedRoutes: true,
  devIndicators: false,
  // The site is a static export (no server), so the app exports to plain
  // HTML. The base path stays empty for local dev and Vercel builds so URLs
  // remain root-relative.
  output: 'export',
  // Story routes become <slug>/index.html so the static host serves
  // /<category>/<slug>/ without an .html extension.
  trailingSlash: true,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
  },
};

export default nextConfig;
