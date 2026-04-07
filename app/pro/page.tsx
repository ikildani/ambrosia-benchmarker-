import { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { PRICING, DEAL_STATS } from '@/lib/config/constants';
import {
  Zap, BarChart3, LineChart, GitBranch, Layers, Network,
  TrendingUp, Repeat, Users, Search, Brain, Activity,
  FileDown, Share2, Check, X, ArrowRight, Shield,
  Building2, Briefcase, ChevronDown,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pro Plan | Unlimited Deal Intelligence | Ambrosia Ventures',
  description:
    'Unlock 14 deal engines, 12 therapeutic areas, and unlimited calculations. rNPV, Monte Carlo, real options, partner matching, and more for biopharma BD professionals.',
  keywords: [
    'biotech deal calculator pro',
    'biopharma deal intelligence platform',
    'pharma licensing analytics tool',
    'rNPV biotech valuation',
    'Monte Carlo pharma deal',
    'biopharma partner matching',
  ],
  openGraph: {
    title: 'Pro Plan | Unlimited Deal Intelligence | Ambrosia Ventures',
    description:
      'Unlock 14 deal engines, 12 therapeutic areas, and unlimited calculations for biopharma deal professionals.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/pro',
    images: [
      {
        url: '/api/og?title=Pro%20Plan&subtitle=Unlimited%20Deal%20Intelligence&type=landing',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pro Plan | Unlimited Deal Intelligence',
    description:
      'Unlock 14 deal engines, 12 therapeutic areas, and unlimited biopharma deal calculations.',
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/pro',
  },
};

const features = [
  { icon: Zap, title: 'Unlimited Calculations', desc: 'No caps. Run as many analyses as your deal flow demands.' },
  { icon: BarChart3, title: 'rNPV Analysis', desc: 'Risk-adjusted NPV with phase-specific probability of success.' },
  { icon: LineChart, title: 'Monte Carlo Simulation', desc: '10,000 iterations modeling deal outcome distributions.' },
  { icon: GitBranch, title: 'Deal Waterfall', desc: 'Visualize upfront, milestones, and royalty streams over time.' },
  { icon: Layers, title: 'Scenario Comparison', desc: 'Bear, base, and bull case side-by-side with sensitivity.' },
  { icon: Network, title: 'Real Options Valuation', desc: 'CRR lattice model for option-based deal structures.' },
  { icon: TrendingUp, title: 'Competitive Dynamics', desc: 'Model how competitor pipeline activity shifts deal value.' },
  { icon: Repeat, title: 'Lifecycle Extensions', desc: 'Quantify value from line extensions, reformulations, combos.' },
  { icon: Users, title: 'Buyer-Specific Valuation', desc: 'Multi-partner comparison with buyer-adjusted assumptions.' },
  { icon: Search, title: 'Partner Matching', desc: '850+ companies with full profiles, fit scores, and intent signals.' },
  { icon: Brain, title: 'Pharma Intent Score', desc: '10-factor predictive model of acquirer deal likelihood.' },
  { icon: Activity, title: 'Sensitivity Analysis', desc: 'Tornado charts across all parameters, not just top 3.' },
  { icon: FileDown, title: 'PDF & Excel Export', desc: '20-page reports and spreadsheets for your deal committee.' },
  { icon: Share2, title: 'Share Links', desc: 'Branded share pages with locked sections and report CTA.' },
];

const comparison = [
  { feature: 'Calculations', free: '3 total', pro: 'Unlimited' },
  { feature: 'Deal term estimates', free: 'Basic ranges', pro: 'Full breakdown' },
  { feature: 'rNPV analysis', free: 'Locked', pro: 'Full access' },
  { feature: 'Monte Carlo', free: 'Locked', pro: '10,000 iterations' },
  { feature: 'Partner matching', free: '3 matches, basic', pro: '10 matches, full profiles + intent' },
  { feature: 'Buyer-specific valuation', free: 'Locked', pro: 'Multi-partner comparison' },
  { feature: 'PDF & Excel export', free: 'Locked', pro: 'Included' },
  { feature: 'Sensitivity analysis', free: 'Top 3 only', pro: 'All parameters' },
  { feature: 'Real options', free: 'Locked', pro: 'CRR lattice' },
  { feature: 'Share links', free: 'Locked', pro: 'Unlimited' },
];

const useCases = [
  {
    icon: Briefcase,
    title: 'BD Teams Running Active Out-Licensing',
    desc: 'Model every scenario before you walk into the room. Compare partner offers side-by-side with buyer-specific assumptions and real-time competitive dynamics.',
  },
  {
    icon: Shield,
    title: 'Deal Committees Evaluating Inbound Offers',
    desc: 'Generate board-ready reports in minutes. rNPV, Monte Carlo, and sensitivity analysis give your committee the quantitative rigor to say yes or walk away.',
  },
  {
    icon: Building2,
    title: 'Investors Modeling Portfolio Valuations',
    desc: 'Stress-test biotech deal economics across bear, base, and bull scenarios. Real options valuation captures the optionality your DCF models miss.',
  },
];

const faqs = [
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from your account settings at any time. You keep full access through the end of your billing period with no penalties or hidden fees.',
  },
  {
    q: 'What\'s included in the annual plan?',
    a: `Everything in monthly Pro, billed annually at ${PRICING.PRO_ANNUAL_PRICE}/year (${PRICING.PRO_ANNUAL_MONTHLY}). You save ${PRICING.PRO_ANNUAL_SAVINGS} compared to monthly billing.`,
  },
  {
    q: 'Do I get access to all therapeutic areas?',
    a: 'Yes. Pro unlocks all 12 therapeutic areas and 562 indications with full deal benchmarks, partner matching, and competitive landscape data.',
  },
  {
    q: 'Can I export reports for my deal committee?',
    a: 'Absolutely. Generate 20-page PDF reports and Excel workbooks with scenario comparison, deal waterfall, real options, competitive dynamics, and buyer-specific valuation. Share via branded links or download directly.',
  },
];

export default function ProPage() {
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Ambrosia Ventures Pro Plan',
    description:
      'Unlimited biopharma deal intelligence with 14 calculation engines, 12 therapeutic areas, and 2,500+ transaction benchmarks.',
    url: 'https://calculator.ambrosiaventures.co/pro',
    brand: { '@type': 'Organization', name: 'Ambrosia Ventures' },
    offers: [
      {
        '@type': 'Offer',
        price: PRICING.PRO_PRICE_NUM,
        priceCurrency: 'USD',
        priceValidUntil: '2026-12-31',
        availability: 'https://schema.org/InStock',
        name: 'Pro Monthly',
        description: 'Monthly subscription to Ambrosia Ventures Pro',
      },
      {
        '@type': 'Offer',
        price: PRICING.PRO_ANNUAL_PRICE_NUM,
        priceCurrency: 'USD',
        priceValidUntil: '2026-12-31',
        availability: 'https://schema.org/InStock',
        name: 'Pro Annual',
        description: 'Annual subscription to Ambrosia Ventures Pro',
      },
    ],
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://calculator.ambrosiaventures.co' },
      { '@type': 'ListItem', position: 2, name: 'Pro' },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <main className="min-h-screen bg-white">
        {/* ── Hero ── */}
        <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-28 pb-20 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-900/20 via-transparent to-transparent" />
          <div className="relative max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 mb-8">
              <Zap className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-xs font-semibold text-teal-300 uppercase tracking-wider">Pro Plan</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight">
              Unlimited Deal Intelligence
            </h1>
            <p className="mt-6 text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              14 engines. 12 therapeutic areas. {DEAL_STATS.TOTAL_DEALS} deals. Unlimited calculations.
            </p>

            {/* Price display */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-6">
              <div className="text-center">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-white">$299</span>
                  <span className="text-slate-400">/month</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">Monthly billing</p>
              </div>
              <div className="hidden sm:block w-px h-12 bg-slate-700" />
              <div className="text-center">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-white">$199</span>
                  <span className="text-slate-400">/month</span>
                </div>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <p className="text-sm text-slate-500">Annual billing</p>
                  <span className="px-2 py-0.5 text-xs font-semibold bg-teal-500/20 text-teal-300 rounded-full">
                    Save {PRICING.PRO_ANNUAL_SAVINGS}
                  </span>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/calculator#pricing"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-teal-500 text-white font-semibold rounded-xl hover:bg-teal-400 transition-colors text-lg shadow-lg shadow-teal-500/25"
              >
                Start Pro
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/calculator"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-colors border border-white/10"
              >
                See a Demo Calculation
              </Link>
            </div>
          </div>
        </section>

        {/* ── Social proof bar ── */}
        <div className="bg-slate-50 border-b border-slate-200 py-4 px-4">
          <p className="text-center text-sm text-slate-600 font-medium">
            Based on <span className="font-bold text-slate-900">{DEAL_STATS.TOTAL_DEALS} disclosed biopharma transactions</span> across licensing, acquisitions, collaborations, option agreements, and co-development deals
          </p>
        </div>

        {/* ── Feature grid ── */}
        <section className="py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-slate-900">Everything You Need to Model a Deal</h2>
              <p className="mt-3 text-lg text-slate-600 max-w-2xl mx-auto">
                14 purpose-built engines that give your team quantitative rigor on every transaction.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="p-6 rounded-2xl border border-slate-200 hover:border-teal-300 hover:shadow-lg transition-all duration-300 group"
                >
                  <div className="p-2.5 bg-teal-500/10 rounded-xl w-fit mb-4 group-hover:bg-teal-500/20 transition-colors">
                    <f.icon className="w-5 h-5 text-teal-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-1">{f.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Comparison table ── */}
        <section className="py-20 px-4 bg-slate-50">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900">Free vs Pro</h2>
              <p className="mt-3 text-lg text-slate-600">See exactly what you unlock.</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {/* Header */}
              <div className="grid grid-cols-3 bg-slate-900 text-white text-sm font-semibold">
                <div className="px-6 py-4">Feature</div>
                <div className="px-6 py-4 text-center">Free</div>
                <div className="px-6 py-4 text-center bg-teal-600">Pro</div>
              </div>
              {/* Rows */}
              {comparison.map((row, i) => (
                <div
                  key={row.feature}
                  className={`grid grid-cols-3 text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} ${i < comparison.length - 1 ? 'border-b border-slate-100' : ''}`}
                >
                  <div className="px-6 py-4 font-medium text-slate-900">{row.feature}</div>
                  <div className="px-6 py-4 text-center text-slate-500 flex items-center justify-center gap-1.5">
                    {row.free === 'Locked' ? (
                      <X className="w-4 h-4 text-slate-400" />
                    ) : (
                      <span>{row.free}</span>
                    )}
                  </div>
                  <div className="px-6 py-4 text-center text-slate-900 font-medium flex items-center justify-center gap-1.5 bg-teal-50/50">
                    <Check className="w-4 h-4 text-teal-600 flex-shrink-0" />
                    <span>{row.pro}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Who uses Pro ── */}
        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-slate-900">Who Uses Pro</h2>
              <p className="mt-3 text-lg text-slate-600">Built for the people making the decisions.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {useCases.map((uc) => (
                <div key={uc.title} className="text-center">
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center mb-5">
                    <uc.icon className="w-6 h-6 text-teal-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-3">{uc.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{uc.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="py-20 px-4 bg-slate-50">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faqs.map((faq) => (
                <details key={faq.q} className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <summary className="flex items-center justify-between px-6 py-5 cursor-pointer list-none">
                    <span className="font-semibold text-slate-900">{faq.q}</span>
                    <ChevronDown className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="px-6 pb-5 text-sm text-slate-600 leading-relaxed">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-20 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-teal-900/20 via-transparent to-transparent" />
          <div className="relative max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Start Making Better Deals Today
            </h2>
            <p className="mt-4 text-lg text-slate-300 max-w-xl mx-auto">
              Join BD teams and investors who trust quantitative deal intelligence over gut feel.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-6">
              <div className="text-center">
                <span className="text-3xl font-bold text-white">{PRICING.PRO_MONTHLY}</span>
                <p className="text-sm text-slate-400 mt-1">
                  or {PRICING.PRO_ANNUAL_MONTHLY} billed annually
                </p>
              </div>
              <Link
                href="/calculator#pricing"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-teal-500 text-white font-semibold rounded-xl hover:bg-teal-400 transition-colors text-lg shadow-lg shadow-teal-500/25"
              >
                Start Pro
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>

            <p className="mt-6 text-sm text-slate-500">Cancel anytime. No contracts. No hidden fees.</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
