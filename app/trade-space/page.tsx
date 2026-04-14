import { Metadata } from 'next';
import Link from 'next/link';
import { loadTradeSpaceScenarios } from '@/lib/trade-space-data';
import { StructureCards } from '@/components/trade-space/StructureCards';
import { InstitutionalNav } from '@/components/institutional/InstitutionalNav';
import { SiteFooter } from '@/components/seo/SiteFooter';

const BASE_URL = 'https://calculator.ambrosiaventures.co';

export const metadata: Metadata = {
  title: 'Deal Structure Trade Space | Ambrosia Benchmarker',
  description:
    'Every asset has five possible deal structures — licensing, acquisition, co-development, option, and collaboration. The Ambrosia engine runs all five and ranks them by total value to the licensor.',
  alternates: { canonical: `${BASE_URL}/trade-space` },
  openGraph: {
    title: 'Deal Structure Trade Space | Ambrosia Benchmarker',
    description: 'The same asset under 5 deal structures, ranked by value. Licensing isn\'t always the answer.',
    type: 'website',
    url: `${BASE_URL}/trade-space`,
    siteName: 'Ambrosia Benchmarker',
    images: [
      {
        url: '/api/og?title=Trade%20Space&subtitle=5%20structures%2C%20ranked%20by%20value',
        width: 1200,
        height: 630,
        alt: 'Deal structure trade space',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Deal Structure Trade Space | Ambrosia Benchmarker',
    description: '5 deal structures ranked for each asset. Licensing isn\'t always the answer.',
  },
};

export const dynamic = 'force-dynamic';

export default function TradeSpacePage() {
  const scenarios = loadTradeSpaceScenarios();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <InstitutionalNav activePath="/trade-space" />
      <section className="border-b border-slate-800/60 bg-gradient-to-b from-slate-900/50 to-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
            Deal Structure Trade Space
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-400">
            Most BD conversations anchor on licensing because that&rsquo;s the default. But the
            same asset could be 20&ndash;60% more valuable under a different structure &mdash; or
            significantly less. Below are four representative assets run through all five deal
            structures, ranked by total value to the licensor.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Computed by <code className="rounded bg-slate-800 px-1 py-0.5 text-slate-400">optimizeDealStructure()</code>{' '}
            (backtest-validated engine).
            Upfront, milestone allocation, and royalty structures vary by deal type per the{' '}
            <code className="rounded bg-slate-800 px-1 py-0.5 text-slate-400">DEAL_TYPE_CAPTURE</code> and{' '}
            <code className="rounded bg-slate-800 px-1 py-0.5 text-slate-400">PHASE_ALLOCATION</code>{' '}
            tables. All figures in $M unless noted otherwise.
          </p>
        </div>
      </section>

      {scenarios.map((scenario) => (
        <section
          key={scenario.slug}
          id={scenario.slug}
          className="border-b border-slate-800/60 even:bg-slate-900/20"
        >
          <div className="mx-auto max-w-6xl px-6 py-12">
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-slate-100">{scenario.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{scenario.subtitle}</p>
              </div>
              <div className="flex gap-4 text-xs text-slate-500">
                <span className="capitalize">
                  <span className="text-slate-400">TA:</span> {scenario.asset.ta.replace(/_/g, ' ')}
                </span>
                <span>
                  <span className="text-slate-400">Phase:</span> {scenario.asset.phase.replace(/_/g, ' ')}
                </span>
                <span>
                  <span className="text-slate-400">Modality:</span> {scenario.asset.modality}
                </span>
                <span>
                  <span className="text-slate-400">Peak:</span> ${scenario.asset.peakSalesM}M
                </span>
              </div>
            </div>

            {scenario.result.recommendation && (
              <div className="mb-6 rounded-lg border border-teal-500/30 bg-teal-500/5 p-4">
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-teal-400">
                  Recommendation ({scenario.result.recommendationStrength})
                </div>
                <p className="text-sm text-slate-200">{scenario.result.recommendation}</p>
              </div>
            )}

            <StructureCards rankings={scenario.result.rankings} />
          </div>
        </section>
      ))}

      {/* Methodology */}
      <section className="border-b border-slate-800/60 bg-slate-900/20">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="mb-4 text-xl font-semibold text-slate-100">How we compute this</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-400">
            <p>
              For each asset, the engine runs <code className="rounded bg-slate-800 px-1 py-0.5">calculateRNPV()</code>{' '}
              five times — one per deal type. Peak sales, PoS, discount rate, and cash flow timing
              are constant across runs; only deal-type-specific upfront / milestone / royalty
              structure varies. The resulting implied deal values are the headline numbers shown
              in each card.
            </p>
            <p>
              Rankings apply a licensor preference profile: clinical-stage biotechs with short
              cash runway weight cash-now higher, large pharma weights retained upside higher. The
              profile shifts ties but doesn&rsquo;t override a meaningfully better headline value.
            </p>
            <p>
              We surface a recommendation <em>only</em> when the top alternative beats the user&rsquo;s
              current structure by ≥20%. Below that threshold, the signal is too weak to override
              the strategic context (tax, IP, control, relationship dynamics) that drive the
              choice in practice. This tool informs the conversation; it doesn&rsquo;t replace it.
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
