import { Metadata } from 'next';
import DealBrowser from '@/components/deals/DealBrowser';

export const metadata: Metadata = {
  title: 'Biotech Deal Database | 2,500+ Licensing Deals | Ambrosia Ventures',
  description: 'Browse and analyze 2,500+ biotech licensing deals. Filter by modality, phase, indication, and financial terms. Track pharma deal activity and benchmark your negotiations.',
  keywords: 'biotech deals, pharma licensing, deal database, ADC deals, mRNA deals, oncology licensing, biopharma transactions',
  openGraph: {
    title: 'Biotech Deal Database | Ambrosia Ventures',
    description: 'Browse and analyze 2,500+ biotech licensing deals. Filter by modality, phase, indication, and financial terms.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/deals',
    images: ['/api/og?title=Deal%20Database&type=landing'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Biotech Deal Database | Ambrosia Ventures',
    description: 'Browse and analyze 2,500+ biotech licensing deals with advanced filters.',
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/deals',
  },
};

export default function DealsPage() {
  return (
    <main className="min-h-screen bg-gradient-subtle">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 bg-teal-500/20 text-teal-300 text-xs font-semibold rounded-full">
                2,500+ Deals
              </span>
              <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 text-xs font-semibold rounded-full">
                Updated Weekly
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              Biotech Deal Database
            </h1>
            <p className="text-lg sm:text-xl text-neutral-300 mb-6">
              Browse real licensing deals across oncology, rare disease, and autoimmune.
              Filter by modality, phase, indication, and financial terms.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-400">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                SEC & Press Release Data
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Verified Financial Terms
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                2019-2025 Coverage
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deal Browser */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DealBrowser />
      </div>
    </main>
  );
}
