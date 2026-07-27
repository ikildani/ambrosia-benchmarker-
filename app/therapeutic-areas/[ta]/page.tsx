import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';

const TA_CONFIG: Record<string, { name: string; description: string; keywords: string[] }> = {
  oncology: { name: 'Oncology', description: 'Licensing deals, acquisitions, and collaborations in solid tumors and hematologic malignancies', keywords: ['oncology licensing deals', 'cancer drug deals', 'ADC deal terms', 'immuno-oncology partnerships'] },
  neurology: { name: 'Neurology & CNS', description: 'Deal benchmarks for Alzheimer\'s, Parkinson\'s, epilepsy, migraine, schizophrenia, and other neurological disorders', keywords: ['neurology drug deals', 'CNS licensing', 'Alzheimer deal terms', 'Parkinson partnerships'] },
  immunology: { name: 'Immunology & Autoimmune', description: 'Deal terms for rheumatoid arthritis, lupus, IBD, psoriasis, and other autoimmune conditions', keywords: ['autoimmune drug deals', 'immunology licensing', 'IBD deal terms', 'psoriasis partnerships'] },
  cardiovascular: { name: 'Cardiovascular', description: 'Heart failure, hypertension, ATTR cardiomyopathy, and PAH deal benchmarks', keywords: ['cardiovascular drug deals', 'heart failure licensing', 'ATTR deals', 'cardiology partnerships'] },
  metabolic: { name: 'Metabolic & Obesity', description: 'GLP-1, diabetes, NASH/MASH, and obesity drug deal benchmarks', keywords: ['obesity drug deals', 'GLP-1 licensing', 'diabetes deal terms', 'metabolic partnerships'] },
  rareDisease: { name: 'Rare Disease', description: 'Gene therapy, SMA, Duchenne, hemophilia, and orphan drug deal benchmarks', keywords: ['rare disease deals', 'gene therapy licensing', 'orphan drug deal terms', 'SMA partnerships'] },
  infectiousDisease: { name: 'Infectious Disease', description: 'HIV, hepatitis B, RSV, vaccines, and antibiotic deal benchmarks', keywords: ['infectious disease deals', 'vaccine licensing', 'antiviral deal terms', 'antibiotic partnerships'] },
  ophthalmology: { name: 'Ophthalmology', description: 'AMD, glaucoma, dry eye, and retinal disease deal benchmarks', keywords: ['ophthalmology deals', 'retinal drug licensing', 'AMD deal terms', 'eye disease partnerships'] },
  dermatology: { name: 'Dermatology', description: 'Atopic dermatitis, psoriasis, vitiligo, and alopecia deal benchmarks', keywords: ['dermatology deals', 'atopic dermatitis licensing', 'psoriasis deal terms', 'skin disease partnerships'] },
  womensHealth: { name: 'Women\'s Health', description: 'Endometriosis, uterine fibroids, menopause, and fertility deal benchmarks', keywords: ['women health deals', 'endometriosis licensing', 'fertility deal terms', 'reproductive partnerships'] },
  gastroenterology: { name: 'Gastroenterology', description: 'IBD, Crohn\'s, celiac, NASH, and GI disease deal benchmarks', keywords: ['gastroenterology deals', 'IBD licensing', 'Crohn disease deal terms', 'GI partnerships'] },
  hematology: { name: 'Hematology', description: 'Leukemia, lymphoma, myeloma, sickle cell, and hemophilia deal benchmarks', keywords: ['hematology deals', 'CAR-T licensing', 'lymphoma deal terms', 'sickle cell partnerships'] },
};

export async function generateStaticParams() {
  return Object.keys(TA_CONFIG).map(ta => ({ ta }));
}

export async function generateMetadata({ params }: { params: Promise<{ ta: string }> }): Promise<Metadata> {
  const { ta } = await params;
  const config = TA_CONFIG[ta];
  if (!config) return {};

  return {
    title: `${config.name} Deal Benchmarks — Biopharma Licensing Intelligence`,
    description: `${config.description}. Explore upfront payments, milestones, royalties, and deal structures from verified ${config.name.toLowerCase()} transactions.`,
    keywords: config.keywords,
    openGraph: {
      title: `${config.name} Deal Benchmarks — Ambrosia Ventures`,
      description: config.description,
      images: [{ url: `/api/og?title=${encodeURIComponent(config.name + ' Deals')}&subtitle=Biopharma+Deal+Benchmarks`, width: 1200, height: 630 }],
    },
    alternates: { canonical: `https://solidus.ambrosiaventures.co/therapeutic-areas/${ta}` },
  };
}

