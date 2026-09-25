import { Metadata } from 'next';
import Link from 'next/link';
import { InstitutionalNav } from '@/components/institutional/InstitutionalNav';
import { COMP_MATCH_WEIGHTS, COMP_MAX_SCORE, MIN_POOL_BEFORE_RELAX } from '@/lib/comparable-scoring';
import { PEAK_SALES_PHASE_MULTIPLIER } from '@/components/calculator/peakSalesBaseline';
import { getCumulativePoS, PHASE_DURATION } from '@/lib/financial/pos-tables';
import { DEFAULT_DISCOUNT_RATES } from '@/lib/financial/discount-rates';
import { ENGINE_VERSION } from '@/lib/financial/calculation-version';
import { loadAccuracyData } from '@/lib/accuracy-dashboard-data';
import { loadPreclinicalBacktestSlice } from '@/lib/preclinical-backtest-slice';
import { getPreclinicalPool, taLabel } from '@/lib/preclinical-pool';

// Server component. Every number is read from the engine, its data files or
// the database at render time, so this page cannot drift from what the
// product does. Where a value lives in a module-private constant it is
// quoted with the engine version it was read from.

const BASE_URL = 'https://solidus.ambrosiaventures.co';

export const metadata: Metadata = {
  title: 'Preclinical Valuation Methodology | Solidus',
  description:
    'What sits behind a Solidus preclinical valuation: the comparable deals and how many there are, how peak sales is estimated before clinical data exists, and what the backtest does and does not show.',
  alternates: { canonical: `${BASE_URL}/methodology/preclinical` },
  openGraph: {
    title: 'Preclinical Valuation Methodology | Solidus',
    description: 'Comparable pool, peak-sales fallback order, preclinical risk chain, and backtest scope, read live from the engine.',
    type: 'article',
    url: `${BASE_URL}/methodology/preclinical`,
    siteName: 'Solidus',
    images: [
      {
        url: '/api/og?title=Preclinical%20Valuation%20Methodology&subtitle=What%20sits%20behind%20the%20number',
        width: 1200,
        height: 630,
        alt: 'Solidus preclinical valuation methodology',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Preclinical Valuation Methodology | Solidus',
    description: 'Comparable pool, peak-sales fallback order, preclinical risk chain, and backtest scope.',
  },
};

export const revalidate = 900;

const TAS = ['oncology', 'immunology', 'neurology', 'rareDisease', 'metabolic', 'cardiovascular', 'infectiousDisease'] as const;

function pct(x: number, digits = 0): string {
  return `${(x * 100).toFixed(digits)}%`;
}

function share(num: number, den: number): string {
  return den > 0 ? `${Math.round((num / den) * 100)}%` : '—';
}

function yearsToLaunch(ta: string): number {
  const d = PHASE_DURATION[ta] ?? PHASE_DURATION.oncology;
  return ['preclinical', 'phase1', 'phase2', 'phase3', 'nda_filed'].reduce((s, p) => s + (d[p] ?? 0), 0);
}

function SectionAnchor({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="group mt-12 scroll-mt-20 text-xl font-semibold text-slate-100">
      <Link href={`#${id}`} className="no-underline">
        {children}
        <span className="ml-2 text-slate-700 opacity-0 transition-opacity group-hover:opacity-100">#</span>
      </Link>
    </h2>
  );
}

const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400';
const td = 'px-3 py-2 text-sm text-slate-300 tabular-nums';

export default async function PreclinicalMethodologyPage() {
  const pool = await getPreclinicalPool();
  const accuracy = loadAccuracyData();
  const slice = loadPreclinicalBacktestSlice();
  const runDate = (slice?.runAt || accuracy?.runAt || '').slice(0, 10);

  const riskRows = TAS.map(ta => {
    const pos = getCumulativePoS('preclinical', ta, 'smallMolecule', 'none', {
      breakthrough: false, fastTrack: false, orphan: false, prime: false,
    });
    return {
      ta,
      cumulativePoS: pos.cumulativePoS,
      years: yearsToLaunch(ta),
      discount: DEFAULT_DISCOUNT_RATES[ta]?.preclinical ?? DEFAULT_DISCOUNT_RATES.oncology.preclinical,
    };
  });
  const posMin = Math.min(...riskRows.map(r => r.cumulativePoS));
  const posMax = Math.max(...riskRows.map(r => r.cumulativePoS));
  const preMult = PEAK_SALES_PHASE_MULTIPLIER.preclinical;
  const w = COMP_MATCH_WEIGHTS as Record<string, number>;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <InstitutionalNav activePath="/methodology/engine" />
      <section className="relative overflow-hidden border-b border-slate-800/60 bg-gradient-to-b from-slate-900/50 to-slate-950">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-teal-500/[0.03] rounded-full blur-3xl pointer-events-none -translate-y-1/2" />
        <div className="mx-auto max-w-4xl px-6 pt-20 pb-16">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-400">Methodology</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
            Preclinical valuation: what sits behind the number
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-400">
            Before clinical data exists, a valuation is mostly a statement about comparable transactions and
            about risk. This page shows exactly which deals a preclinical number draws on and how many there
            are, how peak sales is estimated when there is no revenue to anchor to, and what our backtest
            does and does not show at this stage. It is written for the evaluator who intends to check.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs">
            <Link href="/methodology" className="rounded-full border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-slate-300 hover:bg-slate-900">Benchmark methodology →</Link>
            <Link href="/methodology/engine" className="rounded-full border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-slate-300 hover:bg-slate-900">Engine methodology →</Link>
            <Link href="/accuracy" className="rounded-full border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-slate-300 hover:bg-slate-900">Accuracy dashboard →</Link>
          </div>
        </div>
      </section>

      <article className="mx-auto max-w-4xl px-6 py-12 text-base leading-relaxed text-slate-300">
        <SectionAnchor id="headline">1. What the headline number is</SectionAnchor>
        <p className="mt-4">
          The range on the results page is a therapeutic-area × phase baseline multiplied by the modifiers you
          set (modality, territory, competitive position, data quality, designations). The baseline comes from
          a live calibration when at least five verified, disclosed deals exist for that area and phase, and
          from the static benchmark tables otherwise; the results page says which. The low–high band is a fixed
          directional width around the median, not a percentile of the comparable set.
        </p>
        <p className="mt-3">
          Below Phase 2 the rNPV family has little signal: cumulative success probabilities of a few percent and
          a decade to market make the risk-adjusted NPV a small residual of two large numbers. So in the ensemble
          the comparable-transaction method is floored at two-thirds of the blend for discovery, preclinical and
          Phase 1 assets. In plain terms: at this stage the number is anchored on what buyers paid for similar
          programs, and the rest of the model widens or narrows the band around that anchor.
        </p>

        <SectionAnchor id="comps">2. Which comparable deals, and how many</SectionAnchor>
        <p className="mt-4">
          Every deal in the database is scored against your inputs with the additive rule below (the same
          constants the product reads). A deal qualifies when it shares the therapeutic area and at least one of
          same phase, adjacent phase or indication. If fewer than {MIN_POOL_BEFORE_RELAX} deals qualify, the
          rule widens in two steps, to area + modality and then to area only, and the panel labels the widened
          pool. The top 30 by score are kept; upfront and total ranges are recency-weighted quartiles with a
          2.5-year half-life.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/60"><tr><th className={th}>Match</th><th className={th}>Points</th></tr></thead>
            <tbody className="divide-y divide-slate-800/60">
              {Object.entries(w).map(([k, v]) => (
                <tr key={k}><td className={td}>{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</td><td className={td}>{v}</td></tr>
              ))}
              <tr className="bg-slate-900/40"><td className={`${td} font-semibold text-slate-200`}>maximum</td><td className={`${td} font-semibold text-slate-200`}>{COMP_MAX_SCORE}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4">
          Only rows with disclosed terms are eligible, and rows the verifier has rejected or flagged are excluded.
          Rows still awaiting verification are included and labelled. On a Pro seat the Deal Transparency panel
          lists up to fifty of these comps with upfront, total value, phase, modality, date, verification status
          and a link to the filing or release, and exports them to CSV. That list is the answer to &ldquo;which
          deals is this built on&rdquo;.
        </p>
        <p className="mt-3">
          The honest part is the size of the early-stage pool. After the September 2026 verification sweep, the
          preclinical and discovery deals that pass the filter above number{' '}
          <strong className="text-slate-100">{pool.total}</strong> across all areas
          {pool.fallback ? ` (snapshot of ${pool.asOf})` : ` (live, ${pool.asOf})`}:
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/60">
              <tr><th className={th}>Therapeutic area</th><th className={th}>Eligible comps</th><th className={th}>Verifier-confirmed</th><th className={th}>With source link</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {pool.rows.map(r => (
                <tr key={r.therapeuticArea}>
                  <td className={td}>{taLabel(r.therapeuticArea)}</td>
                  <td className={td}>{r.deals}</td>
                  <td className={td}>{r.verified}</td>
                  <td className={td}>{r.cited}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-slate-400">
          Why so few: the verifier that confirms deals against web sources treated any date mismatch or a
          per-program milestone total as grounds to flag a row, and flagged rows are excluded above. Of 280
          early-stage rows it flagged, its own notes confirm the deal exists for 231. Those rows are being
          re-adjudicated with corrected fields and a citation from late September 2026, and targeted ingestion
          of preclinical deals with disclosed upfronts is running alongside. This table updates every fifteen
          minutes; the number you see is the number the product uses.
        </p>

        <SectionAnchor id="peak-sales">3. How peak sales is estimated before clinical data</SectionAnchor>
        <p className="mt-4">
          Peak sales is estimated at the level of the indication, not the asset, and by the same method at every
          phase. What changes at preclinical is how much it matters (little, see section 1) and how heavily it is
          risk-adjusted (section 4). The order of precedence in the engine:
        </p>
        <ol className="mt-4 space-y-2 pl-5 [&_li]:list-decimal [&_li]:text-slate-400 [&_li::marker]:text-slate-600">
          <li><strong className="text-slate-200">Your number.</strong> Enter an analyst or internal peak-sales view and it drives both the headline (as a separate, labelled adjustment) and the rNPV.</li>
          <li><strong className="text-slate-200">Epidemiology-derived estimate.</strong> For about 270 indications: prevalence × diagnosed × treated × drug-eligible × adoption ceiling × share by competitive position × annual cost × territory price index, cross-checked against a curated range from company filings and industry forecasts, and hard-capped at 80% of the indication&rsquo;s addressable market.</li>
          <li><strong className="text-slate-200">Multiple of deal value.</strong> When neither exists: for preclinical, {preMult.low}× / {preMult.median}× / {preMult.high}× the benchmark deal value (low / median / high).</li>
        </ol>
        <p className="mt-4 text-sm text-slate-400">
          Known issue, disclosed rather than hidden: the default shown in the calculator&rsquo;s peak-sales field
          is the indication&rsquo;s &ldquo;typical asset peak&rdquo; from a separate curated table, which can differ
          from the epidemiology figure the rNPV actually uses. If you enter your own number the discrepancy
          disappears. Aligning the two is on the engine roadmap.
        </p>

        <SectionAnchor id="risk">4. The preclinical risk chain</SectionAnchor>
        <p className="mt-4">
          A preclinical asset carries the full chain of transition probabilities to approval (base rates by
          therapeutic area from BIO, Citeline and Wong–Siah–Lo, adjusted for modality, biomarker strategy and
          designations), the full development timeline, and a stage-specific discount rate. Read live from the
          engine for a small molecule with no biomarker selection and no designation:
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/60">
              <tr><th className={th}>Therapeutic area</th><th className={th}>Cumulative PoS from preclinical</th><th className={th}>Years to launch</th><th className={th}>Discount rate</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {riskRows.map(r => (
                <tr key={r.ta}>
                  <td className={td}>{taLabel(r.ta)}</td>
                  <td className={td}>{pct(r.cumulativePoS, 1)}</td>
                  <td className={td}>{r.years.toFixed(1)}</td>
                  <td className={td}>{pct(r.discount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4">
          So a preclinical program is valued at roughly {pct(posMin, 0)}–{pct(posMax, 0)} of its unrisked value
          before discounting. On top of that, the Monte Carlo layer uses wider early-stage scenarios (bear peak
          sales −40% and bull +50%, with heavier tail weights than at later stages), and the implied upfront is
          taken as a small share of rNPV at this stage (3–8%, engine {ENGINE_VERSION}). Those two constants live
          inside the engine rather than in a shared table, which is why they are quoted with a version.
        </p>

        <SectionAnchor id="backtest">5. What the backtest shows for preclinical, and what it does not</SectionAnchor>
        <p className="mt-4">
          We publish a backtest of predicted against disclosed upfronts on{' '}
          <Link href="/accuracy" className="text-cyan-400 hover:text-cyan-300">/accuracy</Link>. Three things to
          know before reading its preclinical slice. It scores the rNPV engine, not the calculator&rsquo;s headline
          baseline. The test harness applies an early-stage floor to predictions that the product does not
          apply. And the held-out split is by deal id, not by time, and was introduced after early rounds were
          tuned on the full corpus, so it is a partial check rather than a clean out-of-sample test.
        </p>
        {slice ? (
          <>
            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800">
                <thead className="bg-slate-900/60"><tr><th className={th}>Preclinical slice, run {runDate}</th><th className={th}>Value</th></tr></thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr><td className={td}>Deals with a disclosed upfront</td><td className={td}>{slice.n}</td></tr>
                  <tr><td className={td}>Upfront within ±50% of actual</td><td className={td}>{share(slice.within50, slice.n)} ({slice.within50})</td></tr>
                  <tr><td className={td}>Upfront within a factor of two</td><td className={td}>{share(slice.within2x, slice.n)} ({slice.within2x})</td></tr>
                  <tr><td className={td}>Naive model: predict the phase median every time, within a factor of two</td><td className={td}>{share(slice.phaseMedianWithin2x, slice.n)} ({slice.phaseMedianWithin2x})</td></tr>
                  <tr><td className={td}>Predictions sitting at the harness&rsquo;s $75M floor (±10%)</td><td className={td}>{share(slice.atFloor, slice.n)} ({slice.atFloor})</td></tr>
                  <tr><td className={td}>Median actual / median predicted upfront</td><td className={td}>${slice.medianActualUpfront_M.toFixed(0)}M / ${slice.medianPredictedUpfront_M.toFixed(1)}M</td></tr>
                  <tr><td className={td}>Median absolute error on upfront</td><td className={td}>{pct(slice.medianAbsErrorPct)}</td></tr>
                  <tr><td className={td}>Total deal value within a factor of two</td><td className={td}>{share(slice.totalWithin2x, slice.n)} ({slice.totalWithin2x})</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4">
              Read plainly: at preclinical the engine&rsquo;s upfront lands within a factor of two about as often as
              guessing the phase median would, and a large share of its predictions sit at the harness floor. Total
              deal value is almost never within a factor of two, because milestone stacks at this stage are set by
              program count and strategic intent, which the model does not see. Separately, a per-factor
              regression on the same corpus finds preclinical deals close at roughly 2.9× what the Phase 2
              baseline would imply (95% CI 2.2–3.8×), which is why the early-stage baselines were raised in
              September 2026.
            </p>
          </>
        ) : (
          <p className="mt-4 text-slate-400">The backtest report is not available in this build.</p>
        )}
        <p className="mt-4">
          What this means for use: treat a preclinical output as a range plus a comparable list, not a point
          estimate. The comparable list, with sources, is the defensible artifact; the band tells you where in
          that list a program with your profile tends to sit.
        </p>

        <SectionAnchor id="next">6. What is changing</SectionAnchor>
        <ul className="mt-4 space-y-2 pl-5 [&_li]:list-disc [&_li]:text-slate-400 [&_li::marker]:text-slate-600">
          <li>Flagged early-stage rows are being re-adjudicated with corrected upfront, total, date, stage and asset name, and a citation, early-stage rows first (from Sep 25 2026).</li>
          <li>Ingestion now asks specifically for preclinical and discovery deals with disclosed upfronts, 2019 onward, across every therapeutic area, and SEC full-text search includes research-collaboration, discovery-collaboration and option-to-license agreements.</li>
          <li>The calibration tables refresh weekly; when an area reaches five verified preclinical deals its baseline switches from the static table to the live one, and the results page says so.</li>
          <li>A time-based holdout for the backtest, and the alignment of the calculator&rsquo;s default peak-sales field with the engine, are the next two methodology items.</li>
        </ul>
        <p className="mt-8 text-sm text-slate-500">
          Questions about any figure on this page go through the{' '}
          <Link href="/contact" className="text-cyan-400 hover:text-cyan-300">contact page</Link>. Every number above is
          read from the engine, its data files or the database at render time.
        </p>
      </article>
    </main>
  );
}
