import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ token: string }>;
}

import { DEAL_STATS } from '@/lib/config/constants';
import { buildMethodStatement, METHOD_COPY, type ShareFinancialSummary } from '@/lib/financial/method-copy';

interface Range { low: number; median: number; high: number }

interface SharedCalc {
  inputs: Record<string, unknown>;
  results: {
    /** Comparable-transaction deal terms from the calculator engine: the primary range. */
    terms?: {
      upfront?: Range;
      totalDealValue?: Range;
      devMilestones?: Range;
      regMilestones?: Range;
      commMilestones?: Range;
    };
    /** Drill-down carries the baseline provenance, including the number of disclosed transactions behind the range. */
    drillDown?: { totalDealValue?: { baseline?: { sampleSize?: number | null } } };
    /** Blended fair value, rNPV inputs and Monte Carlo context saved with the share. */
    financialSummary?: ShareFinancialSummary | null;
    riskDecomposition?: {
      clinical: { impact_M: number; percentOfTotal: number };
      commercial: { impact_M: number; percentOfTotal: number };
      manufacturing: { impact_M: number; percentOfTotal: number };
      regulatory: { impact_M: number; percentOfTotal: number };
      other: { impact_M: number; percentOfTotal: number };
    };
  };
  labels: { modality?: string; indication?: string; phase?: string } | null;
  createdAt: string;
}

async function loadCalculation(token: string): Promise<SharedCalc | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://solidus.ambrosiaventures.co';
    const response = await fetch(`${baseUrl}/api/share/${token}`, { cache: 'no-store' });
    if (!response.ok) return null;
    const json = await response.json();
    return json.data ?? json;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://solidus.ambrosiaventures.co';
  const data = await loadCalculation(token);
  const labels = data?.labels;
  const title = labels
    ? `${labels.modality || 'Asset'} · ${labels.indication || ''} · ${labels.phase || ''} — Brief | Ambrosia`
    : 'Deal Brief | Solidus';
  return {
    title,
    description: 'Sixty-second mobile brief — fair value range, key risks, recommended next move.',
    alternates: { canonical: `${baseUrl}/brief/${token}` },
    openGraph: {
      title,
      description: 'Sixty-second mobile brief — fair value range, key risks, recommended next move.',
      type: 'website',
      url: `${baseUrl}/brief/${token}`,
      images: [
        { url: `${baseUrl}/api/og/share/${token}`, width: 1200, height: 630, alt: title },
      ],
    },
    twitter: { card: 'summary_large_image', title },
    robots: { index: false, follow: false },
  };
}

function fmtMoney(usdM: number): string {
  if (usdM >= 1000) return `$${(usdM / 1000).toFixed(1)}B`;
  return `$${Math.round(usdM)}M`;
}

const isPositive = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;
const isRange = (r: Range | undefined): r is Range =>
  !!r && isPositive(r.median) && Number.isFinite(r.low) && Number.isFinite(r.high) && r.low >= 0;

