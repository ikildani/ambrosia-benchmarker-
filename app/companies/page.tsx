import { Metadata } from 'next';
import CompaniesPageClient from './CompaniesPageClient';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { IntelligenceUpgradeGate } from '@/components/intelligence/IntelligenceUpgradeGate';

export const metadata: Metadata = {
  title: 'Company Profiles — Biotech & Pharma Deal Intelligence | Ambrosia Ventures',
  description: 'Explore deal history, clinical pipelines, patent cliffs, and benchmark comparisons for 850+ biotech and pharma companies across oncology, neurology, immunology, metabolic, cardiovascular, and more.',
  openGraph: {
    title: 'Company Profiles — Biotech & Pharma Deal Intelligence',
    description: 'Explore deal history, clinical pipelines, patent cliffs, and benchmark comparisons for 850+ biotech and pharma companies.',
    url: 'https://solidus.ambrosiaventures.co/companies',
    images: [{ url: '/api/og?title=Company%20Profiles&subtitle=850%2B%20Biotech%20%26%20Pharma%20Companies&type=landing' }],
  },
  twitter: {
    card: 'summary',
    title: 'Company Profiles — Biotech & Pharma Deal Intelligence',
    description: 'Explore deal history, clinical pipelines, patent cliffs, and benchmark comparisons for 850+ biotech and pharma companies.',
  },
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/companies',
  },
};

export default async function CompaniesPage() {
  const auth = await resolveUserTier();
  if (!auth.hasProAccess) {
    return <IntelligenceUpgradeGate isAuthenticated={auth.isAuthenticated} />;
  }

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Biotech & Pharma Company Profiles',
    description: 'Deal history, clinical pipelines, patent cliffs, and benchmark comparisons for 850+ biotech and pharma companies.',
    url: 'https://solidus.ambrosiaventures.co/companies',
    provider: {
      '@type': 'Organization',
      name: 'Ambrosia Ventures',
      url: 'https://solidus.ambrosiaventures.co',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <CompaniesPageClient />
      <SiteFooter />
    </>
  );
}