export default async function TherapeuticAreaPage({ params }: { params: Promise<{ ta: string }> }) {
  const { ta } = await params;
  const config = TA_CONFIG[ta];
  if (!config) notFound();

  const supabase = createServiceClient();

  // Fetch live stats for this TA.
  // R68 (2026-04-15): exclude is_synthetic=true so 845 flagged fakes
  // don't appear on public TA pages or in the deal-count.
  const [dealCountResult, recentDealsResult, dealTypeBreakdown] = await Promise.all([
    supabase.from('deals').select('id', { count: 'exact', head: true })
      .eq('therapeutic_area', ta)
      .eq('is_synthetic', false),
    supabase.from('deals')
      .select('licensor_name, licensee_name, asset_name, deal_type, upfront_usd, total_deal_value_usd, announced_date, modality, phase_at_signing')
      .eq('therapeutic_area', ta)
      .eq('is_synthetic', false)
      .eq('terms_disclosed', true)
      .not('upfront_usd', 'is', null)
      .order('announced_date', { ascending: false })
      .limit(10),
    supabase.from('deals')
      .select('deal_type')
      .eq('therapeutic_area', ta)
      .eq('is_synthetic', false),
  ]);

  const totalDeals = dealCountResult.count || 0;
  const recentDeals = recentDealsResult.data || [];

  // Count deal types
  const typeCounts: Record<string, number> = {};
  for (const d of dealTypeBreakdown.data || []) {
    typeCounts[d.deal_type || 'license'] = (typeCounts[d.deal_type || 'license'] || 0) + 1;
  }

  // Calculate averages
  const withUpfront = recentDeals.filter(d => d.upfront_usd && d.upfront_usd > 0);
  const avgUpfront = withUpfront.length > 0 ? withUpfront.reduce((s, d) => s + (d.upfront_usd || 0), 0) / withUpfront.length : 0;

  const formatUsd = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : `$${Math.round(n / 1e6)}M`;

  return (
    <>
    <main className="min-h-screen bg-white dark:bg-slate-900">
      {/* Hero */}
      <section className="py-16 sm:py-20 px-4 bg-gradient-to-b from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
        <div className="max-w-5xl mx-auto">
          <Breadcrumbs items={[
            { label: 'Home', href: '/' },
            { label: 'Therapeutic Areas', href: '/therapeutic-areas' },
            { label: config.name },
          ]} />

          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {config.name} Deal Benchmarks
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mb-8">
            {config.description}. Benchmarks derived from {totalDeals.toLocaleString()} verified transactions.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalDeals.toLocaleString()}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Deals</div>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{avgUpfront > 0 ? formatUsd(avgUpfront) : 'N/A'}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Upfront</div>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{Object.keys(typeCounts).length}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Deal Types</div>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{withUpfront.length > 0 ? `${Math.round(withUpfront.length / recentDeals.length * 100)}%` : 'N/A'}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Terms Disclosed</div>
            </div>
          </div>
        </div>
      </section>

      {/* Deal Type Breakdown */}
      <section className="py-10 px-4 border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Deal Structure Distribution</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {['license', 'acquisition', 'collaboration', 'option', 'co_development'].map(type => (
              <div key={type} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-center">
                <div className="text-xl font-bold text-slate-900 dark:text-white">{typeCounts[type] || 0}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">{type.replace('_', ' ')}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Deals */}
      <section className="py-10 px-4 border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Recent Deals with Disclosed Terms</h2>
          {recentDeals.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400">No deals with disclosed terms available yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Parties</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Type</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Upfront</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Value</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {recentDeals.map((deal, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-white">{deal.licensor_name} → {deal.licensee_name}</div>
                        {deal.asset_name && <div className="text-xs text-slate-400">{deal.asset_name}</div>}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 capitalize text-xs">{(deal.deal_type || 'license').replace('_', ' ')}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-white">{deal.upfront_usd ? formatUsd(deal.upfront_usd) : '—'}</td>
                      <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">{deal.total_deal_value_usd ? formatUsd(deal.total_deal_value_usd) : '—'}</td>
                      <td className="py-3 px-4 text-right text-xs text-slate-500 dark:text-slate-400">{new Date(deal.announced_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 px-4 bg-slate-50 dark:bg-slate-800/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Benchmark Your {config.name} Deal
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Get instant benchmarks for upfront payments, milestones, and royalties based on {totalDeals.toLocaleString()} verified {config.name.toLowerCase()} transactions.
          </p>
          <Link
            href={`/calculator?therapeuticArea=${ta}`}
            className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-lg"
          >
            Run {config.name} Benchmark
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Dataset",
        "name": `${config.name} Biopharma Deal Database`,
        "description": `${totalDeals} verified ${config.name.toLowerCase()} licensing, acquisition, and collaboration deals with financial terms.`,
        "url": `https://solidus.ambrosiaventures.co/therapeutic-areas/${ta}`,
        "creator": { "@type": "Organization", "name": "Ambrosia Ventures" },
        "variableMeasured": ["Upfront Payment", "Total Deal Value", "Milestones", "Royalty Rate"],
      })}} />
    </main>
    </>
  );
}