export default async function BriefPage({ params }: Props) {
  const { token } = await params;
  const data = await loadCalculation(token);
  if (!data) notFound();

  const { results, labels } = data;
  const summary = results.financialSummary ?? null;
  const ensemble = summary?.ensemble && isPositive(summary.ensemble.valueM) ? summary.ensemble : null;

  // Primary range: what buyers paid for comparable assets. The blended fair
  // value, when present, is the headline; the rNPV is shown as one method.
  const totalDeal = isRange(results.terms?.totalDealValue) ? results.terms!.totalDealValue! : null;
  const upfront = isRange(results.terms?.upfront) ? results.terms!.upfront! : null;
  const headlineValue = ensemble ? ensemble.valueM : totalDeal ? totalDeal.median : null;
  const headlineLabel = ensemble ? 'Blended fair value' : 'Fair total deal value';

  const decomp = results.riskDecomposition;
  const dominantRisk = decomp
    ? (Object.entries({
        Clinical: decomp.clinical?.percentOfTotal ?? 0,
        Commercial: decomp.commercial?.percentOfTotal ?? 0,
        Manufacturing: decomp.manufacturing?.percentOfTotal ?? 0,
        Regulatory: decomp.regulatory?.percentOfTotal ?? 0,
      }).sort((a, b) => b[1] - a[1])[0])
    : null;

  const headline = labels
    ? `${labels.modality || 'Asset'} · ${labels.indication || '—'}`
    : 'Deal Brief';
  const phaseLabel = labels?.phase || '';

  // Facts that drive the number: a row is rendered only when its value exists.
  const facts: Array<{ label: string; value: string }> = [];
  if (summary && Number.isFinite(summary.cumulativePoS)) facts.push({ label: 'Probability of approval', value: `${(summary.cumulativePoS * 100).toFixed(0)}%` });
  if (isPositive(summary?.yearsToMarket)) facts.push({ label: 'Years to market', value: `${summary!.yearsToMarket!.toFixed(1)}y` });
  if (isPositive(summary?.discountRate)) facts.push({ label: 'Discount rate', value: `${(summary!.discountRate! * 100).toFixed(0)}%` });
  if (isPositive(summary?.peakSalesMedianM)) facts.push({ label: 'Projected peak sales / yr', value: fmtMoney(summary!.peakSalesMedianM!) });
  if (isPositive(summary?.riskAdjustedNPV)) facts.push({ label: 'Risk-adjusted NPV', value: fmtMoney(summary!.riskAdjustedNPV) });
  const sampleSize = results.drillDown?.totalDealValue?.baseline?.sampleSize ?? null;
  if (isPositive(sampleSize)) facts.push({ label: 'Comparable transactions', value: String(sampleSize) });
  const rnpvBelowZero = !!summary && Number.isFinite(summary.riskAdjustedNPV) && summary.riskAdjustedNPV <= 0;

  const methodLines = buildMethodStatement({ summary, benchmarkSampleSize: sampleSize, phaseLabel });

  // Build LinkedIn-shareable insight card URL via /api/og/insight
  const insightParams = new URLSearchParams();
  insightParams.set('headline', `${labels?.modality ? labels.modality + ' ' : ''}${labels?.indication || 'Deal'} — fair value benchmark`);
  if (totalDeal) {
    insightParams.set('label', 'Fair Total Deal Value');
    insightParams.set('primary', `${fmtMoney(totalDeal.low)} – ${fmtMoney(totalDeal.high)}`);
  }
  if (upfront) {
    insightParams.set('secondary', `Upfront median ${fmtMoney(upfront.median)} · benchmarked across ${DEAL_STATS.TOTAL_DEALS} disclosed deals`);
  }
  if (labels) {
    const attrParts = [labels.phase, labels.indication, labels.modality].filter(Boolean);
    if (attrParts.length > 0) {
      insightParams.set('attribution', attrParts.join(' • '));
    }
  }
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://solidus.ambrosiaventures.co';
  const insightCardUrl = `${baseUrl}/api/og/insight?${insightParams.toString()}`;
  const linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${baseUrl}/brief/${token}`)}`;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Mobile-first hero — readable on phone in 5 seconds */}
      <section className="border-b border-slate-800/60 px-5 py-8">
        <div className="mx-auto max-w-2xl">
          <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Deal Brief</p>
          <h1 className="text-2xl font-semibold text-slate-50 sm:text-3xl">{headline}</h1>
          {phaseLabel && (
            <p className="mt-1 text-sm text-slate-400 capitalize">{phaseLabel.replace(/_/g, ' ')}</p>
          )}
        </div>
      </section>

      {/* Big number — blended fair value, with the comparable-transaction range beneath it */}
      <section className="border-b border-slate-800/60 bg-gradient-to-b from-slate-900/40 to-slate-950 px-5 py-10">
        <div className="mx-auto max-w-2xl">
          {headlineValue !== null ? (
            <>
              <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">{headlineLabel}</p>
              <div className="font-mono text-5xl font-semibold text-teal-300 sm:text-6xl">
                {fmtMoney(headlineValue)}
              </div>
              {ensemble && isPositive(ensemble.stdDevM) && (
                <p className="mt-2 font-mono text-sm text-slate-400">± {fmtMoney(ensemble.stdDevM)} standard error</p>
              )}
            </>
          ) : (
            <p className="text-slate-500">This brief has no valuation attached. Open the full analysis below.</p>
          )}

          {totalDeal && (
            <div className="mt-6 rounded-lg border border-slate-700/50 bg-slate-900/30 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Comparable-transaction range, total deal value
              </p>
              <p className="mt-1 font-mono text-2xl text-slate-100">
                {fmtMoney(totalDeal.low)} – {fmtMoney(totalDeal.high)}
              </p>
              <p className="font-mono text-xs text-slate-500">Median {fmtMoney(totalDeal.median)}</p>
            </div>
          )}

          {upfront && (
            <div className="mt-3 rounded-lg border border-slate-700/50 bg-slate-900/30 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Upfront</p>
              <p className="mt-1 font-mono text-2xl text-slate-100">{fmtMoney(upfront.median)}</p>
              <p className="font-mono text-xs text-slate-500">Range: {fmtMoney(upfront.low)} – {fmtMoney(upfront.high)}</p>
            </div>
          )}

          {ensemble && (
            <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[...ensemble.methods].sort((a, b) => b.weight - a.weight).map(m => (
                <div key={m.name} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">{m.name === 'rNPV' ? 'Risk-adjusted NPV' : m.name}</p>
                  <p className="mt-1 font-mono text-lg text-slate-100">{isPositive(m.valueM) ? fmtMoney(m.valueM) : 'Below zero'}</p>
                  <p className="text-xs text-slate-500">{Math.round(m.weight * 100)}% of the blend{m.name === 'Comparable Transactions' && m.sampleSize ? ` · ${m.sampleSize} deals` : ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* What drives this number: only rows with a value */}
      {(facts.length > 0 || rnpvBelowZero) && (
        <section className="border-b border-slate-800/60 px-5 py-8">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
              What drives this number
            </h2>
            <dl className="space-y-3">
              {facts.map(f => (
                <div key={f.label} className="flex items-baseline justify-between gap-4 border-b border-slate-800/60 pb-3">
                  <dt className="text-sm text-slate-400">{f.label}</dt>
                  <dd className="font-mono text-lg text-slate-100">{f.value}</dd>
                </div>
              ))}
            </dl>
            {rnpvBelowZero && (
              <p className="mt-4 text-sm text-slate-400">
                The risk-adjusted NPV is below zero at this stage. That is normal before Phase 2 and is why the range above is set by comparable transactions rather than projected cash flows.
              </p>
            )}
          </div>
        </section>
      )}

      {/* How this number was produced */}
      <section className="border-b border-slate-800/60 px-5 py-8">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">{METHOD_COPY.heading}</h2>
          <dl className="space-y-4">
            {methodLines.map(line => (
              <div key={line.label}>
                <dt className="text-xs font-semibold text-slate-300">{line.label}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-slate-400">{line.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Dominant risk */}
      {dominantRisk && dominantRisk[1] > 0 && (
        <section className="border-b border-slate-800/60 bg-amber-500/5 px-5 py-7">
          <div className="mx-auto max-w-2xl">
            <p className="text-xs uppercase tracking-wider text-amber-400">Biggest risk source</p>
            <p className="mt-2 text-lg text-slate-100">
              <span className="font-semibold">{dominantRisk[0]}</span>
              {' '}drives{' '}
              <span className="font-mono">{(dominantRisk[1] * 100).toFixed(0)}%</span>
              {' '}of the value erosion vs. unadjusted NPV.
            </p>
          </div>
        </section>
      )}

      {/* Shareable LinkedIn insight card preview */}
      <section className="border-t border-slate-800/60 px-5 py-8">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Share on LinkedIn
          </h2>
          <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={insightCardUrl}
              alt="LinkedIn insight card preview"
              className="w-full"
            />
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <a
              href={linkedInShareUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="flex-1 rounded-lg bg-[#0A66C2] px-4 py-2.5 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Post to LinkedIn →
            </a>
            <a
              href={insightCardUrl}
              target="_blank"
              rel="noreferrer noopener"
              download
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-center text-sm text-slate-200 transition-colors hover:bg-slate-900"
            >
              Download card
            </a>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            1200×630 branded image. LinkedIn auto-picks up via OG tags when you post the /brief link, or attach this image directly.
          </p>
        </div>
      </section>

      {/* CTAs — three clear next moves */}
      <section className="px-5 py-8">
        <div className="mx-auto max-w-2xl space-y-3">
          <Link
            href={`/share/${token}`}
            className="block rounded-lg bg-teal-500 px-5 py-3.5 text-center text-sm font-semibold text-slate-950 transition-colors hover:bg-teal-400"
          >
            See full analysis
          </Link>
          <Link
            href="/playbook"
            className="block rounded-lg border border-slate-700 bg-slate-900/40 px-5 py-3.5 text-center text-sm text-slate-200 transition-colors hover:bg-slate-900"
          >
            Counterparty playbook — who pays what premium?
          </Link>
          <Link
            href="/simulator"
            className="block rounded-lg border border-slate-700 bg-slate-900/40 px-5 py-3.5 text-center text-sm text-slate-200 transition-colors hover:bg-slate-900"
          >
            Negotiation simulator — where to open
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 px-5 py-6 text-center">
        <p className="text-xs text-slate-500">
          Generated by{' '}
          <Link href="/" className="text-cyan-400 hover:text-cyan-300">Solidus</Link>{' '}
          · {new Date(data.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </footer>
    </main>
  );
}
