import { Metadata } from 'next';
import Link from 'next/link';
import { loadAccuracyData, type BucketSummary } from '@/lib/accuracy-dashboard-data';
import { HitRateCards } from '@/components/accuracy/HitRateCards';
import { SliceTable } from '@/components/accuracy/SliceTable';
import { CalibrationTimeline } from '@/components/accuracy/CalibrationTimeline';
import { InstitutionalNav } from '@/components/institutional/InstitutionalNav';
import { LiveBacktest, formatRunDate, typicalMiss } from '@/components/accuracy/LiveBacktest';
import type { BacktestSummary } from '@/lib/backtest/terms-backtest-core';
import liveBacktestJson from '@/data/backtest/terms-backtest-baseline.json';

/** Live-deal backtest summary (scripts/terms-backtest.ts; refreshed monthly by backtest-monthly.yml). */
const live = liveBacktestJson as unknown as BacktestSummary;

const BASE_URL = 'https://solidus.ambrosiaventures.co';

/**
 * Metadata reads the live-deal backtest so the description never drifts from the numbers rendered on the page.
 */
export function generateMetadata(): Metadata {
  const n = live.overall.n.toLocaleString();
  const within = Math.round(live.overall.within2x * 100);
  const description =
    `How accurate is the Solidus deal-terms calculator? Backtest on ${n} verified, primary-sourced licensing deals: ${within}% priced within 2x of the upfront actually paid, with the breakdown by stage and territory and the method in full.`;
  const short = `${within}% of ${n} real licensing deals priced within 2x of the upfront paid, published in full.`;
  return {
    title: 'Benchmark Accuracy | Solidus',
    description,
    keywords: [
      'pharma deal benchmark range',
      'biotech licensing directional tool',
      'deal comparable transparency',
      'backtest range coverage',
    ],
    alternates: { canonical: `${BASE_URL}/accuracy` },
    openGraph: {
      title: 'Benchmark Accuracy | Solidus',
      description: short,
      type: 'website',
      url: `${BASE_URL}/accuracy`,
      siteName: 'Solidus',
      images: [
        {
          url: `/api/og?title=Benchmark%20Accuracy&subtitle=${encodeURIComponent(`Backtest on ${n} verified licensing deals`)}`,
          width: 1200,
          height: 630,
          alt: 'Solidus accuracy dashboard',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Benchmark Accuracy | Solidus',
      description: short,
    },
    // Internal-only: page is accessible via direct URL but not indexed
    // and not linked from any public navigation surface.
    robots: { index: false, follow: false, nocache: true },
  };
}

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

/** "k / n" for a raw hit count, or a dash when the scope has no per-case rows. */
function kOverN(raw: BucketSummary['raw'], key: 'hit25' | 'hit35' | 'hit50'): string {
  return raw ? `${raw[key]} / ${raw.n}` : '—';
}

function RawCounts({ bucket }: { bucket: BucketSummary }) {
  return (
    <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
      {(['hit25', 'hit35', 'hit50'] as const).map((key) => (
        <div key={key}>
          Raw {key === 'hit25' ? '±25%' : key === 'hit35' ? '±35%' : '±50%'} hits (unweighted):{' '}
          <span className="font-mono text-slate-300">{kOverN(bucket.raw, key)}</span>
          {bucket.raw && (
            <span className="text-slate-600"> = {pct(bucket.raw[key] / bucket.raw.n)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AccuracyDashboard() {
  const data = loadAccuracyData();
  const o = live.overall;

  const datasetLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Solidus deal-terms calculator backtest',
    description: `Calculator upfront vs upfront actually paid on ${o.n} verified, primary-sourced biopharma licensing deals announced ${live.window.from} to ${live.window.to}.`,
    url: `${BASE_URL}/accuracy`,
    dateModified: live.generatedAt,
    temporalCoverage: `${live.window.from}/${live.window.to}`,
    creator: { '@type': 'Organization', name: 'Ambrosia Ventures', url: 'https://ambrosiaventures.co' },
    variableMeasured: ['Share of deals within 2x of the upfront paid', 'Typical miss (median absolute log error)'],
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetLd) }} />
      <InstitutionalNav activePath="/accuracy" />
      {/* Hero */}
      <section className="border-b border-slate-800/60 bg-gradient-to-b from-slate-900/50 to-slate-950">
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-16">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
            Benchmark Accuracy, Published in Full
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-400">
            Solidus is a directional tool for BD professionals: it shows where a deal sits among real comparable
            transactions, not a prediction of one dollar amount. This page shows how close the calculator gets on{' '}
            <span className="text-slate-200">{o.n} real licensing deals</span>: today it prices{' '}
            <span className="text-slate-200">{Math.round(o.within2x * 100)}%</span> of them within 2&times; of the
            upfront actually paid, with a typical miss of {typicalMiss(o).toFixed(1)}&times;.
          </p>
          <div className="mt-6 inline-flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-slate-200">
            <span>
              Backtest run{' '}
              <span className="font-mono text-amber-200">{formatRunDate(live.generatedAt)}</span>
            </span>
            <span className="text-slate-500">·</span>
            <span>
              Deal snapshot{' '}
              <span className="font-mono text-amber-200">{formatRunDate(live.fixtureSnapshotAt)}</span>
            </span>
            <span className="text-slate-500">·</span>
            <span>Refreshed monthly, each refresh reviewed</span>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#live-backtest" className="rounded-full bg-teal-500/15 px-5 py-2 text-sm font-medium text-teal-200 ring-1 ring-teal-500/40 hover:bg-teal-500/25">
              See the results
            </a>
            <a href="#method" className="rounded-full px-5 py-2 text-sm font-medium text-slate-300 ring-1 ring-slate-700 hover:bg-slate-800/60">
              Read the method
            </a>
          </div>
        </div>
      </section>

      <LiveBacktest summary={live} />

      {data && <ArchivedStaticBacktest data={data} />}
    </main>
  );
}

/**
 * The April 2026 static-corpus backtest (scripts/run-deal-backtest.ts over data/comparable-deals-supabase.ts). Kept
 * for the record, collapsed and labelled as superseded: only 78 of that corpus's 541 database rows pass today's
 * deal-quality filter, so its numbers are not current.
 */
function ArchivedStaticBacktest({ data }: { data: NonNullable<ReturnType<typeof loadAccuracyData>> }) {
  const activeFlags = Object.entries(data.featureFlags)
    .filter(([, v]) => v)
    .map(([k]) => k);

  return (
    <details className="group border-b border-slate-800/60">
      <summary className="mx-auto flex max-w-6xl cursor-pointer list-none flex-wrap items-center gap-3 px-6 py-8">
        <span className="rounded-full px-4 py-1.5 text-sm font-medium text-slate-300 ring-1 ring-slate-700 group-open:bg-slate-800/60">
          Archive
        </span>
        <span className="text-base text-slate-300">
          Earlier static-corpus backtest (run {formatDate(data.runAt)}), superseded
        </span>
      </summary>
      <div className="mx-auto max-w-6xl px-6 pb-4">
        <p className="max-w-3xl rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-slate-300">
          These figures come from a fixed corpus assembled in April 2026. Most of its database rows have since been
          removed from our counts as duplicates, unverified or without a primary source (only 78 of 541 still pass),
          so they are not a current measure of accuracy. The live-deal backtest above replaces them. Engine
          v{data.engineVersion}; recency-weighted with a {data.recencyHalfLifeYears}-year half-life
          {activeFlags.length > 0 ? <>; active features: {activeFlags.join(', ')}</> : null}.
        </p>
      </div>
      {/* Engine-range coverage — computed from per-case backtest rows */}
      <section className="border-b border-slate-800/60 bg-teal-500/5">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-100">
              Engine-range coverage — how often the actual deal lands inside our range
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              For every backtested deal we rebuild the range the engine would have displayed
              &mdash; predicted median &times; (1 &plusmn; the phase range width from the
              benchmark tables, e.g. &plusmn;35% at Phase 2, &plusmn;25% at Phase 3) &mdash; and
              check whether the disclosed upfront fell inside it. Counts are unweighted;
              the weighted column applies the same recency weighting as the hit rates.
            </p>
            <p className="mt-2 max-w-3xl text-xs text-slate-500">
              What this does <span className="text-slate-300">not</span> measure: the
              comparable-derived p25&ndash;p75 band shown on the results page. The backtest
              does not record that band per deal, so we make no coverage claim for it here.
            </p>
          </div>
          {data.bandCoverage.length === 0 ? (
            <p className="text-sm text-slate-500">
              Per-case rows are not present in the current backtest file; coverage will appear on the next run.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-normal">Scope</th>
                    <th className="px-4 py-3 text-right font-normal">Mean band</th>
                    <th className="px-4 py-3 text-right font-normal">Inside / n</th>
                    <th className="px-4 py-3 text-right font-normal">Coverage</th>
                    <th className="px-4 py-3 text-right font-normal">Recency-weighted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {data.bandCoverage.map((b, i) => (
                    <tr key={b.label} className={i < 2 ? 'text-slate-100' : 'text-slate-400'}>
                      <td className="px-4 py-3">{b.label}</td>
                      <td className="px-4 py-3 text-right font-mono">&plusmn;{Math.round(b.meanHalfWidth * 100)}%</td>
                      <td className="px-4 py-3 text-right font-mono">{b.covered} / {b.n}</td>
                      <td className={`px-4 py-3 text-right font-mono ${i < 2 ? 'text-teal-200 font-semibold' : ''}`}>{pct(b.coverage)}</td>
                      <td className="px-4 py-3 text-right font-mono">{pct(b.weightedCoverage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-teal-500/40 bg-teal-500/10 p-4">
              <div className="text-[10px] uppercase tracking-wider text-teal-300 font-semibold">
                Median signed error (core, model view)
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
                Core &plusmn;50% hit rate (recency-weighted)
              </div>
              <div className="mt-2 font-mono text-3xl font-bold text-cyan-200">
                {pct(data.coreScope.hit50)}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                raw {kOverN(data.coreScope.raw, 'hit50')} of core-scope deals within &plusmn;50% of the disclosed upfront
              </div>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-[11px] text-slate-500 leading-relaxed">
            Point-estimate hit rates (&plusmn;25% / &plusmn;35% / &plusmn;50% of the engine&rsquo;s
            median) are reported below for transparency. They&rsquo;re the measurement we use to
            tune per-regime calibration internally.
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
              cohort. These hit-rate numbers are the primary calibration target. Rates are
              recency-weighted; raw counts follow.
            </p>
          </div>
          <HitRateCards bucket={data.coreScope} targets={TARGETS} />
          <RawCounts bucket={data.coreScope} />
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
                Rounds 1-12 were tuned on the full corpus. From Round 13 (April 2026) we split
                core scope 80/20 by a deterministic hash on deal id and report the 20% separately.
                Because the test deals were in the corpus when the earlier floors and dampeners
                were set, this is a partial generalization check, not a clean out-of-sample
                validation; a temporal split is the next step.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-5">
                <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">Train (80%, tuned) — weighted</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">±25%</span><span className="font-mono text-slate-200">{pct(data.holdout.train.hit25)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">±35%</span><span className="font-mono text-slate-200">{pct(data.holdout.train.hit35)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">±50%</span><span className="font-mono text-slate-200">{pct(data.holdout.train.hit50)}</span></div>
                  <div className="flex justify-between border-t border-slate-800 pt-1.5"><span className="text-slate-500">n</span><span className="font-mono text-slate-400">{data.holdout.train.n}</span></div>
                </div>
              </div>

              <div className="rounded-lg border border-teal-500/30 bg-teal-500/5 p-5">
                <div className="mb-2 text-xs uppercase tracking-wider text-teal-400">Test (20%, held out since R13) — weighted</div>
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
                      Test set (20%, held out since R13)
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
              <div className="text-xs text-slate-500">±25% (recency-weighted)</div>
              <div className="mt-1 font-mono text-xl text-slate-200">{pct(data.fullScope.hit25)}</div>
              <div className="mt-1 text-[11px] text-slate-500">raw {kOverN(data.fullScope.raw, 'hit25')}</div>
            </div>
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-4">
              <div className="text-xs text-slate-500">±35% (recency-weighted)</div>
              <div className="mt-1 font-mono text-xl text-slate-200">{pct(data.fullScope.hit35)}</div>
              <div className="mt-1 text-[11px] text-slate-500">raw {kOverN(data.fullScope.raw, 'hit35')}</div>
            </div>
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-4">
              <div className="text-xs text-slate-500">±50% (recency-weighted)</div>
              <div className="mt-1 font-mono text-xl text-slate-200">{pct(data.fullScope.hit50)}</div>
              <div className="mt-1 text-[11px] text-slate-500">raw {kOverN(data.fullScope.raw, 'hit50')}</div>
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
            <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-teal-400 text-xs font-bold">i</div>
            <div>
              <h2 className="text-xl font-semibold text-slate-100">The validation baseline</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                In April 2026 the backtest corpus was widened from 251 hand-curated deals to{' '}
                {data.fullScope.n.toLocaleString()} deals drawn from the production table, with 500+
                duplicate entries removed, and oncology coverage grew from 21 deals to 188. Hit rates on
                the wider corpus are lower than on the curated sample, as expected when a sample is
                broadened, and they are the numbers every calibration round is measured against.
              </p>
              <p className="mt-3 max-w-3xl text-sm text-slate-400">
                <span className="text-slate-200 font-medium">The standard:</span>{' '}
                a change ships only if it holds or improves accuracy on this corpus and cites a source.
                Rounds that do not clear that bar are reverted and recorded below.
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
                TA-level accuracy shows where modality and indication coverage is deepest
                (oncology, immunology) and where corpus depth is still building (rare
                disease, neurology).
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
              Every round of empirical tuning, including the rounds that did not move hit
              rates and were reverted. Regressions are recorded alongside the wins, with the
              source each change cites.
            </p>
          </div>
          <CalibrationTimeline rounds={data.calibrationRounds} />
        </div>
      </section>

      {/* Worst misses */}
      <section className="border-b border-slate-800/60">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="mb-6 text-2xl font-semibold text-slate-100">Largest errors</h2>
          <p className="mb-6 max-w-3xl text-sm text-slate-400">
            The 10 largest signed errors in core scope. They map the deal archetypes that price
            on factors outside an intrinsic-value frame (strategic premiums, option structures,
            small ex-US deals), which is where the comparable list, not the engine&rsquo;s point,
            is the reference.
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
              The corpus is {data.fullScope.n.toLocaleString()} deals with a disclosed upfront.{' '}
              {data.corpus.curated.toLocaleString()} are hand-curated cases with terms checked
              against the 8-K, HSR filing or press release; {data.corpus.fromDatabase.toLocaleString()} are
              rows pulled from the production deals table, each with a source URL but not all
              individually re-verified. The engine is fed the deal&rsquo;s tagged stage, modality,
              therapeutic area, indication and territory, and computes an implied upfront with
              the current benchmark and calibration tables, not the tables as they stood at
              deal date.
            </p>
            <p>
              <span className="text-slate-200">Hit rate</span> is the recency-weighted share
              of deals where the absolute error on upfront falls within the stated tolerance
              band (each deal weighted by 0.5^(years ago / {data.recencyHalfLifeYears}), so
              a deal from 24 months ago counts {data.recencyWeightAt24Months.toFixed(2)}× a
              current-year deal). Unweighted k / n counts are shown wherever per-case rows
              exist; the held-out split is reported weighted only.{' '}
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
              Those segments are anchored on the comparable set and reported under full
              scope; they are not part of core-scope accuracy.
            </p>
            <p>
              Calibration follows an <span className="text-slate-200">Option B rigor</span>{' '}
              standard: every change must improve or maintain backtest accuracy against the
              held-out corpus and cite a specific source (FDA CDER, Wong/Siah/Lo 2019, Nature
              Reviews Drug Discovery, company 10-K, or the backtest itself as empirical
              source). Rounds that do not clear that bar are reverted and recorded in the
              calibration journey above.
            </p>
          </div>
        </div>
      </section>

    </details>
  );
}
