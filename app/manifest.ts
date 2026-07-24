import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Solidus',
    short_name: 'Solidus',
    description:
      'Instant deal benchmarks, rNPV analysis, and AI market intelligence for biopharma licensing deals.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f1e8',
    theme_color: '#0a0d1b',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
