import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { BENCHMARK_PRICING, DEAL_STATS } from '@/lib/config/constants';
import { BriefIntakeForm } from '@/components/intake/BriefIntakeForm';

const PRICE = BENCHMARK_PRICING.PRICE;

export const metadata: Metadata = {
  title: `Deal Intelligence Brief — One Asset, One Signed Recommendation | ${PRICE}`,
  description:
    `A decision brief for one biopharma asset: a signed recommendation with ask, floor and walk-away, registered in an outcome ledger and scored against what happens; cited comparables from ${DEAL_STATS.TOTAL_DEALS} primary-sourced deals; evidence-ranked buyers; an indicative term sheet; your own model set against ours. About 30 data-backed pages, ${PRICE}, invoiced at intake.`,
  keywords: [
    'biopharma licensing deal brief', 'pharma licensing benchmarks', 'drug licensing deal terms',
    'biotech out-licensing advisory', 'pharma deal intelligence', 'licensing deal valuation',
    'pharma BD deal benchmarks', 'biopharma deal advisory', 'biotech deal advisory service',
    'oncology deal benchmarks', 'neurology licensing benchmarks', 'rare disease deal terms',
  ],
  openGraph: {
    title: 'Deal Intelligence Brief — One Asset, One Signed Recommendation',
    description: `A signed recommendation with ask, floor and walk-away, scored against what actually happens; cited comparables from ${DEAL_STATS.TOTAL_DEALS} primary-sourced deals; an indicative term sheet; your model versus ours.`,
    url: 'https://solidus.ambrosiaventures.co/benchmark',
    type: 'website',
    images: [{
      url: '/api/og?title=Deal%20Intelligence%20Brief&subtitle=One%20asset%20%C2%B7%20One%20signed%20recommendation%20%C2%B7%20Scored',
      width: 1200,
      height: 630,
      alt: 'Solidus Deal Intelligence Brief — one asset, one signed recommendation',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Deal Intelligence Brief — ${PRICE}`,
    description: `One asset, one signed recommendation, scored against what happens. Cited comparables from ${DEAL_STATS.TOTAL_DEALS} primary-sourced deals. Within 24 hours of the intake call.`,
    images: ['/api/og?title=Deal%20Intelligence%20Brief&subtitle=One%20asset%20%C2%B7%20One%20signed%20recommendation%20%C2%B7%20Scored'],
  },
  alternates: { canonical: 'https://solidus.ambrosiaventures.co/benchmark' },
};

const PROOF_POINTS = [
  'A signed recommendation: ask, floor, walk-away, who to open with',
  'Registered in an outcome ledger and scored against what happens',
  'Delivered within 24 hours of the intake call',
] as const;

const PAGES = [
  ['The decision', 'What we recommend, with whom, at what terms, by when. Signed by the Managing Partner.'],
  ['This call is scored', 'The ask, floor, buyers and window we registered; how the call is scored; when you hear from us.'],
  ['Indicative term sheet', 'The document you carry into the room, built from the levers in the decision and the precedents in your area.'],
  ['Valuation bridge', 'Cited comparables, the calibrated range and risk-adjusted value reconciled to one ask, with the policy printed.'],
  ['Your model vs Solidus', 'Your peak sales, probability, timing, cost and expected terms set against ours, line by line, with the source of each gap.'],
  ['Comparable set', 'Phase-matched deals with a source on every row and the window used stated on the page.'],
  ['Buyer map', 'Counterparties ranked on fit, urgency and what each paid at your stage; the buyers you name assessed on the same terms.'],
  ['Catalyst calendar and window', 'Twenty-four months of readouts, LOEs and buyer events, and the window the recommendation rests on.'],
  ['Path to the next inflection', 'Partner now versus fund to the next readout, using your real cash and raise.'],
  ['Positioning, objections, diligence', 'How to present it, the objections you will hear with the evidence to answer them, and what is ready versus open in your package.'],
] as const;

const briefProductSchema = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Deal Intelligence Brief',
  description: `A decision brief for one biopharma asset: a signed recommendation with ask, floor and walk-away, registered in an outcome ledger and scored against the actual outcome; a valuation bridge reconciling cited comparables from ${DEAL_STATS.TOTAL_DEALS} primary-sourced deals; an indicative term sheet; your own model compared to ours; evidence-ranked buyers and a 24-month catalyst calendar. About 30 data-backed pages, reviewed and signed by the Managing Partner, delivered to a private data room within 24 hours of the intake call with a 30-minute walkthrough.`,
  url: 'https://solidus.ambrosiaventures.co/benchmark',
  brand: { '@type': 'Organization', name: 'Ambrosia Ventures' },
  offers: {
    '@type': 'Offer',
    price: '2500',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
    priceValidUntil: '2027-12-31',
    seller: { '@type': 'Organization', name: 'Ambrosia Ventures' },
  },
};

const FAQ: Array<[string, string]> = [
  ['What is a Deal Intelligence Brief?', `A decision brief for one asset. Page three is a signed recommendation: what to ask, the floor, the walk-away, which buyers to approach first and by when. Behind it: a valuation bridge that reconciles cited comparables, the calibrated range and risk-adjusted value to one ask; an indicative term sheet; your own model set against ours; buyers ranked on fit, urgency and what each has paid at your stage; a 24-month catalyst calendar; positioning and objections; diligence readiness. About 30 data-backed pages.`],
  ['How is the recommendation scored?', 'The ask, floor, counterparties and window are registered in the Solidus outcome ledger the day the brief is delivered. When a transaction for the asset is published, or when you report the first offer and the signed terms at day 45 or day 120, the call is scored on price, buyer and timing. You see the status and the score in your data room, and the resolved accuracy by area is published on the methodology page.'],
  ['How does payment work?', `The brief is ${PRICE}. There is no checkout: an invoice is sent within one business day of the intake form, a 15-minute call follows on receipt, and the brief is delivered within 24 hours of the call. The fee is credited in full against a subsequent advisory mandate.`],
  ['What do you need from me?', 'The asset, the stage and the structure you are preparing for are required. The rest is optional and makes the brief yours: your own peak-sales, probability and timing view, your cash and next raise, any offers already on the table, buyers you want assessed or excluded, and what is in your data package. Each item you supply replaces a public-data assumption with your number.'],
  ['What happens after delivery?', 'A private data room holds the PDF and the Excel behind every figure, plus the scored call. A 30-minute walkthrough is arranged by reply. Catalyst dates, moves by the buyers on your list and new comparable deals in your area reach you by email while the decision is live.'],
  ['How is the Brief different from Pro?', `Pro gives you the calculator, the comparable panel and the alerts to run your own analysis. The ${PRICE} Brief is a done-for-you decision document for one asset with a recommendation the Managing Partner signs and we score.`],
];

const briefFaqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })),
};

export default function BenchmarkPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(briefProductSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(briefFaqSchema) }} />

      <section className="bg-[#1a1e42] dark:bg-slate-950 text-white">
        <div className="max-w-4xl mx-auto px-4 py-20 sm:py-28 text-center">
          <p className="text-teal-400 text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] mb-4">Deal Intelligence Brief</p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4">
            One asset. One signed recommendation.
            <br className="hidden sm:block" /> Scored against what happens.
          </h1>
          <p className="text-lg sm:text-xl text-white/60 mb-10">
            The ask, the floor, the walk-away and who to open with, on page three. About 30 data-backed pages behind it.
          </p>
          <div className="flex flex-wrap justify-center gap-6 sm:gap-10 mb-10">
            {PROOF_POINTS.map(point => (
              <div key={point} className="flex items-center gap-2 text-sm text-white/80">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                {point}
              </div>
            ))}
          </div>
          <div className="mb-10">
            <span className="text-3xl sm:text-4xl font-bold">{PRICE}</span>
            <span className="text-white/50 text-sm ml-2">invoiced at intake</span>
            <p className="text-white/40 text-xs mt-2">30-minute walkthrough included. Credited in full against a subsequent advisory mandate.</p>
          </div>
          <a href="#intake" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors">
            Start the intake
            <span aria-hidden="true" className="text-base">&#8595;</span>
          </a>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto px-4 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white text-center mb-3">What the brief contains</h2>
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-12">Every page is built from cited data or from what you tell us at intake. Nothing is generated to fill space.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PAGES.map(([title, desc]) => (
              <div key={title} className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-700/30">
                <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
                  <div className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {BENCHMARK_PRICING.INCLUDES.map(item => (
              <div key={item} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                <div className="mt-2 w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto px-4 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white text-center mb-3">How it works</h2>
          <ol className="mx-auto max-w-2xl grid gap-3 text-sm text-slate-700 dark:text-slate-300 list-decimal pl-5 mb-12">
            <li><strong>Intake</strong>, below or at <Link href="/intake" className="text-teal-600 dark:text-teal-400 hover:underline">/intake</Link>. The asset and your contact details are required; your model, runway, offers, buyers and data package are optional and make the brief yours.</li>
            <li><strong>Invoice</strong> for {PRICE} within one business day. No card, no checkout.</li>
            <li><strong>Call</strong>: 15 minutes on receipt, to confirm the asset and the counterparties you want in or out.</li>
            <li><strong>Brief</strong> within 24 hours of the call, reviewed and signed by the Managing Partner, delivered to a private data room with the Excel behind every figure.</li>
            <li><strong>Walkthrough</strong>: 30 minutes, arranged by reply. Then the call is scored, and the alerts run while your decision is live.</li>
          </ol>
          <div className="mx-auto max-w-2xl grid gap-4">
            {FAQ.map(([q, a]) => (
              <details key={q} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-900 dark:text-white">{q}</summary>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="intake" className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-3xl mx-auto px-4 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">Intake</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">About ten minutes with your model to hand; two if you only have the asset.</p>
          <BriefIntakeForm intakePath="/benchmark" />
        </div>
      </section>
    </main>
  );
}
