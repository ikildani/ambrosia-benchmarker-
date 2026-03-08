import type { Metadata } from 'next';
import { generateBreadcrumbSchema } from '@/lib/seo/structured-data';

const breadcrumbSchema = generateBreadcrumbSchema([
  { name: 'Home', url: 'https://calculator.ambrosiaventures.co' },
  { name: 'Market Pulse' },
]);

export const metadata: Metadata = {
  title: 'Market Pulse — Weekly Biopharma Deal Intelligence',
  description: 'Weekly biotech licensing intelligence — deal activity, therapeutic area trends, modality heatmaps, benchmark shifts, and clinical trial updates across oncology, neurology, immunology, and 5 more TAs. Know what moved before your next board meeting.',
  keywords: [
    'biopharma deal intelligence',
    'weekly biotech deal report',
    'pharma licensing trends',
    'oncology deal activity',
    'modality trend analysis',
    'biotech market pulse',
    'deal flow tracker',
    'licensing deal alerts',
  ],
  openGraph: {
    title: 'Market Pulse — Weekly Biopharma Deal Intelligence',
    description: 'Weekly biotech deal intelligence, benchmark shifts, and modality trends for BD professionals. 12 therapeutic areas tracked.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/pulse',
    images: [
      {
        url: '/api/og?title=Market%20Pulse&subtitle=Weekly%20Biopharma%20Deal%20Intelligence&type=landing',
        width: 1200,
        height: 630,
        alt: 'Ambrosia Ventures Market Pulse — Weekly Deal Intelligence',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Market Pulse — Weekly Biopharma Deal Intelligence',
    description: 'Weekly biotech deal intelligence, benchmark shifts, and modality trends for BD professionals.',
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/pulse',
  },
};

export default function PulseLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {children}
    </>
  );
}
