import type { Metadata } from 'next';
import Link from 'next/link';
import { InstitutionalNav } from '@/components/institutional/InstitutionalNav';
import { BriefPageStack } from '@/components/brief/BriefPageStack';
import { BENCHMARK_PRICING, DEAL_STATS, ENGINE_COUNT } from '@/lib/config/constants';
import { getLiveDealStats } from '@/lib/deal-stats';

const BASE_URL = 'https://solidus.ambrosiaventures.co';
const PRICE = BENCHMARK_PRICING.PRICE;

export const metadata: Metadata = {
  title: `Deal Intelligence Brief — One Asset, One Signed Recommendation | ${PRICE}`,
  description: `A decision brief for one biopharma asset: a signed recommendation with ask, floor and walk-away, registered in an outcome ledger and scored against what happens; cited comparables from ${DEAL_STATS.TOTAL_DEALS} primary-sourced deals; an indicative term sheet; your own model against ours. About 30 data-backed pages, ${PRICE}, invoiced at intake.`,
  alternates: { canonical: `${BASE_URL}/brief` },
  openGraph: {
    title: 'Deal Intelligence Brief — One Asset, One Signed Recommendation',
    description: `A signed recommendation with ask, floor and walk-away, scored against what actually happens. Cited comparables from ${DEAL_STATS.TOTAL_DEALS} primary-sourced deals.`,
    url: `${BASE_URL}/brief`,
    type: 'website',
    siteName: 'Solidus',
    images: [{ url: '/api/og?title=Deal%20Intelligence%20Brief&subtitle=One%20asset%20%C2%B7%20One%20signed%20recommendation%20%C2%B7%20Scored', width: 1200, height: 630, alt: 'Solidus Deal Intelligence Brief' }],
  },
  twitter: { card: 'summary_large_image', title: `Deal Intelligence Brief — ${PRICE}`, description: 'One asset, one signed recommendation, scored against what happens.' },
};

export const revalidate = 900;

const PAGES: Array<{ n: string; title: string; text: string }> = [
  { n: '03', title: 'The decision', text: 'What we recommend, with whom, at what terms, by when. Signed by the Managing Partner.' },
  { n: '04', title: 'This call is scored', text: 'The ask, floor, buyers and window we registered; how the call is scored; when you hear from us.' },
  { n: '05', title: 'Indicative term sheet', text: 'Opening positions and floors from the decision, precedent shares, and a stage-weighted milestone schedule.' },
  { n: '07', title: 'Valuation bridge', text: 'Cited comparables, the calibrated range and risk-adjusted value reconciled to one ask, with the policy printed.' },
  { n: '08', title: 'Your model vs Solidus', text: 'Your peak sales, probability, timing, cost and expected terms against ours, with the source of each gap.' },
  { n: '11', title: 'Comparable set', text: 'Phase-matched deals with a source on every row and the window used stated on the page.' },
  { n: '18', title: 'Path to the next inflection', text: 'Partner now versus fund to the next readout, using your real cash and raise.' },
  { n: '19', title: 'Buyer map', text: 'Counterparties ranked on fit, urgency and what each paid at your stage; the buyers you name assessed on the same terms.' },
  { n: '22', title: 'Catalyst calendar', text: 'Twenty-four months of readouts, LOEs and buyer events, and the window the recommendation rests on.' },
  { n: '23', title: 'Positioning, objections, diligence', text: 'How to present it, the objections you will hear with the evidence to answer them, and what is ready versus open.' },
];

const STEPS: Array<[string, string]> = [
  ['Intake', 'The asset and your contact are required. Your model, runway, offers, buyers and data package are optional and make the brief yours. The form answers back as you go: our peak-sales and probability read for the profile, the size of the comparable set, the buyers most active at your stage. A first draft starts building the moment you submit.'],
  ['Invoice', `${PRICE}, sent within one business day. No card, no checkout. Credited in full against a subsequent advisory mandate.`],
  ['Call', 'Fifteen minutes on receipt, with the draft in front of us, to confirm the asset, the counterparties you want in or out, and anything the draft got wrong.'],
  ['Brief', 'Within 24 hours of the call, reviewed and signed by the Managing Partner, delivered to a private data room with the Excel behind every figure.'],
  ['After', 'A 30-minute walkthrough. Then the call is scored, and catalyst dates, buyer moves and new comps reach you while the decision is live.'],
];

const FAQ: Array<[string, string]> = [
  ['How is the recommendation scored?', 'The ask, floor, counterparties and window are registered in the Solidus outcome ledger the day the brief is delivered. When a transaction for the asset is published, or when you report the first offer and the signed terms at day 45 or day 120, the call is scored on price, buyer and timing. You see the status in your data room; resolved accuracy by area is published on the methodology page.'],
  ['What do you need from me?', 'The asset, the stage and the structure you are preparing for. Everything else is optional: your own peak-sales, probability and timing view, cash and next raise, offers already on the table, buyers to assess or exclude, and what your data package contains. Each item you supply replaces a public-data assumption with your number.'],
  ['How does payment work?', `The brief is ${PRICE}, invoiced within one business day of the intake. A 15-minute call follows on receipt; the brief is delivered within 24 hours of the call. The fee is credited in full against a subsequent advisory mandate.`],
  ['How is this different from Pro?', 'Pro gives you the calculator, the comparable panel and the alerts to run your own analysis. The brief is a done-for-you decision document for one asset with a recommendation the Managing Partner signs and we score.'],
  ['Who sees my data?', 'Your intake and your brief live in your private data room. Nothing you supply or report is published in a way that identifies you or the asset; resolved outcomes feed area-level accuracy figures only.'],
];

