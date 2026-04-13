import { Metadata } from 'next';
import Link from 'next/link';
import { loadPlaybookBuyers } from '@/lib/playbook-data';
import { InstitutionalNav } from '@/components/institutional/InstitutionalNav';
import { SiteFooter } from '@/components/seo/SiteFooter';

const BASE_URL = 'https://calculator.ambrosiaventures.co';

export const metadata: Metadata = {
  title: 'Counterparty Playbooks | Ambrosia Benchmarker',
  description:
    'Per-acquirer deal premiums sourced from disclosed transactions. AbbVie pays +X% on orphan oncology, Pfizer +Y% on immunology, Gilead −Z% on Phase 3 — backed by every disclosed deal each buyer has signed.',
  alternates: { canonical: `${BASE_URL}/playbook` },
  openGraph: {
    title: 'Counterparty Playbooks | Ambrosia Benchmarker',
    description: 'Per-acquirer deal premiums from 39 large buyers. Historical patterns backed by disclosed deals.',
    type: 'website',
    url: `${BASE_URL}/playbook`,
    siteName: 'Ambrosia Benchmarker',
    images: [
      {
        url: '/api/og?title=Counterparty%20Playbooks&subtitle=Who%20pays%20what%20premium',
        width: 1200,
        height: 630,
        alt: 'Ambrosia Benchmarker counterparty playbooks',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Counterparty Playbooks | Ambrosia Benchmarker',
    description: 'Per-acquirer deal premiums. AbbVie ×1.36, Pfizer ×1.50, Gilead ×1.42 — from 39 large buyers.',
  },
};

export const dynamic = 'force-dynamic';

function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

function premiumColor(p: number): string {
  if (p >= 1.20) return 'text-teal-400';
  if (p >= 1.05) return 'text-cyan-400';
  if (p <= 0.85) return 'text-amber-400';
  return 'text-slate-300';
}

function confidenceLabel(c: 'high' | 'medium' | 'low'): { label: string; color: string } {
  switch (c) {
    case 'high':
      return { label: 'High confidence', color: 'border-teal-500/30 text-teal-400 bg-teal-500/10' };
    case 'medium':
      return { label: 'Medium confidence', color: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10' };
    case 'low':
      return { label: 'Low confidence', color: 'border-slate-500/30 text-slate-400 bg-slate-500/10' };
  }
}

export default async function PlaybookIndex() {
  const buyers = await loadPlaybookBuyers();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <InstitutionalNav activePath="/playbook" />
      <section className="border-b border-slate-800/60 bg-gradient-to-b from-slate-900/50 to-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
            Counterparty Playbooks
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-400">
            Every acquirer pays a different premium &mdash; AbbVie&rsquo;s checks aren&rsquo;t Gilead&rsquo;s
            checks. We compute each buyer&rsquo;s historical premium vs. the comparable-deal median
            from <span className="text-slate-200">{buyers.length} buyers</span> with at least
            three disclosed transactions. Use this to anchor negotiations to what the counterparty
            actually pays, not industry averages.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Methodology: each buyer&rsquo;s deals are scored against same-TA, same-phase peer medians.
            Premiums are clamped to [0.7&times;, 1.5&times;] to reject outliers. Confidence
            scales with sample size: ≥10 deals high, 5&ndash;9 medium, 3&ndash;4 low.
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-12">
          {buyers.length === 0 ? (
            <p className="text-slate-400">No counterparty data yet — run the seed script.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-normal">Buyer</th>
                    <th className="px-4 py-3 text-right font-normal">Premium</th>
                    <th className="px-4 py-3 text-right font-normal">Disclosed deals</th>
                    <th className="px-4 py-3 text-left font-normal">Confidence</th>
                    <th className="px-4 py-3 text-left font-normal">Top TAs</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {buyers.map((b) => {
                    const conf = confidenceLabel(b.confidence);
                    const topTAs = Object.entries(b.byTherapeuticArea)
                      .sort((a, b) => b[1].n - a[1].n)
                      .slice(0, 3)
                      .map(([ta]) => ta.replace(/_/g, ' '))
                      .join(', ');
                    return (
                      <tr key={b.companyId} className="text-slate-200 transition-colors hover:bg-slate-900/40">
                        <td className="px-4 py-3 font-medium">{b.companyName}</td>
                        <td className={`px-4 py-3 text-right font-mono text-base ${premiumColor(b.premiumMultiplier)}`}>
                          ×{b.premiumMultiplier.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-400">{b.sampleSize}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${conf.color}`}>
                            {conf.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{topTAs || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/playbook/${b.slug}`}
                            className="text-sm text-cyan-400 hover:text-cyan-300"
                          >
                            View &rarr;
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
