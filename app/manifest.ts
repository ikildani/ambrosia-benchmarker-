import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ambrosia Ventures Deal Calculator',
    short_name: 'Deal Calculator',
    description:
      'Instant deal benchmarks, rNPV analysis, and AI market intelligence for biopharma licensing deals.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0c0e1f',
    theme_color: '#0EA5A5',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
