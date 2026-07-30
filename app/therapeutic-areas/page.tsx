import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Biopharma Deal Benchmarks by Therapeutic Area 2026 | Solidus',
  description: 'Deal benchmarks across 12 TAs: oncology, neurology, immunology, rare disease & more. Licensing, M&A, royalty data from 1,600+ verified deals.',
  keywords: ['therapeutic area deal benchmarks', 'biopharma licensing deals 2026', 'pharma M&A benchmarks', 'drug deal royalty rates', 'therapeutic area comparison'],
  openGraph: {
    title: 'Biopharma Deal Benchmarks by Therapeutic Area 2026 | Solidus',
    description: 'Deal benchmarks across 12 TAs: oncology, neurology, immunology, rare disease & more. Licensing, M&A, royalty data from 1,600+ verified deals.',
    type: 'website',
    url: 'https://solidus.ambrosiaventures.co/therapeutic-areas',
    siteName: 'Solidus by Ambrosia Ventures',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Biopharma Deal Benchmarks by Therapeutic Area 2026 | Solidus',
    description: 'Deal benchmarks across 12 TAs: oncology, neurology, immunology, rare disease & more.',
  },
  alternates: { canonical: 'https://solidus.ambrosiaventures.co/therapeutic-areas' },
};

const TAS = [
  { slug: 'oncology', name: 'Oncology', icon: '🎯', tagline: 'Most active TA for deal volume' },
  { slug: 'neurology', name: 'Neurology & CNS', icon: '🧠', tagline: '#1 in total deal value in 2026' },
  { slug: 'immunology', name: 'Immunology', icon: '🛡️', tagline: '$13B+ in verified deal value' },
  { slug: 'cardiovascular', name: 'Cardiovascular', icon: '❤️', tagline: 'Novel mechanisms driving revival' },
  { slug: 'metabolic', name: 'Metabolic & Obesity', icon: '⚖️', tagline: 'GLP-1 licensing race heats up' },
  { slug: 'rareDisease', name: 'Rare Disease', icon: '🧬', tagline: '15-25% PoS vs 7-12% overall' },
  { slug: 'infectiousDisease', name: 'Infectious Disease', icon: '🦠', tagline: 'Post-pandemic platform deals' },
  { slug: 'ophthalmology', name: 'Ophthalmology', icon: '👁️', tagline: 'Premium retinal deal valuations' },
  { slug: 'dermatology', name: 'Dermatology', icon: '🩹', tagline: 'AD & psoriasis biologics boom' },
  { slug: 'womensHealth', name: 'Women\'s Health', icon: '♀️', tagline: 'Underserved market, rising deals' },
  { slug: 'gastroenterology', name: 'Gastroenterology', icon: '🔬', tagline: 'TL1A & microbiome deals surging' },
  { slug: 'hematology', name: 'Hematology', icon: '🩸', tagline: 'CAR-T & gene therapy leaders' },
];

export default function TherapeuticAreasIndex() {
  return (
    <>
    <main className="min-h-screen bg-white dark:bg-slate-900 py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
          Biopharma Deal Benchmarks by Therapeutic Area
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 mb-10">
          Explore licensing, acquisition, and collaboration deal terms across 12 therapeutic areas, powered by 1,600+ verified transactions with disclosed financial terms.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TAS.map(ta => (
            <Link
              key={ta.slug}
              href={`/therapeutic-areas/${ta.slug}`}
              className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg transition-all"
            >
              <div className="text-2xl mb-2">{ta.icon}</div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                {ta.name}
              </h2>
              <p className="text-xs font-medium text-teal-600 dark:text-teal-400 mt-1">{ta.tagline}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">View deal benchmarks →</p>
            </Link>
          ))}
        </div>
      </div>

      {/* JSON-LD: CollectionPage */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "Biopharma Deal Benchmarks by Therapeutic Area 2026",
        "description": "Deal benchmarks across 12 therapeutic areas including oncology, neurology, immunology, rare disease, and more. Licensing, M&A, and royalty data from 1,600+ verified biopharma transactions.",
        "url": "https://solidus.ambrosiaventures.co/therapeutic-areas",
        "isPartOf": { "@type": "WebSite", "name": "Solidus", "url": "https://solidus.ambrosiaventures.co" },
        "breadcrumb": {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://solidus.ambrosiaventures.co" },
            { "@type": "ListItem", "position": 2, "name": "Therapeutic Areas" },
          ],
        },
        "mainEntity": {
          "@type": "ItemList",
          "numberOfItems": 12,
          "itemListElement": TAS.map((ta, i) => ({
            "@type": "ListItem",
            "position": i + 1,
            "name": `${ta.name} Deal Benchmarks`,
            "url": `https://solidus.ambrosiaventures.co/therapeutic-areas/${ta.slug}`,
          })),
        },
      })}} />
    </main>
    </>
  );
}
