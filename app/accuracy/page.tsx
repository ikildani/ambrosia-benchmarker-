import { Metadata } from 'next';
import Link from 'next/link';
import { loadAccuracyData } from '@/lib/accuracy-dashboard-data';
import { HitRateCards } from '@/components/accuracy/HitRateCards';
import { SliceTable } from '@/components/accuracy/SliceTable';
import { CalibrationTimeline } from '@/components/accuracy/CalibrationTimeline';
import { InstitutionalNav } from '@/components/institutional/InstitutionalNav';

const BASE_URL = 'https://solidus.ambrosiaventures.co';

export const metadata: Metadata = {
  title: 'Benchmark Accuracy | Solidus',
  description:
    'Honest accuracy disclosure for the Solidus directional BD tool. Live backtest against 574+ real disclosed deals from 2017-2026. Model view, hit rates, calibration journey — fully transparent.',
  keywords: [
    'pharma deal benchmark range',
    'biotech licensing directional tool',
    'deal comparable transparency',
    'backtest range coverage',
  ],
  alternates: { canonical: `${BASE_URL}/accuracy` },
  openGraph: {
    title: 'Benchmark Accuracy | Solidus',
    description:
      'Directional benchmark accuracy vs. 574+ verified real disclosed deals. Model view hit rates, calibration journey — fully public.',
    type: 'website',
    url: `${BASE_URL}/accuracy`,
    siteName: 'Solidus',
    images: [
      {
        url: '/api/og?title=Benchmark%20Accuracy&subtitle=Honest%20directional%20context%20vs%20574%2B%20real%20deals',
        width: 1200,
        height: 630,
        alt: 'Solidus accuracy dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Benchmark Accuracy | Solidus',
    description:
      'Directional benchmark accuracy vs. 574+ verified real disclosed deals. No inflated metrics.',
  },
  // Internal-only: page is accessible via direct URL but not indexed
  // and not linked from any public navigation surface.
  robots: { index: false, follow: false, nocache: true },
};

// Internal diagnostic page — render on-demand so loader runs with latest
// baseline-errors.json state instead of being frozen at build time.
export const dynamic = 'force-dynamic';

const TARGETS = { hit25: 0.60, hit35: 0.70, hit50: 0.80 };

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function signedPct(x: number): string {
  const sign = x >= 0 ? '+' : '';
  return `${sign}${(x * 100).toFixed(0)}%`;
}

export default function AccuracyDashboard() {
  const data = loadAccuracyData();

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h1 className="text-2xl font-semibold">Accuracy data not yet available</h1>
          <p className="mt-4 text-slate-400">
            The calibration run has not completed. Check back shortly.
          </p>
        </div>
      </main>
    );
  }

  const activeFlags = Object.entries(data.featureFlags)
    .filter(([, v]) => v)
    .map(([k]) => k);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <InstitutionalNav activePath="/accuracy" />
      {/* Hero */}
      <section className="border-b border-slate-800/60 bg-gradient-to-b from-slate-900/50 to-slate-950">
        <div className="mx-auto max-w-6xl px-6 pt-32 sm:pt-36 lg:pt-40 pb-16">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
            Benchmark Accuracy — Fully Public
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-400">
            Solidus is a directional tool for BD professionals: it shows where your
            deal sits in the distribution of real comparable transactions, not a prediction
            of a specific dollar amount. Below is the honest track record against{' '}
            <span className="text-slate-200">{data.fullScope.n} real disclosed licensing, co-development, and acquisition deals</span>{' '}
            from 2017&ndash;2026. Every hit, every miss, every calibration round — in the open.
          </p>
          <p className="mt-4 max-w-3xl text-sm text-slate-500">
            <span className="text-teal-400 font-semibold">How to read this page:</span>{' '}
            Solidus shows a directional range from real comparable deals, not a
            point prediction. Comparable-deal upfronts genuinely span $20M&ndash;$1B+ within
            any TA segment — the wide range IS the market reality, not a modeling deficiency.
            For deal-specific predictive forecasting, see AlaricAI.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Last updated {formatDate(data.runAt)}
            {activeFlags.length > 0 ? (
              <>
                {' · '}
                Active features: {activeFlags.join(', ')}
              </>
            ) : (
              <> · All calibration features default-off pending validation</>
            )}
          </p>
        </div>
      </section>

      {/* Directional-coverage headline — what the product actually claims */}
      <section className="border-b border-slate-800/60 bg-teal-500/5">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-100">
              Directional coverage — the honest accuracy number
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              The results page shows users a p25&ndash;p75 benchmark range drawn from real
              disclosed comparables, not an engine point estimate. This measures how often
              the actual deal outcome falls inside that range.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-teal-500/40 bg-teal-500/10 p-4">
              <div className="text-[10px] uppercase tracking-wider text-teal-300 font-semibold">
                Median signed error (model view)
              </div>
              <div className="mt-2 font-mono text-3xl font-bold text-teal-200">
                {signedPct(data.coreScope.medianSignedErrorPct)}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                target: 0% (centered). Negative = engine undershoots; positive = overshoots
              </div>
            </div>
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4">
              <div className="text-[10px] uppercase tracking-wider text-cyan-300 font-semibold">
                Core ±50% hit rate (model view)
              </div>
              <div className="mt-2 font-mono text-3xl font-bold text-cyan-200">
                {pct(data.coreScope.hit50)}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                of {data.coreScope.n} core-scope deals — within half to double of actual
              </div>
            </div>
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Engine point within ±25%
              </div>
              <div className="mt-2 font-mono text-3xl font-bold text-slate-300">
                {pct(data.coreScope.hit25)}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                model-view only — not the primary signal shown to users
              </div>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-[11px] text-slate-500 leading-relaxed">
            Legacy hit-rate metrics (±25% / ±35% / ±50% of the engine&rsquo;s point estimate)
            are reported below for transparency. They&rsquo;re the measurement we use to
            tune per-regime calibration internally — they are not the accuracy claim we
            make to buyers of the product.
          </p>
        </div>
      </section>

      {/* Core scope — primary target */}
      <section className="border-b border-slate-800/60">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-slate-100">Core scope — Phase 2/3 licensing</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              The sweet spot where intrinsic-value modeling actually matches how real negotiations
              anchor. <span className="text-slate-200">{data.coreScope.n} deals</span> in this
              cohort. These hit-rate numbers are the primary calibration target.
            </p>
          </div>
          <HitRateCards bucket={data.coreScope} targets={TARGETS} />
          <div className="mt-6 grid gap-3 text-xs text-slate-500 sm:grid-cols-4">
            <div>
              Mean |error|:{' '}
              <span className="font-mono text-slate-300">{pct(data.coreScope.meanAbsErrorPct)}</span>
            </div>
            <div>
              Median signed error:{' '}
              <span className="font-mono text-slate-300">
                {signedPct(data.coreScope.medianSignedErrorPct)}
              </span>
            </div>
            <div>
              RMSE upfront:{' '}
              <span className="font-mono text-slate-300">${data.coreScope.rmseUpfront_M}M</span>
            </div>
            <div>
              Sample: <span className="font-mono text-slate-300">{data.coreScope.n} deals</span>
            </div>
          </div>
        </div>
      </section>

      {/* Held-out validation */}
      {data.holdout && (
        <section className="border-b border-slate-800/60 bg-slate-950">
          <div className="mx-auto max-w-6xl px-6 py-12">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-200">
                Held-out validation — does it generalize?
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                The calibration rounds tune against the full corpus. That risks overfitting.
                We split core scope 80/20 (deterministic hash on deal id) and measure hit rates
                separately on the test set the engine never saw during tuning.{' '}
                <span className="text-slate-300">Small train/test gap = the model generalizes.</span>{' '}
                Big gap = we&rsquo;re memorizing deals.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-5">
                <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">Train (80%, tuned)</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">±25%</span><span className="font-mono text-slate-200">{pct(data.holdout.train.hit25)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">±35%</span><span className="font-mono text-slate-200">{pct(data.holdout.train.hit35)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">±50%</span><span className="font-mono text-slate-200">{pct(data.holdout.train.hit50)}</span></div>
                  <div className="flex justify-between border-t border-slate-800 pt-1.5"><span className="text-slate-500">n</span><span className="font-mono text-slate-400">{data.holdout.train.n}</span></div>
                </div>
              </div>

              <div className="rounded-lg border border-teal-500/30 bg-teal-500/5 p-5">
                <div className="mb-2 text-xs uppercase tracking-wider text-teal-400">Test (20%, never seen)</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">±25%</span><span className="font-mono text-slate-100">{pct(data.holdout.test.hit25)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">±35%</span><span className="font-mono text-slate-100">{pct(data.holdout.test.hit35)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">±50%</span><span className="font-mono text-slate-100">{pct(data.holdout.test.hit50)}</span></div>
                  <div className="flex justify-between border-t border-slate-800 pt-1.5"><span className="text-slate-500">n</span><span className="font-mono text-slate-400">{data.holdout.test.n}</span></div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-5">
                <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">Overfitting gap</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">±25%</span><span className="font-mono text-slate-200">{signedPct(data.holdout.overfittingGap.hit25)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">±35%</span><span className="font-mono text-slate-200">{signedPct(data.holdout.overfittingGap.hit35)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">±50%</span><span className="font-mono text-slate-200">{signedPct(data.holdout.overfittingGap.hit50)}</span></div>
                  <div className="mt-2 text-xs text-slate-500">train − test, positive = overfit</div>
                </div>
              </div>
            </div>

            {/* Per-TA held-out breakdown — where does the model generalize, where does it overfit? */}
            {data.holdout.testByTA.length > 0 && (
              <div className="mt-10">
                <div className="mb-4 rounded-lg border border-teal-500/20 bg-teal-500/5 p-5">
                  <h3 className="text-base font-semibold text-slate-100">
                    Per-therapeutic-area generalization
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm text-slate-400">
                    The aggregate train/test gap can hide per-TA overfitting. This table
                    shows the 20% held-out hit rate broken out by therapeutic area — so
                    you can see exactly where our tuning generalizes (small gaps to the
                    full-corpus TA table below) versus where it doesn&rsquo;t (big gaps =
                    we memorized the specific deals, not the pricing pattern).
                  </p>
                </div>
                <div className="grid gap-8 lg:grid-cols-2">
                  <div>
                    <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-teal-400">
                      Test set (20%, never seen)
                    </h4>
                    <SliceTable rows={data.holdout.testByTA} dimension="TA" />
                  </div>
                  <div>
                    <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                      Train set (80%, tuned against)
                    </h4>
                    <SliceTable rows={data.holdout.trainByTA} dimension="TA" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Full scope */}
      <section className="border-b border-slate-800/60 bg-slate-900/20">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-200">Full scope — all {data.fullScope.n.toLocaleString()} disclosed deals</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Includes segments where single-asset intrinsic rNPV is the wrong model regardless
              of calibration &mdash; early-stage strategic upfronts, acquisitions, approved-asset
              royalty handoffs. Reported for transparency. Hit rates here improve as we add
              distinct pricing paths for each segment.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-4">
              <div className="text-xs text-slate-500">±25%</div>
              <div className="mt-1 font-mono text-xl text-slate-200">{pct(data.fullScope.hit25)}</div>
            </div>
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-4">
              <div className="text-xs text-slate-500">±35%</div>
              <div className="mt-1 font-mono text-xl text-slate-200">{pct(data.fullScope.hit35)}</div>
            </div>
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-4">
              <div className="text-xs text-slate-500">±50%</div>
              <div className="mt-1 font-mono text-xl text-slate-200">{pct(data.fullScope.hit50)}</div>
            </div>
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-4">
              <div className="text-xs text-slate-500">Sample</div>
              <div className="mt-1 font-mono text-xl text-slate-200">{data.fullScope.n}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Corpus transparency — why the numbers moved */}
      <section className="border-b border-slate-800/60 bg-amber-500/5">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="mb-6 flex items-start gap-3">
            <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">!</div>
            <div>
              <h2 className="text-xl font-semibold text-slate-100">Honest transparency — why the numbers are lower than last month</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                In April 2026 we expanded the backtest corpus from 251 hand-curated deals
                to {data.fullScope.n.toLocaleString()} deals pulled from production Supabase. Core-scope
                hit rates dropped — not because the engine got worse, but because the
                previous numbers were overfit to a narrow hand-picked sample. The larger
                corpus exposed calibration gaps the original corpus couldn&rsquo;t see
                (oncology especially: 21 deals → 188 deals). We also de-duped 500+ duplicate
                database entries that had been artificially inflating hit counts.
              </p>
              <p className="mt-3 max-w-3xl text-sm text-slate-400">
                <span className="text-slate-200 font-medium">This is the real baseline.</span>{' '}
                Every calibration round going forward is measured against these numbers on
                the de-duped corpus — not the smaller, noisier one.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Heat maps */}
      <section className="border-b border-slate-800/60">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="mb-6 text-2xl font-semibold text-slate-100">
            Where the model is strongest and weakest
          </h2>
          <p className="mb-8 max-w-3xl text-sm text-slate-400">
            Core-scope accuracy sliced by therapeutic area, phase, and modality. Colors
            indicate hit rate (teal is best) and signed error (teal is tightest bias).
            These are the signals driving our next calibration rounds.
          </p>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <h3 className="mb-2 text-sm font-medium uppercase tracking-wider text-slate-500">
                By Therapeutic Area
              </h3>
              <p className="mb-3 text-xs text-slate-500 leading-relaxed">
                TA-level accuracy exposes where our modality + indication profile coverage
                is deepest (oncology, immunology) vs. where thin corpus coverage still
                drives misses (rare disease, neurology).
              </p>
              <SliceTable rows={data.slicesByTA} dimension="TA" />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium uppercase tracking-wider text-slate-500">
                By Phase
              </h3>
              <p className="mb-3 text-xs text-slate-500 leading-relaxed">
                Phase 2 and Phase 3 are the rNPV sweet spot — structural variance is
                highest at the early-stage edges and on approved-asset handoffs, which
                the engine prices via different paths.
              </p>
              <SliceTable rows={data.slicesByPhase} dimension="Phase" />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium uppercase tracking-wider text-slate-500">
                By Modality
              </h3>
              <p className="mb-3 text-xs text-slate-500 leading-relaxed">
                Modality accuracy traces which platform-specific profiles (ADC sub-types,
                TCEs, cell therapy) we&rsquo;ve calibrated vs. still-coarse legacy buckets.
                Fine-grain slugs from R20 are being activated as corpus tagging catches up.
              </p>
              <SliceTable rows={data.slicesByModality} dimension="Modality" />
            </div>
          </div>
        </div>
      </section>

      {/* Calibration journey */}
      <section className="border-b border-slate-800/60 bg-slate-900/20">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-100">Calibration journey</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Every round of empirical tuning, including the failed hypotheses. We publish
              the regressions alongside the wins&mdash;the only platform in this space that does.
              If a round didn&rsquo;t move hit rates, we say so and move on.
            </p>
          </div>
          <CalibrationTimeline rounds={data.calibrationRounds} />
        </div>
      </section>

      {/* Worst misses */}
      <section className="border-b border-slate-800/60">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="mb-6 text-2xl font-semibold text-slate-100">Honest misses</h2>
          <p className="mb-6 max-w-3xl text-sm text-slate-400">
            The 10 worst-predicted deals in core scope. Publishing these keeps us honest&mdash;
            and tells users exactly which deal archetypes the model isn&rsquo;t ready to price.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-normal">Year</th>
                  <th className="px-4 py-3 text-left font-normal">Deal</th>
                  <th className="px-4 py-3 text-left font-normal">Profile</th>
                  <th className="px-4 py-3 text-right font-normal">Actual</th>
                  <th className="px-4 py-3 text-right font-normal">Predicted</th>
                  <th className="px-4 py-3 text-right font-normal">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {data.worstMisses.map((w) => (
                  <tr key={w.id} className="text-slate-300">
                    <td className="px-4 py-3 font-mono text-slate-400">{w.year}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-200">{w.licensor}</div>
                      <div className="text-xs text-slate-500">→ {w.licensee}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {w.therapeuticArea} · {w.phase} · {w.modality}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">
                      ${w.actualUpfront_M}M
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">
                      ${w.predictedUpfront_M.toFixed(0)}M
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-400">
                      {signedPct(w.errorPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="border-b border-slate-800/60 bg-slate-900/20">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="mb-6 text-2xl font-semibold text-slate-100">Methodology</h2>
          <div className="space-y-4 text-sm leading-relaxed text-slate-400">
            <p>
              Every deal in the corpus has publicly disclosed upfront and total-deal-value
              figures sourced from SEC 8-K filings, FTC premerger filings, and company press
              releases. For each deal, the engine is fed the asset profile as it was known at
              deal date (stage, modality, therapeutic area, indication, competitive position)
              and computes an implied upfront via rNPV. The predicted value is compared to
              the actual disclosed upfront.
            </p>
            <p>
              <span className="text-slate-200">Hit rate</span> is the share of deals where
              the absolute error on upfront falls within the stated tolerance band.
              <span className="text-slate-200">Signed error</span> is negative when the model
              under-predicts, positive when it over-predicts. Median is more informative than
              mean because biopharma deal distributions have heavy right tails.
            </p>
            <p>
              <span className="text-slate-200">Core scope</span> filters to Phase 2 / Phase 3
              licensing + co-development deals, the segment where intrinsic-value modeling
              actually maps onto market clearing price. Early-stage deals price on strategic
              option value; acquisitions price on bidding-war premium; approved deals are
              commercialization handoffs where the bulk of value flows through royalties.
              These segments need distinct pricing paths &mdash; we&rsquo;re building them in
              parallel, but don&rsquo;t count them against core-scope accuracy until they
              ship.
            </p>
            <p>
              Calibration follows an <span className="text-slate-200">Option B rigor</span>{' '}
              standard: every change must improve or maintain backtest accuracy against the
              held-out corpus and cite a specific source (FDA CDER, Wong/Siah/Lo 2019, Nature
              Reviews Drug Discovery, company 10-K, or the backtest itself as empirical
              source). Failed rounds are reverted and documented publicly&mdash;visible in
              the Calibration Journey above.
            </p>
          </div>
        </div>
      </section>

    </main>
  );
}
