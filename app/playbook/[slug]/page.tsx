import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadPlaybookBuyer, listAllSlugs } from '@/lib/playbook-data';
import { SiteFooter } from '@/components/seo/SiteFooter';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPlaybookBuyer(slug);
  if (!data) {
    return { title: 'Buyer not found | Ambrosia Benchmarker' };
  }
  const { buyer } = data;
  return {
    title: `${buyer.companyName} — Counterparty Playbook | Ambrosia Benchmarker`,
    description: `${buyer.companyName} pays ${buyer.premiumMultiplier > 1 ? '+' : ''}${((buyer.premiumMultiplier - 1) * 100).toFixed(0)}% vs. comparable medians across ${buyer.sampleSize} disclosed deals. Per-TA and per-phase breakdowns sourced from public filings.`,
  };
}

function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

function fmtMoney(usd: number | null): string {
  if (!usd) return '—';
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(0)}M`;
  return `$${usd.toLocaleString()}`;
}

export default async function PlaybookDetail({ params }: Props) {
  const { slug } = await params;
  const data = await loadPlaybookBuyer(slug);
  if (!data) notFound();

  const { buyer, deals } = data;
  const premiumPct = (buyer.premiumMultiplier - 1) * 100;
  const premiumLabel = premiumPct >= 0 ? `+${premiumPct.toFixed(0)}%` : `${premiumPct.toFixed(0)}%`;
  const premiumColor =
    buyer.premiumMultiplier >= 1.20 ? 'text-teal-400'
      : buyer.premiumMultiplier >= 1.05 ? 'text-cyan-400'
      : buyer.premiumMultiplier <= 0.85 ? 'text-amber-400'
      : 'text-slate-300';

  const taRows = Object.entries(buyer.byTherapeuticArea)
    .sort((a, b) => b[1].n - a[1].n);
  const phaseRows = Object.entries(buyer.byPhase)
    .sort((a, b) => b[1].n - a[1].n);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="border-b border-slate-800/60 bg-gradient-to-b from-slate-900/50 to-slate-950">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <nav className="mb-4 flex items-center gap-2 text-sm">
            <Link href="/" className="text-slate-500 hover:text-slate-300">Home</Link>
            <span className="text-slate-700">/</span>
            <Link href="/playbook" className="text-slate-500 hover:text-slate-300">Playbooks</Link>
            <span className="text-slate-700">/</span>
            <span className="text-slate-300">{buyer.companyName}</span>
          </nav>

          <h1 className="text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
            {buyer.companyName}
          </h1>

          <div className="mt-6 flex flex-wrap items-baseline gap-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">Pays vs peer median</div>
              <div className={`mt-1 font-mono text-5xl font-semibold ${premiumColor}`}>
                ×{buyer.premiumMultiplier.toFixed(2)}
              </div>
              <div className={`mt-1 text-sm ${premiumColor}`}>{premiumLabel} premium</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">Sample</div>
              <div className="mt-1 font-mono text-2xl text-slate-200">{buyer.sampleSize}</div>
              <div className="mt-1 text-sm capitalize text-slate-500">{buyer.confidence} confidence</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">Last refreshed</div>
              <div className="mt-1 font-mono text-sm text-slate-300">{buyer.asOfDate}</div>
            </div>
          </div>
        </div>
      </section>

      {/* By therapeutic area */}
      <section className="border-b border-slate-800/60">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <h2 className="mb-4 text-xl font-semibold text-slate-100">By therapeutic area</h2>
          {taRows.length === 0 ? (
            <p className="text-sm text-slate-500">Not enough TA-specific data (need ≥3 deals per TA).</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/40 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-normal">Therapeutic area</th>
                    <th className="px-4 py-3 text-right font-normal">Premium</th>
                    <th className="px-4 py-3 text-right font-normal">Deals</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {taRows.map(([ta, v]) => (
                    <tr key={ta} className="text-slate-200">
                      <td className="px-4 py-2.5 capitalize">{ta.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2.5 text-right font-mono">×{v.premium.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-400">{v.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* By phase */}
      <section className="border-b border-slate-800/60 bg-slate-900/20">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <h2 className="mb-4 text-xl font-semibold text-slate-100">By stage at signing</h2>
          {phaseRows.length === 0 ? (
            <p className="text-sm text-slate-500">Not enough phase-specific data (need ≥3 deals per phase).</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/40 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-normal">Phase</th>
                    <th className="px-4 py-3 text-right font-normal">Premium</th>
                    <th className="px-4 py-3 text-right font-normal">Deals</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {phaseRows.map(([phase, v]) => (
                    <tr key={phase} className="text-slate-200">
                      <td className="px-4 py-2.5 capitalize">{phase.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2.5 text-right font-mono">×{v.premium.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-400">{v.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Recent deals */}
      <section className="border-b border-slate-800/60">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <h2 className="mb-4 text-xl font-semibold text-slate-100">Recent disclosed deals</h2>
          {deals.length === 0 ? (
            <p className="text-sm text-slate-500">No deal records found for this buyer.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/40 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-normal">Year</th>
                    <th className="px-4 py-3 text-left font-normal">Asset</th>
                    <th className="px-4 py-3 text-left font-normal">Licensor</th>
                    <th className="px-4 py-3 text-left font-normal">Indication</th>
                    <th className="px-4 py-3 text-left font-normal">Phase</th>
                    <th className="px-4 py-3 text-right font-normal">Upfront</th>
                    <th className="px-4 py-3 text-right font-normal">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {deals.map((d) => (
                    <tr key={d.id} className="text-slate-200">
                      <td className="px-4 py-2.5 font-mono text-slate-400">{d.year ?? '—'}</td>
                      <td className="px-4 py-2.5">{d.asset || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-400">{d.licensorName || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-400 capitalize">{d.indication || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{d.phase || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{fmtMoney(d.upfrontUsd)}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{fmtMoney(d.totalDealValueUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Methodology */}
      <section className="border-b border-slate-800/60 bg-slate-900/20">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <h2 className="mb-3 text-lg font-semibold text-slate-100">How this is computed</h2>
          <p className="text-sm leading-relaxed text-slate-400">
            For each {buyer.companyName} deal we find the median total deal value of comparable
            transactions (same therapeutic area + phase, falling back to TA-only with ≥3 peers).
            The buyer&rsquo;s deal divided by the peer median is the per-deal premium. We
            trim outliers, take the trimmed mean, and clamp to [0.7&times;, 1.5&times;] to
            reject data errors. Confidence scales with sample size.
          </p>
          {buyer.calculationNotes && (
            <p className="mt-3 text-xs text-slate-500">{buyer.calculationNotes}</p>
          )}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