export default async function BriefPage() {
  const stats = await getLiveDealStats();
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })) };
  const productSchema = { '@context': 'https://schema.org', '@type': 'Product', name: 'Deal Intelligence Brief', description: metadata.description, url: `${BASE_URL}/brief`, brand: { '@type': 'Organization', name: 'Ambrosia Ventures' }, offers: { '@type': 'Offer', price: '2500', priceCurrency: 'USD', availability: 'https://schema.org/InStock', priceValidUntil: '2027-12-31', seller: { '@type': 'Organization', name: 'Ambrosia Ventures' } } };

  return (
    <main className="min-h-screen bg-[#0b0e13] text-slate-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <InstitutionalNav activePath="/brief" />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-800/60">
        <div className="pointer-events-none absolute -top-40 right-0 h-[520px] w-[520px] rounded-full bg-teal-500/[0.06] blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-[320px] w-[320px] rounded-full bg-amber-400/[0.04] blur-3xl" />
        <div className="mx-auto grid max-w-6xl gap-12 px-6 pt-28 pb-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pb-24">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-400">Deal Intelligence Brief</p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-slate-50 sm:text-5xl lg:text-[3.4rem]">
              One asset.<br />One signed recommendation.<br /><span className="text-teal-300">Scored against what happens.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
              Page three tells you what to ask, where the floor is, when to walk away and who to open with. Every number behind it is cited, and the call is registered in an outcome ledger the day it is delivered.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/intake" className="rounded-full bg-teal-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/20 transition hover:bg-teal-400">
                Start the intake
              </Link>
              <a href="#pages" className="rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900">
                See every page
              </a>
              <span className="text-sm text-slate-500">{PRICE} · invoiced at intake · within 24h of the call</span>
            </div>
            <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-slate-800/80 pt-6 sm:grid-cols-4">
              {[
                [stats.totalDealsDisplay, 'primary-sourced deals, live'],
                [String(ENGINE_COUNT), 'engines on one asset'],
                ['35', 'data-backed pages'],
                ['24h', 'from the intake call'],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="font-mono text-2xl font-semibold text-slate-50">{v}</dt>
                  <dd className="mt-1 text-xs text-slate-500">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="lg:pl-4">
            <BriefPageStack />
          </div>
        </div>
      </section>

      {/* Pages */}
      <section id="pages" className="border-b border-slate-800/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-400">What you receive</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-50">Thirty-five pages, each built from cited data or from what you tell us.</h2>
            <p className="mt-3 text-slate-400">Nothing is generated to fill space. A page with no defensible data prints an empty state that says why, not a paragraph of prose.</p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {PAGES.map(p => (
              <div key={p.n} className="group rounded-xl border border-slate-800 bg-[#10141c] p-4 transition hover:border-teal-500/40">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[11px] text-slate-500">p. {p.n}</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-400/70 opacity-0 transition group-hover:opacity-100" />
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-100">{p.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Your data */}
      <section className="border-b border-slate-800/60 bg-[#0d1118]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300/90">Your data makes it yours</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-50">Public data gets you a benchmark. Your data gets you a decision.</h2>
              <p className="mt-3 text-slate-400">The intake asks for what you own and have never read as data. Each item replaces a public-data assumption with your number, and the brief says so on the page.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Your model', 'Peak sales, probability, launch year, cost and the terms you expect, set against ours line by line with the source of each gap.'],
                ['Your process', 'Offers already on the table printed against the floor and the ask; the buyers you name assessed on the same terms as the ones we rank; the ones you exclude, excluded.'],
                ['Your package', 'What is in hand and what is open, so the diligence-readiness page lists what a buyer will ask for and marks each item.'],
              ].map(([t, d]) => (
                <div key={t} className="rounded-xl border border-slate-800 bg-[#10141c] p-5">
                  <div className="text-sm font-semibold text-slate-100">{t}</div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="border-b border-slate-800/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-400">How it works</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-50">Five steps. One invoice. No checkout.</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-5">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="relative">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-teal-500/40 bg-teal-500/10 font-mono text-xs font-semibold text-teal-300">{i + 1}</span>
                  <span className="text-sm font-semibold text-slate-100">{t}</span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ + CTA */}
      <section>
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-400">Questions</p>
            <div className="mt-6 divide-y divide-slate-800 border-y border-slate-800">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-100">
                    {q}
                    <span className="ml-4 text-slate-600 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">{a}</p>
                </details>
              ))}
            </div>
          </div>
          <div className="lg:pl-8">
            <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-b from-teal-500/10 to-transparent p-8">
              <div className="font-mono text-3xl font-semibold text-slate-50">{PRICE}</div>
              <div className="mt-1 text-sm text-slate-400">Invoiced at intake. Credited in full against a subsequent advisory mandate.</div>
              <ul className="mt-6 space-y-2 text-sm text-slate-300">
                {BENCHMARK_PRICING.INCLUDES.map(i => <li key={i} className="flex gap-2"><span className="text-teal-400">—</span>{i}</li>)}
              </ul>
              <Link href="/intake" className="mt-8 inline-flex rounded-full bg-teal-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/20 transition hover:bg-teal-400">
                Start the intake
              </Link>
              <p className="mt-4 text-xs text-slate-500">About ten minutes with your model to hand; two if you only have the asset. Prefer a conversation first? <Link href="/contact" className="text-teal-300 hover:underline">Write to the Managing Partner.</Link></p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
