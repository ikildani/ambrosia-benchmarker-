import { Metadata } from 'next';
import Link from 'next/link';
import CompaniesPageClient from './CompaniesPageClient';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { IntelligenceUpgradeGate } from '@/components/intelligence/IntelligenceUpgradeGate';
import { createServiceClient } from '@/lib/supabase/server';

export const revalidate = 3600;

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

const TYPE_LABELS: Record<string, string> = {
  large_pharma: 'Large Pharma',
  mid_pharma: 'Mid-Size Pharma',
  large_biotech: 'Large Biotech',
  mid_biotech: 'Biotech',
  specialty: 'Specialty Pharma',
};

async function getPublicCompanyDirectory() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, company_type, deals_last_12mo, total_deals')
    .order('deals_last_12mo', { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) {
    console.error('Companies directory fetch error:', error.message);
    return [];
  }
  return data || [];
}

export default async function CompaniesPage() {
  const auth = await resolveUserTier();

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

  if (auth.hasProAccess) {
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
        />
        <CompaniesPageClient />
      </>
    );
  }

  const companies = await getPublicCompanyDirectory();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <section className="mx-auto max-w-6xl px-6 pt-16 pb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            Biopharma Company Profiles
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-400">
            Deal history, pipeline activity, patent cliffs, and competitive benchmarks
            for {companies.length}+ biotech and pharma companies.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-12">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => (
              <Link
                key={company.id}
                href={`/companies/${company.id}`}
                className="group flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/40 px-4 py-3 transition-colors hover:border-teal-500/30 hover:bg-slate-900/70"
              >
                <div className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-200 group-hover:text-teal-300">
                    {company.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {TYPE_LABELS[company.company_type] || company.company_type || 'Biopharma'}
                  </span>
                </div>
                {company.total_deals != null && company.total_deals > 0 && (
                  <span className="ml-3 shrink-0 rounded-full bg-slate-800/60 px-2 py-0.5 text-xs tabular-nums text-slate-400">
                    {company.total_deals} deal{company.total_deals !== 1 ? 's' : ''}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <IntelligenceUpgradeGate isAuthenticated={auth.isAuthenticated} />
        </section>
      </main>
    </>
  );
}
