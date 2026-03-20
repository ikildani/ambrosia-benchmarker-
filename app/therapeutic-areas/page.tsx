import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Therapeutic Area Deal Benchmarks — All 12 TAs | Ambrosia Ventures',
  description: 'Explore biopharma deal benchmarks across 12 therapeutic areas: oncology, neurology, immunology, cardiovascular, metabolic, rare disease, infectious disease, ophthalmology, dermatology, women\'s health, gastroenterology, and hematology.',
  alternates: { canonical: 'https://calculator.ambrosiaventures.co/therapeutic-areas' },
};

const TAS = [
  { slug: 'oncology', name: 'Oncology', icon: '🎯' },
  { slug: 'neurology', name: 'Neurology & CNS', icon: '🧠' },
  { slug: 'immunology', name: 'Immunology', icon: '🛡️' },
  { slug: 'cardiovascular', name: 'Cardiovascular', icon: '❤️' },
  { slug: 'metabolic', name: 'Metabolic & Obesity', icon: '⚖️' },
  { slug: 'rareDisease', name: 'Rare Disease', icon: '🧬' },
  { slug: 'infectiousDisease', name: 'Infectious Disease', icon: '🦠' },
  { slug: 'ophthalmology', name: 'Ophthalmology', icon: '👁️' },
  { slug: 'dermatology', name: 'Dermatology', icon: '🩹' },
  { slug: 'womensHealth', name: 'Women\'s Health', icon: '♀️' },
  { slug: 'gastroenterology', name: 'Gastroenterology', icon: '🔬' },
  { slug: 'hematology', name: 'Hematology', icon: '🩸' },
];

export default function TherapeuticAreasIndex() {
  return (
    <main className="min-h-screen bg-white dark:bg-slate-900 py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
          Biopharma Deal Benchmarks by Therapeutic Area
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 mb-10">
          Explore licensing, acquisition, and collaboration deal terms across 12 therapeutic areas, powered by 3,000+ verified transactions.
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
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">View deal benchmarks →</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
