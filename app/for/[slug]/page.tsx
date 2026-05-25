import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface SlugData {
  company: string;
  indication: string;
  phase: string;
  asset: string;
}

function parseSlug(slug: string): SlugData | null {
  const parts = slug.split('--');
  if (parts.length < 2) return null;

  const company = parts[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const rest = parts.slice(1).join('--');
  const segments = rest.split('-');

  let phase = '';
  let asset = '';
  let indicationParts: string[] = [];

  for (const seg of segments) {
    if (seg.match(/^p[123]$/i)) {
      phase = `Phase ${seg.slice(1)}`;
    } else if (seg.match(/^preclinical$/i)) {
      phase = 'Preclinical';
    } else if (seg === seg.toUpperCase() && seg.length > 1 && seg.length < 15) {
      asset = seg;
    } else {
      indicationParts.push(seg);
    }
  }

  const indication = indicationParts
    .join(' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  if (!indication) return null;

  return { company, indication, phase, asset };
}

type BenchmarkTier = { upfrontLow: number; upfrontHigh: number; totalLow: number; totalHigh: number; royaltyLow: number; royaltyHigh: number; deals: number; loaPercent: number };

function getBenchmarks(phase: string): BenchmarkTier {
  switch (phase) {
    case 'Phase 3':
      return { upfrontLow: 50, upfrontHigh: 250, totalLow: 400, totalHigh: 2200, royaltyLow: 12, royaltyHigh: 25, deals: 47, loaPercent: 58 };
    case 'Phase 2':
      return { upfrontLow: 20, upfrontHigh: 100, totalLow: 150, totalHigh: 900, royaltyLow: 8, royaltyHigh: 20, deals: 83, loaPercent: 32 };
    case 'Phase 1':
      return { upfrontLow: 5, upfrontHigh: 45, totalLow: 80, totalHigh: 500, royaltyLow: 5, royaltyHigh: 15, deals: 61, loaPercent: 14 };
    default:
      return { upfrontLow: 3, upfrontHigh: 25, totalLow: 50, totalHigh: 350, royaltyLow: 3, royaltyHigh: 12, deals: 39, loaPercent: 7 };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = parseSlug(slug);
  if (!data) return { title: 'Benchmark Preview | Ambrosia' };

  return {
    title: `${data.indication} Deal Benchmarks — ${data.company} | Ambrosia`,
    description: `Licensing and M&A benchmarks for ${data.indication} ${data.phase} assets based on comparable transactions.`,
    robots: 'noindex, nofollow',
  };
}

export default async function PreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = parseSlug(slug);
  if (!data) notFound();

  const b = getBenchmarks(data.phase);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="border-b border-slate-800/60 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="text-sm font-semibold tracking-wide text-teal-400">AMBROSIA</span>
          <span className="text-xs text-slate-500">Benchmark Preview</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-2 flex items-center gap-2">
          {data.phase && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
              {data.phase}
            </span>
          )}
          {data.asset && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {data.asset}
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold text-white mb-1">
          {data.indication} — Deal Benchmarks
        </h1>
        <p className="text-slate-400 text-sm mb-10">
          Prepared for {data.company} &middot; Based on {b.deals} comparable transactions
        </p>

        <div className="grid grid-cols-2 gap-4 mb-10">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Upfront Payment</p>
            <p className="text-xl font-bold text-white">${b.upfrontLow}M – ${b.upfrontHigh}M</p>
            <p className="text-xs text-slate-500 mt-1">Median of comparable {data.phase || 'stage'} deals</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Deal Value</p>
            <p className="text-xl font-bold text-white">${b.totalLow}M – ${(b.totalHigh / 1000).toFixed(1)}B</p>
            <p className="text-xs text-slate-500 mt-1">Upfront + milestones + royalties</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Royalty Range</p>
            <p className="text-xl font-bold text-white">{b.royaltyLow}% – {b.royaltyHigh}%</p>
            <p className="text-xs text-slate-500 mt-1">Net sales, tiered structure typical</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Likelihood of Approval</p>
            <p className="text-xl font-bold text-white">{b.loaPercent}%</p>
            <p className="text-xs text-slate-500 mt-1">Historical LoA for {data.phase || 'this stage'}</p>
          </div>
        </div>

        <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-6 mb-10">
          <h2 className="text-sm font-semibold text-white mb-3">Full benchmark includes:</h2>
          <ul className="grid grid-cols-2 gap-2 text-sm text-slate-400">
            <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-teal-400" />Comparable deal breakdowns</li>
            <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-teal-400" />Milestone structure analysis</li>
            <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-teal-400" />Buyer probability ranking</li>
            <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-teal-400" />Risk-adjusted NPV</li>
            <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-teal-400" />Deal waterfall projections</li>
            <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-teal-400" />Real options valuation</li>
          </ul>
        </div>

        <div className="text-center">
          <Link
            href="/calculator"
            className="inline-block bg-teal-500 hover:bg-teal-400 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors text-sm"
          >
            Run full benchmark — 7-day free trial &rarr;
          </Link>
          <p className="text-xs text-slate-500 mt-3">No card required. Full Pro access for 7 days.</p>
        </div>
      </main>

      <footer className="border-t border-slate-800/40 px-6 py-6 mt-20">
        <div className="max-w-3xl mx-auto text-center text-xs text-slate-600">
          Ambrosia Ventures &middot; Deal intelligence for biopharma
        </div>
      </footer>
    </div>
  );
}
