const { withSentryConfig } = require('@sentry/nextjs');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'sonner'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'static.wixstatic.com',
        pathname: '/media/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/benchmarks/alzheimers-deal-benchmarks',
        destination: '/benchmarks/alzheimers-licensing-deals',
        permanent: true,
      },
      {
        source: '/abd',
        destination: '/?utm_source=abd_capital_connect&utm_medium=webinar&utm_campaign=market_terms_june2026',
        permanent: false,
      },
      {
        source: '/playbook/n-a-standalone',
        destination: '/playbook',
        permanent: true,
      },
      {
        source: '/pricing',
        destination: '/pro',
        permanent: true,
      },
      {
        source: '/insights/deal-benchmarks',
        destination: '/insights/biopharma-deal-benchmarks-2026',
        permanent: true,
      },
    ];
  },
  trailingSlash: false,
  // Security headers configuration
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()'
          }
          // CSP is now handled per-request in middleware.ts with nonces
        ],
      },
      {
        // Cacheable public GET API routes
        source: '/api/(content|landing-pages|companies/search|health|deals/comparable|trials/intelligence)/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400'
          },
        ],
      },
      {
        // Mutation/auth API routes: no caching
        source: '/api/((?!embed|content|landing-pages|companies/search|health|deals/comparable|trials/intelligence).*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate'
          },
          {
            key: 'Pragma',
            value: 'no-cache'
          },
          {
            key: 'Expires',
            value: '0'
          }
        ],
      },
    ];
  },
  // Powered-by header disabled for security
  poweredByHeader: false,
};

module.exports = withSentryConfig(withBundleAnalyzer(nextConfig), {
  // Suppress source map upload warnings when SENTRY_AUTH_TOKEN is not set
  silent: !process.env.SENTRY_AUTH_TOKEN,
  // Upload source maps for better stack traces
  widenClientFileUpload: true,
  // Hide source maps from users
  hideSourceMaps: true,
  // Disable Sentry logger to reduce bundle size
  disableLogger: true,
});
// rebuild 1773876763
// rebuild 1773884185
