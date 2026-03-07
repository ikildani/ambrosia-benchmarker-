import type { Metadata } from 'next';
import { generateBreadcrumbSchema } from '@/lib/seo/structured-data';

const breadcrumbSchema = generateBreadcrumbSchema([
  { name: 'Home', url: 'https://calculator.ambrosiaventures.co' },
  { name: 'Company Profiles' },
]);

export const metadata: Metadata = {
  title: 'Biopharma Company Profiles — Competitive Intelligence & Deal History',
  description: 'Explore 120+ biotech and pharma company profiles — deal history, active pipelines, licensing appetite, clinical trial activity, and competitive benchmarks across all 8 therapeutic areas.',
  keywords: [
    'biotech company profiles',
    'pharma competitive intelligence',
    'biopharma deal history',
    'biotech pipeline tracker',
    'pharma licensing partners',
    'company deal activity',
    'biotech acquisition targets',
    'pharma BD intelligence',
  ],
  openGraph: {
    title: 'Biopharma Company Profiles — Competitive Intelligence & Deal History',
    description: '120+ biotech and pharma company profiles — deal history, pipelines, licensing appetite, and competitive benchmarks.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/companies',
    images: [
      {
        url: '/api/og?title=Company%20Profiles&subtitle=120%2B%20Biopharma%20Companies%20%E2%80%94%20Deal%20History%20%26%20Pipeline%20Intel&type=landing',
        width: 1200,
        height: 630,
        alt: 'Ambrosia Ventures — Biopharma Company Intelligence',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Biopharma Company Profiles — Competitive Intelligence',
    description: '120+ biotech and pharma company profiles with deal history, pipelines, and competitive benchmarks.',
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/companies',
  },
};

export default function CompaniesLayout({ children }: { children: React.ReactNode }) {
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
