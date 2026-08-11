import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [],
      // `afterFiles` runs only once the filesystem and public/ have been
      // checked, so the real bundle and assets under /app/ still serve
      // normally and only unmatched paths fall through to the app shell.
      // That is what makes the mobile app's own routes (/app/tours, and so on)
      // survive a refresh, since it is a single-page build.
      afterFiles: [
        { source: '/app', destination: '/app/index.html' },
        { source: '/app/:path*', destination: '/app/index.html' },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
