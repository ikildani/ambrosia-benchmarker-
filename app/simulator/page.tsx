import { Metadata } from 'next';
import Link from 'next/link';
import { loadNegotiationScenarios } from '@/lib/negotiation-data';
import { ZOPAChart } from '@/components/simulator/ZOPAChart';
import { InstitutionalNav } from '@/components/institutional/InstitutionalNav';
import { SiteFooter } from '@/components/seo/SiteFooter';

const BASE_URL = 'https://calculator.ambrosiaventures.co';

export const metadata: Metadata = {
  title: 'Negotiation Simulator (ZOPA) | Ambrosia Benchmarker',
  description:
    'Where should you open? The Ambrosia engine combines rNPV base valuation, counterparty historical premiums, and your cash-runway BATNA to show the zone of agreement and recommended opening position.',
  alternates: { canonical: `${BASE_URL}/simulator` },
  openGraph: {
    title: 'Negotiation Simulator | Ambrosia Benchmarker',
    description: 'Where should you open? Engine computes ZOPA from rNPV, buyer premium, and your BATNA.',
    type: 'website',
    url: `${BASE_URL}/simulator`,
    siteName: 'Ambrosia Benchmarker',
    images: [
      {
        url: '/api/og?title=Negotiation%20Simulator&subtitle=ZOPA%20%2B%20recommended%20opening',
        width: 1200,
        height: 630,
        alt: 'Ambrosia negotiation simulator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Negotiation Simulator | Ambrosia Benchmarker',
    description: 'Engine computes ZOPA from rNPV, buyer premium, and your BATNA. See where to open.',
  },
};

export const dynamic = 'force-dynamic';

function fmtMoney(m: number): string {
  if (m >= 1000) return `$${(m / 1000).toFixed(1)}B`;
  return `$${Math.round(m)}M`;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

export default async function SimulatorPage() {
  const scenarios = await loadNegotiationScenarios();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <InstitutionalNav activePath="/simulator" />
      <section className="border-b border-slate-800/60 bg-gradient-to-b from-slate-900/50 to-slate-950">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
            Negotiation Simulator
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-400">
            Pricing alone isn&rsquo;t a negotiation strategy. You need to know where the buyer
            walks, where you walk, and where the zone of agreement sits. The simulator
            combines rNPV base valuation + counterparty historical premium +
            licensor BATNA to compute ZOPA and a recommended opening.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs">
            <Link
              href="/playbook"
              className="rounded-full border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-slate-300 hover:bg-slate-900"
            >
              Counterparty playbooks →
            </Link>
            <Link
              href="/trade-space"
              className="rounded-full border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-slate-300 hover:bg-slate-900"
            >
              Deal-structure trade space →
            </Link>
          </div>
        </div>
      </section>

      {scenarios.map((s) => (
        <section
          key={s.slug}
          id={s.slug}
          className="border-b border-slate-800/60 even:bg-slate-900/20"
        >
          <div className="mx-auto max-w-5xl px-6 py-12">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-slate-100">{s.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{s.subtitle}</p>
            </div>

            {/* Inputs row */}
            <div className="mb-6 grid gap-4 md:grid-cols-2">
              {/* Licensor context */}
              <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-5">
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">
                  Licensor
                </div>
                <div className="text-sm font-semibold text-slate-200">{s.licensorContext.companyName}</div>
                <p className="mt-2 text-xs text-slate-400">{s.licensorContext.cashRunwayNarrative}</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-xs text-slate-500">BATNA:</span>
                  <span className="font-mono text-sm text-slate-200">{fmtMoney(s.licensorContext.batnaUpfrontM)}</span>
                </div>
                <p className="mt-1 text-[11px] italic text-slate-500">{s.licensorContext.batnaRationale}</p>
              </div>

              {/* Buyer context */}
              <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-5">
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-cyan-400">
                  Counterparty
                </div>
                <div className="text-sm font-semibold text-slate-100">{s.buyerContext.companyName}</div>
                {s.buyerContext.premiumMultiplier != null ? (
                  <>
                    <div className="mt-2 flex items-baseline gap-3">
                      <span className="font-mono text-2xl text-cyan-300">
                        ×{s.buyerContext.premiumMultiplier.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {pct(s.buyerContext.premiumMultiplier - 1)} {s.buyerContext.premiumMultiplier >= 1 ? 'premium' : 'discount'} vs peer median
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Based on {s.buyerContext.sampleSize} disclosed deals ({s.buyerContext.confidence} confidence).{' '}
                      <Link href={`/playbook`} className="text-cyan-400 hover:text-cyan-300 underline">
                        Full playbook
                      </Link>
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    No premium data available. Using 1.0× (peer-median pricing).
                  </p>
                )}
              </div>
            </div>

            {/* Engine-derived numbers */}
            <div className="mb-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded border border-slate-700/50 bg-slate-900/30 p-3 text-center">
                <div className="text-xs text-slate-500">Engine base upfront</div>
                <div className="mt-1 font-mono text-lg text-slate-200">{fmtMoney(s.rnpv.upfrontMedian_M)}</div>
                <div className="text-[11px] text-slate-500">pre-buyer-premium</div>
              </div>
              <div className="rounded border border-slate-700/50 bg-slate-900/30 p-3 text-center">
                <div className="text-xs text-slate-500">Engine total deal</div>
                <div className="mt-1 font-mono text-lg text-slate-200">{fmtMoney(s.rnpv.totalDealMedian_M)}</div>
                <div className="text-[11px] text-slate-500">bio-bucks headline</div>
              </div>
              <div className="rounded border border-slate-700/50 bg-slate-900/30 p-3 text-center">
                <div className="text-xs text-slate-500">Risk-adjusted NPV</div>
                <div className="mt-1 font-mono text-lg text-slate-200">{fmtMoney(s.rnpv.riskAdjustedNPV_M)}</div>
                <div className="text-[11px] text-slate-500">asset intrinsic value</div>
              </div>
            </div>

            {/* ZOPA visualization */}
            <div>
              <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-slate-400">
                Zone of Possible Agreement
              </h3>
              <ZOPAChart
                floorUpfront={s.zopa.floorUpfront_M}
                buyerTop={s.zopa.buyerTopUpfront_M}
                recommendedOpening={s.zopa.recommendedOpening_M}
                recommendedFallback={s.zopa.recommendedFallback_M}
              />
            </div>

            {s.zopa.zopaWidth_M > 0 && (
              <div className="mt-6 rounded-lg border border-teal-500/30 bg-teal-500/5 p-4">
                <h4 className="mb-2 text-sm font-medium text-teal-400">Suggested approach</h4>
                <ul className="space-y-1.5 text-sm text-slate-300">
                  <li>
                    <span className="text-slate-500">Open at</span>{' '}
                    <span className="font-mono text-teal-300">{fmtMoney(s.zopa.recommendedOpening_M)}</span>
                    <span className="text-slate-500"> — anchors ~15% above buyer&rsquo;s typical ceiling to create room for counter-offer.</span>
                  </li>
                  <li>
                    <span className="text-slate-500">Prepared to accept</span>{' '}
                    <span className="font-mono text-slate-200">{fmtMoney(s.zopa.recommendedFallback_M)}</span>
                    <span className="text-slate-500"> — ZOPA midpoint, leaves upside for buyer psychology.</span>
                  </li>
                  <li>
                    <span className="text-slate-500">Walk below</span>{' '}
                    <span className="font-mono text-slate-400">{fmtMoney(s.zopa.floorUpfront_M)}</span>
                    <span className="text-slate-500"> — BATNA floor. Below this, the alternative path (standalone, different partner) wins.</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </section>
      ))}

      {/* Methodology */}
      <section className="border-b border-slate-800/60 bg-slate-900/20">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <h2 className="mb-4 text-xl font-semibold text-slate-100">How ZOPA is computed</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-400">
            <p>
              <strong className="text-slate-200">Step 1 — Engine base.</strong>{' '}
              Run <code className="rounded bg-slate-800 px-1 py-0.5 text-slate-300">calculateRNPV()</code>{' '}
              on the asset profile. The implied upfront (median of the low / median / high
              range) is the &ldquo;neutral&rdquo; price a buyer paying peer-median premium would
              offer.
            </p>
            <p>
              <strong className="text-slate-200">Step 2 — Counterparty adjustment.</strong>{' '}
              Multiply the engine base by the buyer&rsquo;s historical premium from the
              {' '}<Link href="/playbook" className="text-cyan-400 hover:text-cyan-300">counterparty playbook</Link>.
              Result: the upfront this specific buyer is <em>likely</em> to offer given their
              pattern across N disclosed deals.
            </p>
            <p>
              <strong className="text-slate-200">Step 3 — Licensor floor (BATNA).</strong>{' '}
              Your walk-away point. Set by cash-runway math: below this number, the alternative
              (standalone, different partner, holding the asset) is economically preferred.
              This is the one input the engine cannot compute — it&rsquo;s a strategic choice
              the licensor must bring to the table.
            </p>
            <p>
              <strong className="text-slate-200">Step 4 — ZOPA width.</strong>{' '}
              Buyer ceiling &minus; licensor floor. Positive = agreement possible. Negative =
              no overlap; the deal either doesn&rsquo;t close or requires restructuring
              (co-development shifts cash-now to retained upside, for example).
            </p>
            <p>
              <strong className="text-slate-200">Step 5 — Opening ask.</strong>{' '}
              15% above the buyer&rsquo;s ceiling creates room for counter-offer without
              anchoring too high (which risks the buyer walking). The fallback is the ZOPA
              midpoint — fair, defensible, leaves buyer psychology intact.
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
