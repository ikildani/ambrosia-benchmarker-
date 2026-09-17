/**
 * /radar/methodology — how the licensing-intent score is built and how it
 * performed out of sample. Server component: reads the active model and the
 * latest backtest through the service client (the tables are service-role
 * only) and renders plain, specific copy. Signed-in users see the summary;
 * anonymous visitors see a sign-in notice. The pre-launch 404 gate lives in
 * app/radar/layout.tsx.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { loadMethodologySummary, type MethodologySummary } from '@/lib/radar/backtest/run';
import { FACTOR_WEIGHTS } from '@/lib/radar/signal-detection';
import { CalibrationChart } from './CalibrationChart';

const BASE_URL = 'https://solidus.ambrosiaventures.co';

export const metadata: Metadata = {
  title: 'Licensing Intent Score Methodology | Asset Radar | Solidus',
  description:
    'What the Asset Radar licensing-intent score predicts, the features and data sources behind it, and its out-of-sample backtest: ROC-AUC, precision at 50 and 100, lift, Brier score and calibration.',
  alternates: { canonical: `${BASE_URL}/radar/methodology` },
  openGraph: {
    title: 'Licensing Intent Score Methodology | Solidus',
    description: 'Features, label definition and out-of-sample backtest for the Asset Radar licensing-intent score.',
    type: 'article',
    url: `${BASE_URL}/radar/methodology`,
    siteName: 'Solidus',
  },
  // Mirrors app/radar/layout.tsx: no indexing before launch.
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

// ── Formatting ──────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function fmtMonth(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function pct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}

function num(v: number | null | undefined, digits = 3): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toFixed(digits);
}

function signLabel(sign: -1 | 0 | 1): string {
  return sign === 1 ? 'Raises' : sign === -1 ? 'Lowers' : 'Learned';
}

// ── Layout pieces ────────────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-neutral-200 dark:border-slate-700/60 pt-8 mt-8 first:border-t-0 first:pt-0 first:mt-0">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-slate-400 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-slate-700/60 bg-neutral-50 dark:bg-slate-800/40 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 font-mono text-xl text-neutral-900 dark:text-slate-100">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-neutral-500 dark:text-slate-400">{sub}</div> : null}
    </div>
  );
}

function SignInNotice() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">Licensing intent score methodology</h1>
      <p className="mt-3 text-sm text-neutral-600 dark:text-slate-300">
        The methodology, feature list and backtest scorecard are available to signed-in users.
      </p>
      <Link href="/radar" className="inline-block mt-6 text-sm font-medium text-neutral-900 dark:text-slate-100 underline underline-offset-4">
        Go to Asset Radar to sign in
      </Link>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default async function RadarMethodologyPage() {
  const auth = await resolveUserTier();
  if (!auth.isAuthenticated) {
    return <main className="min-h-screen bg-white dark:bg-slate-950"><SignInNotice /></main>;
  }

  let summary: MethodologySummary | null = null;
  let loadError: string | null = null;
  try {
    summary = await loadMethodologySummary(createServiceClient(), { includeParams: false });
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  const model = summary?.model ?? null;
  const bt = summary?.backtest ?? null;
  const features = summary?.features ?? [];
  const topImportance = [...features].filter(f => f.importance !== null).sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0)).slice(0, 12);
  const maxImportance = topImportance[0]?.importance ?? 0;
  const v2Weights = Object.entries(FACTOR_WEIGHTS).sort((a, b) => b[1] - a[1]);

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 text-neutral-800 dark:text-slate-200">
      <div className="border-b border-neutral-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between text-xs">
          <Link href="/radar" className="text-neutral-500 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-slate-100">
            Asset Radar
          </Link>
          <span className="text-neutral-400 dark:text-slate-500">Methodology</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <header className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 dark:text-slate-100">Licensing intent score</h1>
          <p className="mt-3 text-sm sm:text-base text-neutral-600 dark:text-slate-300 leading-relaxed max-w-3xl">
            The score is the estimated probability, expressed 0 to 100, that an unpartnered clinical asset is licensed,
            optioned, acquired or brought into a co-development agreement within the next 12 months. It is a statistical
            model fitted to the Solidus deals record and evaluated on a later period it never saw. This page shows what goes
            in, what came out, and where it is weak.
          </p>
          <dl className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-xs">
            <div><dt className="text-neutral-500 dark:text-slate-400">Model version</dt><dd className="font-mono text-neutral-900 dark:text-slate-100">{model?.version ?? 'v2-composite (fallback)'}</dd></div>
            <div><dt className="text-neutral-500 dark:text-slate-400">Trained</dt><dd className="font-mono text-neutral-900 dark:text-slate-100">{model ? fmtDate(model.trained_at) : '—'}</dd></div>
            <div><dt className="text-neutral-500 dark:text-slate-400">Feature set</dt><dd className="font-mono text-neutral-900 dark:text-slate-100">{summary?.feature_version ?? '—'}</dd></div>
            <div><dt className="text-neutral-500 dark:text-slate-400">Last backtest</dt><dd className="font-mono text-neutral-900 dark:text-slate-100">{bt ? fmtDate(bt.run_at) : '—'}</dd></div>
          </dl>
        </header>

        {loadError ? (
          <div className="mb-8 rounded-lg border border-neutral-200 dark:border-slate-700/60 bg-neutral-50 dark:bg-slate-800/40 px-4 py-3 text-sm text-neutral-600 dark:text-slate-300">
            The model tables could not be read ({loadError}). The score currently uses the weighted composite described under Fallback.
          </div>
        ) : null}

        <Section id="predicts" title="What the score predicts">
          <div className="text-sm text-neutral-600 dark:text-slate-300 leading-relaxed space-y-3 max-w-3xl">
            <p>
              For each asset the model produces a probability. The displayed score is that probability multiplied by 100 and
              by an availability factor: 1.0 for unpartnered assets, the share of global value still unlicensed for partially
              partnered assets, and 0.1 for fully partnered assets, whose remaining probability refers to rights that are not
              on the market.
            </p>
            <p>
              A score of 20 means roughly one in five assets with this evidence profile went on to a qualifying deal within a
              year in the historical record. The calibration chart below shows how closely that held in the holdout period.
              The score does not say whether a deal would be attractive, what it would cost, or whether the owner has already
              started a process; it summarises public evidence of pressure, intent, and timing.
            </p>
            <p>
              Confidence, shown next to the score, is the share of the model&apos;s inputs for which a dated source was found.
              Missing inputs are set to the training average and contribute nothing, so a low-confidence score is a score
              built mostly on priors.
            </p>
          </div>
        </Section>

        <Section id="scorecard" title="Backtest scorecard">
          {bt ? (
            <>
              <p className="text-sm text-neutral-600 dark:text-slate-300 mb-4 max-w-3xl">
                Trained on monthly snapshots from {fmtMonth(bt.train_window.from)} to {fmtMonth(bt.train_window.to)} ({bt.n_train.toLocaleString()} asset-months),
                evaluated on {fmtMonth(bt.test_window.from)} to {fmtMonth(bt.test_window.to)} ({bt.n_test.toLocaleString()} asset-months, {bt.positives_test} with a qualifying deal).
                Negative assets were subsampled at {pct(summary?.label.negative_sampling_rate, 0)} when building snapshots; every metric below is weighted back to the full universe.
              </p>
              {bt.low_power ? (
                <div className="mb-4 rounded-lg border border-neutral-300 dark:border-slate-600 px-4 py-3 text-sm text-neutral-700 dark:text-slate-200">
                  Low statistical power: the holdout contains {bt.positives_test} qualifying deals, fewer than the 30 needed for a stable ranking estimate.
                  Treat the numbers as indicative. They are reported as computed, not adjusted.
                </div>
              ) : null}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Tile label="ROC-AUC" value={num(bt.roc_auc)} sub="0.5 = random" />
                <Tile label="PR-AUC" value={num(bt.pr_auc)} sub="vs base rate" />
                <Tile label="Precision @50" value={pct(bt.precision_at_50)} sub="top 50 assets" />
                <Tile label="Precision @100" value={pct(bt.precision_at_100)} sub="top 100 assets" />
                <Tile label="Lift, top decile" value={`${num(bt.lift_top_decile, 2)}×`} sub="vs base rate" />
                <Tile label="Brier" value={num(bt.brier, 4)} sub="lower is better" />
              </div>
              {bt.notes ? <p className="mt-3 text-xs text-neutral-500 dark:text-slate-400 leading-relaxed">{bt.notes}</p> : null}
            </>
          ) : (
            <p className="text-sm text-neutral-600 dark:text-slate-300 max-w-3xl">
              No backtest has been run yet. Until one completes and a model is activated, the score is the weighted
              composite described under Fallback, which has not been validated against outcomes.
            </p>
          )}
        </Section>

        {bt ? (
          <Section id="calibration" title="Calibration and factor importance">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <p className="text-sm text-neutral-600 dark:text-slate-300 mb-3">
                  Predicted probability against the observed licensing rate in the holdout, by decile of prediction. Points on the
                  dashed line are perfectly calibrated.
                </p>
                <div className="text-neutral-700 dark:text-slate-300">
                  <CalibrationChart bins={bt.calibration_bins} />
                </div>
                <details className="mt-2">
                  <summary className="text-xs text-neutral-500 dark:text-slate-400 cursor-pointer">Table view</summary>
                  <div className="overflow-x-auto mt-2">
                    <table className="w-full text-xs">
                      <thead className="text-neutral-500 dark:text-slate-400">
                        <tr><th className="text-left font-medium py-1">Bin</th><th className="text-right font-medium py-1">Predicted</th><th className="text-right font-medium py-1">Observed</th><th className="text-right font-medium py-1">n</th></tr>
                      </thead>
                      <tbody className="font-mono text-neutral-800 dark:text-slate-200">
                        {bt.calibration_bins.map(b => (
                          <tr key={b.bin} className="border-t border-neutral-100 dark:border-slate-800">
                            <td className="py-1">{b.bin}</td><td className="text-right">{pct(b.predicted)}</td><td className="text-right">{pct(b.observed)}</td><td className="text-right">{b.n.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
              <div>
                <p className="text-sm text-neutral-600 dark:text-slate-300 mb-3">
                  Share of the model&apos;s total movement attributable to each input on the holdout (mean absolute contribution to the log-odds).
                </p>
                <ul className="space-y-1.5">
                  {topImportance.map(f => (
                    <li key={f.name} className="grid grid-cols-[minmax(0,1fr)_56px] items-center gap-3 text-xs">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-neutral-800 dark:text-slate-200 truncate">{f.label}</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded bg-neutral-100 dark:bg-slate-800 overflow-hidden">
                          <div className="h-full rounded bg-amber-600 dark:bg-amber-500" style={{ width: `${maxImportance > 0 ? Math.max(2, ((f.importance ?? 0) / maxImportance) * 100) : 0}%` }} />
                        </div>
                      </div>
                      <span className="font-mono text-right text-neutral-600 dark:text-slate-300">{pct(f.importance)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>
        ) : null}

        <Section id="factors" title="Inputs, data sources and constraints">
          <p className="text-sm text-neutral-600 dark:text-slate-300 mb-4 max-w-3xl">
            Every input is computed only from records dated on or before the snapshot date. Direction is a constraint placed on
            the model before fitting: an input marked &quot;Raises&quot; can only increase the probability as its value rises,
            &quot;Lowers&quot; can only decrease it, and &quot;Learned&quot; was left free because the direction is not known in advance.
            Weight is the fitted coefficient per standard deviation of the input; importance is its share on the holdout.
          </p>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-slate-700/60">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 dark:bg-slate-800/40 text-neutral-500 dark:text-slate-400">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Input</th>
                  <th className="text-left font-medium px-3 py-2">Definition</th>
                  <th className="text-left font-medium px-3 py-2">Sources</th>
                  <th className="text-left font-medium px-3 py-2">Direction</th>
                  <th className="text-right font-medium px-3 py-2">Weight</th>
                  <th className="text-right font-medium px-3 py-2">Importance</th>
                </tr>
              </thead>
              <tbody>
                {features.map(f => (
                  <tr key={f.name} className="border-t border-neutral-100 dark:border-slate-800 align-top">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="text-neutral-900 dark:text-slate-100">{f.label}</div>
                      <div className="font-mono text-[10px] text-neutral-400 dark:text-slate-500">{f.name}</div>
                    </td>
                    <td className="px-3 py-2 text-neutral-600 dark:text-slate-300 min-w-[16rem]">{f.description}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-neutral-500 dark:text-slate-400">{f.sources.join(', ')}</td>
                    <td className="px-3 py-2 text-neutral-700 dark:text-slate-200">{signLabel(f.sign)}</td>
                    <td className="px-3 py-2 text-right font-mono text-neutral-800 dark:text-slate-200">{f.weight === null ? '—' : f.weight.toFixed(3)}</td>
                    <td className="px-3 py-2 text-right font-mono text-neutral-800 dark:text-slate-200">{pct(f.importance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="label" title="Label definition">
          <div className="text-sm text-neutral-600 dark:text-slate-300 leading-relaxed space-y-3 max-w-3xl">
            <p>{summary?.label.definition}</p>
            <p>
              Snapshots are taken on the first of every month from {fmtMonth(summary?.label.snapshot_range.from)} to {fmtMonth(summary?.label.snapshot_range.to)}.
              Rows with a snapshot date up to {fmtMonth(summary?.label.train_to)} are used to fit the coefficients, rows from then to {fmtMonth(summary?.label.calibration_to)} to
              fit the calibration curve, and rows from {fmtMonth(summary?.label.test_from)} onward are the holdout. Nothing from the holdout period touches the fit.
              A snapshot whose 12-month window runs past the newest deal date in the record is dropped rather than counted as a negative.
            </p>
            <p>
              The deals record is the constraint. It holds on the order of 800 canonical licensing deals since 2015, of which roughly a quarter are
              verifier-confirmed, and a deal only becomes a label when both the licensor and the asset name can be matched to an indexed asset.
              Unmatched deals are lost positives; assets whose deals were never captured are false negatives. Both bias the metrics downward.
            </p>
          </div>
        </Section>

        <Section id="limitations" title="Known limitations">
          <ul className="text-sm text-neutral-600 dark:text-slate-300 leading-relaxed space-y-2 max-w-3xl list-disc pl-5">
            <li>Few positives. With a few hundred labelled deals across four years, the holdout typically has tens of positives; ranking metrics move by several points between retrains.</li>
            <li>Regulatory designations and territory rights are not dated in the schema and are used as they stand today, a mild look-ahead for historical snapshots.</li>
            <li>Financial pressure inputs come from SEC filings; private companies and most ex-US listings have no runway, going-concern or ATM data, so those inputs are imputed for them.</li>
            <li>Intent language is classified from filings and press releases attached to the first company mentioned; a release that names several companies is credited to one.</li>
            <li>Phase at the snapshot date is reconstructed from ClinicalTrials.gov posting dates; assets whose only trials sit in ex-US registries fall back to the indexed first-posted date.</li>
            <li>The label counts announced deals, not signed processes. A company that ran a process and did not transact is a negative.</li>
            <li>Negative assets are subsampled when building the training set; the intercept is corrected for this and the scorecard is reweighted, but the calibration curve in the extreme bins rests on few rows.</li>
          </ul>
        </Section>

        <Section id="fallback" title="Fallback when no model is active">
          <p className="text-sm text-neutral-600 dark:text-slate-300 mb-3 max-w-3xl">
            When no trained model is active{summary?.fallback_active ? ' (the current state)' : ''}, the score is the weighted sum of nine
            evidence detectors, scaled by a phase prior that peaks at Phase 2 and by the availability factor. These weights are hand-set and
            have not been validated against outcomes; snapshots written this way carry model version <span className="font-mono">v2-composite</span>.
          </p>
          <div className="flex flex-wrap gap-2">
            {v2Weights.map(([k, w]) => (
              <span key={k} className="rounded border border-neutral-200 dark:border-slate-700/60 px-2 py-1 text-xs font-mono text-neutral-700 dark:text-slate-300">
                {k} {Math.round(w * 100)}%
              </span>
            ))}
          </div>
        </Section>

        {summary?.history.length ? (
          <Section id="history" title="Backtest history">
            <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-slate-700/60">
              <table className="w-full text-xs">
                <thead className="bg-neutral-50 dark:bg-slate-800/40 text-neutral-500 dark:text-slate-400">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Run</th>
                    <th className="text-left font-medium px-3 py-2">Model</th>
                    <th className="text-right font-medium px-3 py-2">Positives</th>
                    <th className="text-right font-medium px-3 py-2">ROC-AUC</th>
                    <th className="text-right font-medium px-3 py-2">PR-AUC</th>
                    <th className="text-right font-medium px-3 py-2">P@50</th>
                    <th className="text-right font-medium px-3 py-2">Brier</th>
                    <th className="text-left font-medium px-3 py-2">Outcome</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-neutral-800 dark:text-slate-200">
                  {summary.history.map(h => (
                    <tr key={`${h.model_version}-${h.run_at}`} className="border-t border-neutral-100 dark:border-slate-800">
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDate(h.run_at)}</td>
                      <td className="px-3 py-2">{h.model_version}</td>
                      <td className="px-3 py-2 text-right">{h.positives_test}</td>
                      <td className="px-3 py-2 text-right">{num(h.roc_auc)}</td>
                      <td className="px-3 py-2 text-right">{num(h.pr_auc)}</td>
                      <td className="px-3 py-2 text-right">{pct(h.precision_at_50)}</td>
                      <td className="px-3 py-2 text-right">{num(h.brier, 4)}</td>
                      <td className="px-3 py-2 font-sans text-neutral-600 dark:text-slate-300">{h.activated ? 'Activated' : 'Not activated'}{h.low_power ? ', low power' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        ) : null}

        <footer className="mt-12 pt-6 border-t border-neutral-200 dark:border-slate-700/60 text-xs text-neutral-500 dark:text-slate-400">
          Generated {summary ? fmtDate(summary.generated_at) : '—'}. Model parameters are available to Pro accounts through the methodology API.
        </footer>
      </div>
    </main>
  );
}
