import { Metadata } from 'next';
import CompaniesPageClient from './CompaniesPageClient';

export const metadata: Metadata = {
  title: 'Company Profiles — Biotech & Pharma Deal Intelligence | Ambrosia Ventures',
  description: 'Explore deal history, clinical pipelines, patent cliffs, and benchmark comparisons for 50+ biotech and pharma companies across oncology, neurology, and immunology.',
  openGraph: {
    title: 'Company Profiles — Biotech & Pharma Deal Intelligence',
    description: 'Explore deal history, clinical pipelines, patent cliffs, and benchmark comparisons for 50+ biotech and pharma companies.',
    url: 'https://calculator.ambrosiaventures.co/companies',
  },
  twitter: {
    card: 'summary',
    title: 'Company Profiles — Biotech & Pharma Deal Intelligence',
    description: 'Explore deal history, clinical pipelines, patent cliffs, and benchmark comparisons for 50+ biotech and pharma companies.',
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/companies',
  },
};

export default function CompaniesPage() {
  return <CompaniesPageClient />;
}
