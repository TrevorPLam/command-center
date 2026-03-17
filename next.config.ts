import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable React strict mode
  reactStrictMode: true,

  // Experimental features for 2026 best practices
  experimental: {
    // Enable turbopack for development
    turbo: {
      rules: {
        '*.svg': ['@svgr/webpack'],
      },
    },
  },

  // Transpile packages for better compatibility
  transpilePackages: ['lancedb'],

  // Environment variables validation
  env: {
    CUSTOM_KEY: process.env['CUSTOM_KEY'],
  },

  // Headers for security and caching
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },

  // Webpack configuration for better-sqlite3
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push({
        'better-sqlite3': 'commonjs better-sqlite3',
      })
    }

    return config
  },

  // Output configuration
  output: 'standalone',

  // Image optimization
  images: {
    domains: [],
    formats: ['image/webp', 'image/avif'],
  },
}

export default nextConfig
