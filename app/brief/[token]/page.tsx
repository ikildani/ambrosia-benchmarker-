import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ token: string }>;
}

interface SharedCalc {
  inputs: Record<string, unknown>;
  results: {
    riskAdjustedNPV?: number;
    unadjustedNPV?: number;
    cumulativePoS?: number;
    yearsToMarket?: number;
    discountRate?: number;
    impliedDealValue?: {
      upfront?: { low: number; median: number; high: number };
      totalDeal?: { low: number; median: number; high: number };
    };
    peakSales?: { low: number; median: number; high: number };
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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://calculator.ambrosiaventures.co';
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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://calculator.ambrosiaventures.co';
  const data = await loadCalculation(token);
  const labels = data?.labels;
  const title = labels
    ? `${labels.modality || 'Asset'} · ${labels.indication || ''} · ${labels.phase || ''} — Brief | Ambrosia`
    : 'Deal Brief | Ambrosia Benchmarker';
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

function fmtMoney(usdM: number | undefined | null): string {
  if (usdM == null || !Number.isFinite(usdM)) return '—';
  if (usdM >= 1000) return `$${(usdM / 1000).toFixed(1)}B`;
  if (usdM <= -1000) return `-$${(-usdM / 1000).toFixed(1)}B`;
  return `$${Math.round(usdM)}M`;
}

function pct(x: number | undefined | null): string {
  if (x == null || !Number.isFinite(x)) return '—';
  return `${(x * 100).toFixed(0)}%`;
}

function years(x: number | undefined | null): string {
  if (x == null || !Number.isFinite(x)) return '—';
  return `${x.toFixed(1)}y`;
}

export default async function BriefPage({ params }: Props) {
  const { token } = await params;
  const data = await loadCalculation(token);
  if (!data) notFound();

  const { results, labels } = data;
  const totalDeal = results.impliedDealValue?.totalDeal;
  const upfront = results.impliedDealValue?.upfront;
  const decomp = results.riskDecomposition;

  // Dominant risk bucket — the headline reason value erodes
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

      {/* Big number — fair value range */}
      <section className="border-b border-slate-800/60 bg-gradient-to-b from-slate-900/40 to-slate-950 px-5 py-10">
        <div className="mx-auto max-w-2xl">
          <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">Fair total deal value</p>
          {totalDeal ? (
            <>
              <div className="font-mono text-5xl font-semibold text-teal-300 sm:text-6xl">
                {fmtMoney(totalDeal.median)}
              </div>
              <p className="mt-2 font-mono text-sm text-slate-400">
                Range: {fmtMoney(totalDeal.low)} – {fmtMoney(totalDeal.high)}
              </p>
            </>
          ) : (
            <p className="text-slate-500">Total deal value unavailable.</p>
          )}

          {upfront && (
            <div className="mt-6 rounded-lg border border-slate-700/50 bg-slate-900/30 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Implied upfront
              </p>
              <p className="mt-1 font-mono text-2xl text-slate-100">
                {fmtMoney(upfront.median)}
              </p>
              <p className="font-mono text-xs text-slate-500">
                Range: {fmtMoney(upfront.low)} – {fmtMoney(upfront.high)}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Three key facts */}
      <section className="border-b border-slate-800/60 px-5 py-8">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
            What drives this number
          </h2>
          <dl className="space-y-3">
            <div className="flex items-baseline justify-between gap-4 border-b border-slate-800/60 pb-3">
              <dt className="text-sm text-slate-400">Probability of approval</dt>
              <dd className="font-mono text-lg text-slate-100">{pct(results.cumulativePoS)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-b border-slate-800/60 pb-3">
              <dt className="text-sm text-slate-400">Years to market</dt>
              <dd className="font-mono text-lg text-slate-100">{years(results.yearsToMarket)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-b border-slate-800/60 pb-3">
              <dt className="text-sm text-slate-400">Discount rate</dt>
              <dd className="font-mono text-lg text-slate-100">{pct(results.discountRate)}</dd>
            </div>
            {results.peakSales?.median != null && (
              <div className="flex items-baseline justify-between gap-4 border-b border-slate-800/60 pb-3">
                <dt className="text-sm text-slate-400">Projected peak sales / yr</dt>
                <dd className="font-mono text-lg text-slate-100">{fmtMoney(results.peakSales.median)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-4 pb-1">
              <dt className="text-sm text-slate-400">Risk-adjusted NPV</dt>
              <dd className="font-mono text-lg text-slate-100">{fmtMoney(results.riskAdjustedNPV)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Dominant risk */}
      {dominantRisk && (
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
          <Link href="/" className="text-cyan-400 hover:text-cyan-300">Ambrosia Benchmarker</Link>{' '}
          · {new Date(data.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </footer>
    </main>
  );
}
