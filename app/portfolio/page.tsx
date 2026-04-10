import { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { PRICING, DEAL_STATS, PORTFOLIO_PRICING, PORTFOLIO_DEMO_URL } from '@/lib/config/constants';
import {
  Users, LayoutDashboard, FileBarChart, Network, Bell,
  Shield, Lock, Server, Calendar, ArrowRight, Check, Crown,
  TrendingUp, AlertTriangle, BarChart3, LineChart, Brain,
  Search, FileDown, Layers, GitBranch, Sparkles, Mail,
  BookOpen, Palette, Library, Filter, MessageSquare, UserCheck,
  Star, Code, ShieldCheck, Eye, Briefcase, Quote,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Metadata & SEO
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Portfolio License | The Deal Intelligence Layer for Biotech & Pharma VCs | Ambrosia Ventures',
  description:
    'Multi-seat Pro access plus 16 fund-level capabilities for biotech and pharma VC firms. Admin dashboard, quarterly portfolio reports, white-label deliverables, dedicated analyst hours, and an enterprise infrastructure layer. From $30,000/yr for 5 seats.',
  keywords: [
    'biotech VC portfolio platform',
    'pharma VC deal intelligence',
    'biotech venture capital benchmarking',
    'corporate venture biotech intelligence',
    'biotech fund operating partner platform',
    'multi-seat biotech licensing platform',
    'biotech VC portfolio management software',
    'emerging biotech fund deal intelligence',
    'CVC biotech deal benchmarking',
    'biotech VC LP reporting tool',
  ],
  openGraph: {
    title: 'Portfolio License | The Deal Intelligence Layer for Biotech & Pharma VCs',
    description:
      '16 fund-level capabilities for biotech and pharma VCs. Admin dashboard, white-label reports, dedicated analyst hours, cross-portfolio partner matching, and enterprise infrastructure — from $30,000/yr.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/portfolio',
    siteName: 'Ambrosia Ventures',
    images: [{
      url: '/api/og?title=Portfolio%20License&subtitle=The%20Deal%20Intelligence%20Layer%20for%20Biotech%20%26%20Pharma%20VCs&type=landing',
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Portfolio License | The Deal Intelligence Layer for Biotech & Pharma VCs',
    description: '16 fund-level capabilities. White-label reports. Dedicated analyst hours. Built for biotech VC operating partners.',
    images: ['/api/og?title=Portfolio%20License&subtitle=The%20Deal%20Intelligence%20Layer%20for%20Biotech%20%26%20Pharma%20VCs&type=landing'],
  },
  alternates: { canonical: 'https://calculator.ambrosiaventures.co/portfolio' },
};

// ---------------------------------------------------------------------------
// Data — Tier Comparison Table (expanded with all 16 features)
// ---------------------------------------------------------------------------

const tierComparison: Array<{ feature: string; pro: string | boolean; growth: string | boolean; scale: string | boolean; enterprise: string | boolean; group?: string }> = [
  // Foundation
  { feature: 'Seats',                                        pro: '1',  growth: '5',  scale: '10', enterprise: '15+', group: 'Foundation' },
  { feature: 'Deal Benchmarking (2,500+ txns)',              pro: true, growth: true, scale: true, enterprise: true },
  { feature: 'rNPV & Monte Carlo',                           pro: true, growth: true, scale: true, enterprise: true },
  { feature: 'AI Deal Memo Generator',                       pro: true, growth: true, scale: true, enterprise: true },
  { feature: 'Partner Matching',                             pro: true, growth: true, scale: true, enterprise: true },

  // Visibility & Coordination
  { feature: 'Admin Dashboard',                              pro: false, growth: true, scale: true, enterprise: true, group: 'Visibility & Coordination' },
  { feature: 'Cross-Portfolio Deal Pipeline Tracker',        pro: false, growth: true, scale: true, enterprise: true },
  { feature: 'Cross-Portfolio Partner Matching',             pro: false, growth: true, scale: true, enterprise: true },

  // Intelligence Delivered
  { feature: 'Quarterly Portfolio Report',                   pro: false, growth: true, scale: true, enterprise: true, group: 'Intelligence Delivered' },
  { feature: 'Fund-Branded White-Label Reports',             pro: false, growth: true, scale: true, enterprise: true },
  { feature: 'Shared Fund Comp Library',                     pro: false, growth: true, scale: true, enterprise: true },
  { feature: 'Negotiation Playbook Library',                 pro: false, growth: true, scale: true, enterprise: true },

  // Workflow & Alerts
  { feature: 'Deal Alert Feeds',                             pro: false, growth: true, scale: true, enterprise: true, group: 'Workflow & Alerts' },
  { feature: 'Custom Alert Rules + Saved Searches',          pro: false, growth: true, scale: true, enterprise: true },
  { feature: 'Slack & Teams Integration',                    pro: false, growth: true, scale: true, enterprise: true },

  // Concierge Service
  { feature: 'Dedicated Analyst Hours',                      pro: false, growth: '2 hrs/mo', scale: '5 hrs/mo', enterprise: '10 hrs/mo + named', group: 'Concierge Service' },
  { feature: 'Portfolio Co Office Hours',                    pro: false, growth: true, scale: true, enterprise: true },
  { feature: 'Annual Customer Summit',                       pro: false, growth: true, scale: true, enterprise: true },
  { feature: 'Quarterly Strategy Call (Managing Partner)',   pro: false, growth: false, scale: false, enterprise: true },
  { feature: 'Advisory Preferred Rates (15% off)',           pro: false, growth: false, scale: false, enterprise: true },

  // Enterprise Infrastructure
  { feature: 'SSO / SAML + Audit Logs',                      pro: false, growth: true, scale: true, enterprise: true, group: 'Enterprise Infrastructure' },
  { feature: 'API Access',                                   pro: false, growth: true, scale: true, enterprise: true },
  { feature: 'Custom DPA + Security Documentation',          pro: false, growth: true, scale: true, enterprise: true },
  { feature: 'Dedicated Onboarding (4 weeks)',               pro: false, growth: true, scale: true, enterprise: true },
];

// ---------------------------------------------------------------------------
// Data — 4 Marquee Fund-Level Features (with deep mockups)
// ---------------------------------------------------------------------------

const marqueeFundFeatures = [
  {
    icon: LayoutDashboard,
    eyebrow: 'Admin Dashboard',
    title: 'Know which portfolio company is in deal mode — without asking the CEO.',
    description:
      'A read-only command center for the operating partner. See which companies are actively benchmarking, what comps they\'re pulling, and where deal activity is concentrating across the portfolio. The visibility you needed without the awkward Friday afternoon CEO check-in.',
    bullets: [
      'Live activity feed of portfolio benchmarking sessions',
      'Per-company engagement metrics for LP reporting',
      'Therapeutic area heatmap showing deal-comp clustering',
      'Pooled seat management — reassign instantly as the portfolio evolves',
    ],
  },
  {
    icon: FileBarChart,
    eyebrow: 'Quarterly Portfolio Report',
    title: 'Your next LP letter, partially written by us.',
    description:
      'A bespoke benchmarking report assembled by the Ambrosia Ventures advisory team. Customized to the fund\'s specific portfolio composition. Includes a 2-page LP executive summary written for inclusion in your quarterly LP letter — saving the operating partner a week per quarter.',
    bullets: [
      'Portfolio-wide deal landscape with year-over-year trends',
      '5–10 most relevant comps per active portfolio company',
      'Market positioning analysis — flagging under-benchmarked programs',
      'LP executive summary suitable for inclusion in quarterly letters',
    ],
  },
  {
    icon: Network,
    eyebrow: 'Cross-Portfolio Partner Matching',
    title: 'When two portfolio companies chase the same partner, you\'ll know before they do.',
    description:
      'Ambrosia Ventures monitors deal flow across all portfolio companies and proactively identifies intra-portfolio synergies, competitive overlap, and warm partnering introductions — surfaced via monthly digest with ad hoc alerts for time-sensitive opportunities.',
    bullets: [
      'Intra-portfolio synergy detection (complementary assets, target overlap)',
      'Competitive overlap alerts when companies pursue the same partner',
      'Warm introduction pipeline via Ambrosia Ventures advisory network',
      'Each intro includes a brief deal thesis memo',
    ],
  },
  {
    icon: Bell,
    eyebrow: 'Deal Alert Feeds',
    title: 'Every relevant comp, the day it\'s filed — routed to the right portfolio company.',
    description:
      'Configurable per portfolio company by therapeutic area, modality, or development stage. Each alert includes an AI-generated relevance summary explaining why the transaction is comparable. Delivered as a consolidated weekly digest to the operating partner.',
    bullets: [
      'Per-company alert configuration with TA + modality tags',
      'Direct link to the full deal comp in the platform',
      'AI-generated 3-sentence relevance summary for every alert',
      'Consolidated weekly digest across the entire portfolio',
    ],
  },
];

// ---------------------------------------------------------------------------
// Data — The 16-feature framework (5 categories)
// ---------------------------------------------------------------------------

const featureFramework = [
  {
    category: 'Visibility & Coordination',
    eyebrow: 'Visibility',
    icon: Eye,
    description: 'Real-time portfolio intelligence — without the awkward CEO check-ins.',
    features: [
      { icon: LayoutDashboard, name: 'Admin Dashboard', desc: 'Live activity feed, engagement metrics, TA heatmap, seat management' },
      { icon: GitBranch, name: 'Cross-Portfolio Deal Pipeline Tracker', desc: 'Active deal conversations across the portfolio + conflict detection when two cos chase the same partner' },
      { icon: Network, name: 'Cross-Portfolio Partner Matching', desc: 'Synergies, overlap alerts, warm introductions via Ambrosia advisory network' },
    ],
  },
  {
    category: 'Intelligence Delivered',
    eyebrow: 'Intelligence',
    icon: FileBarChart,
    description: 'Bespoke content the operating partner ships forward — to LPs, boards, and portfolio CEOs.',
    features: [
      { icon: FileBarChart, name: 'Quarterly Portfolio Report', desc: 'LP-ready, bespoke per fund — assembled by the Ambrosia advisory team' },
      { icon: Palette, name: 'Fund-Branded White-Label Reports', desc: 'Every deliverable comes out with your fund\'s logo, color palette, and disclaimers' },
      { icon: Library, name: 'Shared Fund Comp Library', desc: 'Saved comp sets, peer sets, and annotations that compound across the fund' },
      { icon: BookOpen, name: 'Negotiation Playbook Library', desc: 'Term sheet templates and counter-proposal frameworks drawn from 2,500+ real deals' },
    ],
  },
  {
    category: 'Workflow & Alerts',
    eyebrow: 'Workflow',
    icon: Bell,
    description: 'Built into where operating partners actually work — no new tab required.',
    features: [
      { icon: Bell, name: 'Deal Alert Feeds', desc: 'Per-portfolio-company alerts with AI relevance summaries; weekly consolidated digest' },
      { icon: Filter, name: 'Custom Alert Rules', desc: 'Power-user filtering: "alert me when AstraZeneca does another bispecific deal"' },
      { icon: MessageSquare, name: 'Slack & Teams Integration', desc: 'Native push to where operating partners already live' },
    ],
  },
  {
    category: 'Concierge Service',
    eyebrow: 'Service',
    icon: UserCheck,
    description: 'Trusted advisor relationship, not a software vendor relationship.',
    features: [
      { icon: UserCheck, name: 'Dedicated Analyst Hours', desc: '4–20 hours/month of bespoke analyst time, delivered as fund-branded reports within 5 business days' },
      { icon: Briefcase, name: 'Portfolio Company Office Hours', desc: 'Quarterly 30-min slots with seasoned Ambrosia BD veterans — your portfolio CEOs get on-demand expertise' },
      { icon: Star, name: 'Annual Customer Summit', desc: 'Half-day curated event during JPM/BIO — operating partners only, peer roundtables, named pharma BD heads' },
    ],
  },
  {
    category: 'Enterprise Infrastructure',
    eyebrow: 'Infrastructure',
    icon: ShieldCheck,
    description: 'Built for procurement, IT, and legal review — not as an afterthought.',
    features: [
      { icon: Lock, name: 'SSO / SAML + Audit Logs', desc: 'Okta, Azure AD, Google Workspace. Per-seat audit logs. IP allowlisting.' },
      { icon: Code, name: 'API Access', desc: 'Read-only REST API for funds with internal data warehouses or custom dashboards' },
      { icon: ShieldCheck, name: 'Custom DPA + Security Docs', desc: 'Pre-built security questionnaire responses + biotech-VC-appropriate DPA template' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Data — Onboarding timeline & ROI anchors
// ---------------------------------------------------------------------------

const onboardingSteps = [
  { week: 'Week 1', title: 'Fund Setup', desc: 'Admin dashboard provisioned. Portfolio roster configured with TA tags. Seat allocation, SSO, and deal alert preferences set per company.' },
  { week: 'Week 2', title: 'Company Onboarding', desc: '30-minute walkthrough with each portfolio company\'s BD or C-suite lead. First deal comp report generated live to demonstrate immediate value.' },
  { week: 'Week 3', title: 'Partner Profiles', desc: 'Custom partner matching profiles built for each company. Cross-portfolio synergy scan completed. Deal alert feeds activated. Negotiation playbook library curated for your TAs.' },
  { week: 'Week 4', title: 'Baseline Report', desc: 'Initial portfolio benchmarking snapshot delivered. Operating partner review call to calibrate report cadence and analyst hour usage.' },
];

const roiAnchors = [
  { label: 'One BD analyst FTE (fully loaded annual cost)',                    cost: '~$240,000' },
  { label: 'One operating partner (fully loaded annual cost)',                 cost: '~$600,000' },
  { label: 'One annual Cortellis enterprise subscription',                     cost: '~$120,000+' },
  { label: 'Outside counsel for a single complex licensing deal',              cost: '~$75–100,000' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PortfolioPage() {
  // Structured data — Product schema with 3 tier offers
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Ambrosia Ventures Portfolio License',
    description: 'The deal intelligence layer for biotech and pharma VC firms. Multi-seat Pro access plus 16 fund-level capabilities: admin dashboard, quarterly portfolio benchmarking reports, fund-branded white-label deliverables, dedicated analyst hours, cross-portfolio partner matching, and enterprise infrastructure.',
    url: 'https://calculator.ambrosiaventures.co/portfolio',
    brand: { '@type': 'Organization', name: 'Ambrosia Ventures' },
    offers: [
      {
        '@type': 'Offer',
        name: 'Portfolio License — Growth',
        price: PORTFOLIO_PRICING.GROWTH_ANNUAL_NUM,
        priceCurrency: 'USD',
        priceValidUntil: '2026-12-31',
        availability: 'https://schema.org/InStock',
        description: '5 seats, billed annually. Full Pro per seat plus 16 fund-level capabilities.',
      },
      {
        '@type': 'Offer',
        name: 'Portfolio License — Scale',
        price: PORTFOLIO_PRICING.SCALE_ANNUAL_NUM,
        priceCurrency: 'USD',
        priceValidUntil: '2026-12-31',
        availability: 'https://schema.org/InStock',
        description: '10 seats, billed annually. Full Pro per seat, 10 hours/month dedicated analyst time, and 16 fund-level capabilities.',
      },
      {
        '@type': 'Offer',
        name: 'Portfolio License — Enterprise',
        price: PORTFOLIO_PRICING.ENTERPRISE_ANNUAL_NUM,
        priceCurrency: 'USD',
        priceValidUntil: '2026-12-31',
        availability: 'https://schema.org/InStock',
        description: '15+ seats, billed annually. Includes 20 hours/month dedicated analyst time, quarterly strategy call with Managing Partner, and 15% advisory preferred rates.',
      },
    ],
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://calculator.ambrosiaventures.co' },
      { '@type': 'ListItem', position: 2, name: 'Portfolio License', item: 'https://calculator.ambrosiaventures.co/portfolio' },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <main className="min-h-screen bg-[#0a0f1a]">

        {/* ═══════════════════════════════════════════════════════════════════
            HERO — Indigo/violet cinematic with admin dashboard mockup
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="relative pt-28 pb-24 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(99,102,241,0.18),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_85%_55%,rgba(139,92,246,0.10),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_15%_60%,rgba(13,148,136,0.05),transparent)]" />

          <div className="relative max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Left: Copy */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 mb-6">
                  <Crown className="w-3.5 h-3.5 text-indigo-300" />
                  <span className="text-xs font-semibold text-indigo-200 uppercase tracking-wider">Portfolio License</span>
                  <span className="px-1.5 py-0.5 text-[9px] font-bold text-violet-200 bg-violet-500/20 rounded-full border border-violet-500/30">New</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.05]">
                  The deal intelligence layer<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300">for biotech and pharma VCs.</span>
                </h1>

                <p className="mt-6 text-lg text-slate-400 leading-relaxed max-w-lg">
                  Pro for every portfolio company. Plus the fund-level intelligence layer your operating partner actually opens — quarterly benchmarking reports, dedicated analyst hours, cross-portfolio partner matching, and a live admin dashboard.
                </p>

                {/* Price + headline stats */}
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs text-slate-500 uppercase tracking-wider">From</span>
                      <span className="text-3xl font-bold text-white">{PORTFOLIO_PRICING.GROWTH_PER_SEAT}</span>
                      <span className="text-slate-500 text-sm">/seat/mo</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">5-seat Growth tier — annual billing</p>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-semibold bg-indigo-500/15 text-indigo-300 rounded-full border border-indigo-500/25">
                    16 fund-level capabilities
                  </span>
                </div>

                {/* CTAs */}
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <a
                    href={PORTFOLIO_DEMO_URL}
                    className="inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold text-base rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5 transition-all"
                  >
                    Schedule a Demo
                    <ArrowRight className="w-4 h-4" />
                  </a>
                  <Link
                    href="/pro"
                    className="inline-flex items-center gap-2 px-7 py-3.5 text-slate-300 font-medium rounded-xl hover:text-white hover:bg-white/5 transition-all border border-white/10"
                  >
                    View Pro features
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>

                {/* Trust row */}
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-indigo-400" /> Live in 4 weeks</span>
                  <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-indigo-400" /> Pooled seats — reassign anytime</span>
                  <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-indigo-400" /> {DEAL_STATS.TOTAL_DEALS} deals tracked</span>
                </div>
              </div>

              {/* Right: Admin Dashboard mockup */}
              <div className="hidden lg:block">
                <div className="bg-[#0d1420] border border-white/[0.06] rounded-2xl p-6 shadow-2xl shadow-indigo-950/40">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                      <span className="text-xs text-slate-400 font-medium">Atlas Bio Capital — Portfolio Dashboard</span>
                    </div>
                    <span className="text-[10px] text-indigo-400 font-mono">10 / 10 seats</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                      { label: 'Active Companies', value: '9', sub: '+2 vs LQ', color: 'text-indigo-300', bg: 'from-indigo-500/10 to-violet-500/10', border: 'border-indigo-500/25' },
                      { label: 'Comps Pulled', value: '347', sub: 'this month', color: 'text-white' },
                      { label: 'Deal Memos', value: '24', sub: 'generated', color: 'text-white' },
                      { label: 'Active Deals', value: '6', sub: 'in negotiation', color: 'text-fuchsia-300' },
                    ].map(kpi => (
                      <div key={kpi.label} className={`p-2.5 ${kpi.bg ? `bg-gradient-to-br ${kpi.bg} border ${kpi.border}` : 'bg-slate-800/40 border border-slate-700/50'} rounded-lg text-center`}>
                        <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">{kpi.label}</p>
                        <p className={`text-base font-bold font-mono ${kpi.color}`}>{kpi.value}</p>
                        <p className="text-[9px] text-slate-600 mt-0.5">{kpi.sub}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-800/20 rounded-lg border border-slate-700/40 p-3 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Live Activity</span>
                      <span className="text-[9px] text-indigo-400 font-mono">last 24h</span>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { co: 'NeuralPath Bio', action: 'Pulled 12 comps · Bispecific Ab', dot: 'bg-indigo-500' },
                        { co: 'CellGenix Therapeutics', action: 'Generated deal memo · $1.4B', dot: 'bg-violet-500' },
                        { co: 'OncoVista', action: 'Partner match · AstraZeneca 92%', dot: 'bg-fuchsia-500' },
                        { co: 'MetaboRx Sciences', action: 'rNPV model · Phase 2 GLP-1', dot: 'bg-indigo-500' },
                      ].map((a, i) => (
                        <div key={i} className="flex items-center gap-2 p-1.5 bg-white/[0.02] rounded">
                          <div className={`w-1 h-3.5 rounded-full ${a.dot}`} />
                          <span className="text-[10px] text-white font-medium flex-1 truncate">{a.co}</span>
                          <span className="text-[9px] text-slate-500 truncate">{a.action}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-800/20 rounded-lg border border-slate-700/40">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Therapeutic Area Concentration</p>
                    <div className="grid grid-cols-6 gap-1">
                      {[
                        { ta: 'Onc', heat: 0.95 }, { ta: 'Neu', heat: 0.6 }, { ta: 'Imm', heat: 0.75 },
                        { ta: 'Met', heat: 0.45 }, { ta: 'Rare', heat: 0.85 }, { ta: 'Card', heat: 0.3 },
                        { ta: 'Hem', heat: 0.55 }, { ta: 'Inf', heat: 0.25 }, { ta: 'Oph', heat: 0.4 },
                        { ta: 'Der', heat: 0.2 }, { ta: 'GI', heat: 0.35 }, { ta: 'WH', heat: 0.5 },
                      ].map(cell => (
                        <div
                          key={cell.ta}
                          className="p-1.5 rounded text-center border border-white/[0.04]"
                          style={{ backgroundColor: `rgba(99,102,241,${cell.heat * 0.35})` }}
                        >
                          <p className="text-[8px] font-semibold text-slate-300">{cell.ta}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] text-slate-600 mt-2">3 portfolio companies clustering in Oncology — coordination opportunity flagged</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            PROBLEM STATEMENT
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-20 px-4 border-t border-white/[0.04]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">The Problem</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.1]">
                Your portfolio companies are negotiating<br />
                every deal with one hand behind their back.
              </h2>
              <p className="mt-6 text-lg text-slate-400 max-w-3xl mx-auto leading-relaxed">
                They negotiate against anecdote, outdated databases, and outside counsel billing $1,500/hour for incomplete benchmarks.
                A single mispriced Phase 2 licensing deal costs <span className="text-white font-semibold">$5–20M in foregone upfront</span> —
                every quarter, in every TA, across every fund.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  icon: TrendingUp,
                  title: 'Below-market upfront — every time',
                  desc: 'No visibility into market-rate terms for their stage and TA. Companies accept upfronts 15–30% below comparable deals because they have no quantitative basis for counter-proposals.',
                },
                {
                  icon: BarChart3,
                  title: 'Milestone structures that leak NPV',
                  desc: 'Milestone allocations that undervalue clinical and regulatory achievements relative to comparable transactions — costing $2–8M in NPV per deal that nobody sees on the term sheet.',
                },
                {
                  icon: AlertTriangle,
                  title: '40+ wasted hours per deal',
                  desc: 'BD teams spend 40+ hours assembling manual comps from press releases and SEC filings instead of structuring the negotiation. Time is the most expensive line item.',
                },
              ].map(p => (
                <div key={p.title} className="p-6 bg-[#0d1420] border border-white/[0.06] rounded-xl hover:border-indigo-500/20 transition-all">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                    <p.icon className="w-5 h-5 text-amber-400" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{p.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>

            <p className="text-center text-sm text-slate-600 mt-10 max-w-2xl mx-auto">
              The Portfolio License costs less per year than <span className="text-indigo-400">one hour of outside counsel</span> at a top-tier life sciences law firm.
            </p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            FOUNDER VOICE — "Why we built this"
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-20 px-4 border-t border-white/[0.04] bg-[#080d16]">
          <div className="max-w-3xl mx-auto">
            <div className="relative p-8 sm:p-10 bg-gradient-to-br from-[#0d1420] to-[#0a1220] border border-white/[0.06] rounded-2xl overflow-hidden">
              <Quote className="absolute top-6 right-6 w-16 h-16 text-indigo-500/10" strokeWidth={1} />
              <div className="relative">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-5">
                  <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Why we built this</span>
                </div>
                <p className="text-lg sm:text-xl text-slate-200 leading-relaxed font-light">
                  &ldquo;I&apos;ve spent every quarter for the last three years watching portfolio companies leave money on the table because they didn&apos;t have benchmarks the partner across the table did. Outside counsel charges $15,000 per deal to assemble comps that take our platform 30 seconds. The Portfolio License is what I wanted at every fund I&apos;ve worked with — institutional deal intelligence as portfolio infrastructure, not as an expense line.&rdquo;
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
                    IK
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Issa Kildani</p>
                    <p className="text-xs text-slate-500">Managing Partner · Ambrosia Ventures</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            PER-SEAT PRO FEATURES
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-20 px-4 border-t border-white/[0.04]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 mb-5">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                <span className="text-xs font-semibold text-teal-300 uppercase tracking-wider">Per-Seat Access</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Every seat unlocks the full Pro platform</h2>
              <p className="mt-3 text-slate-500 max-w-xl mx-auto">
                14 calculation engines. 12 therapeutic areas. {DEAL_STATS.TOTAL_DEALS} transactions. No feature gates between portfolio companies.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              {[
                { icon: BarChart3, label: 'Deal Benchmarking',     sub: '2,500+ transactions' },
                { icon: LineChart, label: 'rNPV Modeling',         sub: 'TA-specific PoS curves' },
                { icon: Layers,    label: 'Monte Carlo',           sub: '10,000-iter simulations' },
                { icon: Brain,     label: 'AI Deal Memos',         sub: 'Institutional-quality' },
                { icon: Search,    label: 'Partner Matching',      sub: '850+ companies, 10-factor' },
                { icon: Users,     label: 'Buyer-Specific',        sub: 'Up to 3 buyers compared' },
                { icon: GitBranch, label: 'Scenario Analysis',     sub: 'Bear / Base / Bull' },
                { icon: FileDown,  label: 'Branded PDFs',          sub: 'White-labeled exports' },
              ].map(f => (
                <div key={f.label} className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:border-teal-500/20 hover:bg-white/[0.04] transition-all">
                  <f.icon className="w-4 h-4 text-teal-400 mb-2" />
                  <p className="text-sm font-semibold text-white">{f.label}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{f.sub}</p>
                </div>
              ))}
            </div>

            <div className="text-center">
              <Link href="/pro" className="inline-flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300 font-medium">
                See all Pro features in detail
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            FUND-LEVEL INTELLIGENCE LAYER — marquee 4 + framework grid
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-24 px-4 border-t border-white/[0.04] bg-[#080d16] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_20%_30%,rgba(99,102,241,0.07),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_80%_70%,rgba(139,92,246,0.07),transparent)]" />

          <div className="relative max-w-6xl mx-auto">
            <div className="text-center mb-20">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-indigo-500/20 mb-6">
                <Crown className="w-3.5 h-3.5 text-indigo-300" />
                <span className="text-xs font-semibold text-indigo-200 uppercase tracking-wider">Portfolio Exclusive</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.1]">
                What the operating<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300">partner gets.</span>
              </h2>
              <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                <span className="text-white font-semibold">16 capabilities</span> your portfolio companies will never see —
                the reason operating partners renew. Organized in five categories, each addressing
                a specific pain point operating partners deal with daily.
              </p>
            </div>

            {/* Marquee 4 — deep mockups */}
            <div className="space-y-20 mb-24">
              {marqueeFundFeatures.map((f, i) => {
                const isReversed = i % 2 === 1;
                return (
                  <div key={f.title} className="grid lg:grid-cols-2 gap-12 items-center">
                    <div className={isReversed ? 'order-1 lg:order-2' : ''}>
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/25 rounded-full mb-4">
                        <f.icon className="w-3.5 h-3.5 text-indigo-300" />
                        <span className="text-xs text-indigo-200 font-medium uppercase tracking-wider">{f.eyebrow}</span>
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4 leading-tight">{f.title}</h3>
                      <p className="text-slate-400 leading-relaxed mb-5">{f.description}</p>
                      <ul className="space-y-2.5">
                        {f.bullets.map(b => (
                          <li key={b} className="flex items-start gap-2.5 text-sm text-slate-400">
                            <Check className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className={isReversed ? 'order-2 lg:order-1' : ''}>
                      <FeatureMockup type={f.eyebrow} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Divider */}
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-violet-500/20 mb-5">
                <Sparkles className="w-3.5 h-3.5 text-violet-300" />
                <span className="text-xs font-semibold text-violet-200 uppercase tracking-wider">Plus 12 more fund-level capabilities</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Five categories. Every operating partner pain point.
              </h3>
              <p className="mt-4 text-slate-500 max-w-2xl mx-auto leading-relaxed">
                We started with the four most-asked-for features. Then we built twelve more — to make Portfolio License the only deal intelligence platform sophisticated VC firms need.
              </p>
            </div>

            {/* The 5 category cards */}
            <div className="space-y-6">
              {featureFramework.map(cat => (
                <CategoryCard key={cat.category} category={cat} />
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            TRUSTED INFRASTRUCTURE — credibility anchor
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-20 px-4 border-t border-white/[0.04]">
          <div className="max-w-5xl mx-auto">
            <div className="p-8 sm:p-12 bg-[#0d1420] border border-white/[0.06] rounded-2xl">
              <div className="grid lg:grid-cols-3 gap-8 items-center">
                <div className="lg:col-span-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 mb-5">
                    <Shield className="w-3.5 h-3.5 text-teal-400" />
                    <span className="text-xs font-semibold text-teal-300 uppercase tracking-wider">Trusted Infrastructure</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 leading-tight">
                    Built on the platform used by <span className="text-teal-400">850+ biopharma BD professionals.</span>
                  </h2>
                  <p className="text-slate-400 leading-relaxed">
                    Portfolio License is the multi-seat extension of the Ambrosia Ventures Deal Calculator —
                    the same database, same engines, same {DEAL_STATS.TOTAL_DEALS} transactions trusted by individual BD pros at every major biotech and pharma.
                    Your portfolio companies aren&apos;t getting a separate product — they&apos;re getting the institutional version of what their counterparts at Pfizer, Merck, and Sanofi already use.
                  </p>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                  {[
                    { stat: DEAL_STATS.TOTAL_DEALS, label: 'Verified transactions' },
                    { stat: '850+', label: 'BD pros on platform' },
                    { stat: '12 TAs', label: 'Therapeutic areas covered' },
                    { stat: '14', label: 'Calculation engines' },
                  ].map(s => (
                    <div key={s.label} className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                      <p className="text-2xl font-bold font-mono text-teal-400">{s.stat}</p>
                      <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            PRICING TABLE — 3 tiers
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-24 px-4 border-t border-white/[0.04] bg-[#080d16]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Pricing built for fund stage</h2>
              <p className="mt-3 text-slate-500 max-w-xl mx-auto">
                All tiers include all 16 fund-level capabilities. Annual billing required.
                Tier differences are seat count and dedicated analyst hours.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <PricingCard
                tier="Growth"
                tagline="For emerging managers"
                seats={`${PORTFOLIO_PRICING.GROWTH_SEATS} seats`}
                monthly={PORTFOLIO_PRICING.GROWTH_MONTHLY}
                annual={PORTFOLIO_PRICING.GROWTH_ANNUAL}
                perSeat={PORTFOLIO_PRICING.GROWTH_PER_SEAT}
                extraSeat={PORTFOLIO_PRICING.GROWTH_EXTRA_SEAT}
                analystHours={PORTFOLIO_PRICING.GROWTH_ANALYST_HOURS}
                description="Built for Fund I–II biotech VCs. Equip your first 5 portfolio companies for less than 10% of an analyst FTE."
                highlight={false}
              />

              <PricingCard
                tier="Scale"
                tagline="For active mid-stage funds"
                seats={`${PORTFOLIO_PRICING.SCALE_SEATS} seats`}
                monthly={PORTFOLIO_PRICING.SCALE_MONTHLY}
                annual={PORTFOLIO_PRICING.SCALE_ANNUAL}
                perSeat={PORTFOLIO_PRICING.SCALE_PER_SEAT}
                extraSeat={PORTFOLIO_PRICING.SCALE_EXTRA_SEAT}
                analystHours={PORTFOLIO_PRICING.SCALE_ANALYST_HOURS}
                description="For mid-stage funds actively coordinating partnering across 8–12 portfolio companies. The institutional standard."
                highlight={true}
              />

              <PricingCard
                tier="Enterprise"
                tagline="For institutional funds & CVCs"
                seats={`${PORTFOLIO_PRICING.ENTERPRISE_SEATS} seats`}
                monthly={PORTFOLIO_PRICING.ENTERPRISE_MONTHLY}
                annual={PORTFOLIO_PRICING.ENTERPRISE_ANNUAL}
                perSeat={PORTFOLIO_PRICING.ENTERPRISE_PER_SEAT}
                extraSeat={PORTFOLIO_PRICING.ENTERPRISE_EXTRA_SEAT}
                analystHours={PORTFOLIO_PRICING.ENTERPRISE_ANALYST_HOURS}
                description="For institutional funds and pharma CVCs with deep portfolios. Includes quarterly Managing Partner strategy call and 15% advisory preferred rates."
                highlight={false}
                enterpriseExtras
              />
            </div>

            <p className="text-center text-xs text-slate-600 mt-8 max-w-2xl mx-auto">
              Pooled seats — reassign across portfolio companies at any time.
              Custom seat counts available for funds with 20+ portfolio companies.
              Dedicated analyst hours roll over within the contract year.
            </p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            ROI FRAMEWORK
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-24 px-4 border-t border-white/[0.04]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">The Math</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.1]">
                Earn it back on a single<br />
                milestone payment.
              </h2>
              <p className="mt-5 text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
                The Scale tier costs $60,000/year. A single Phase 2 licensing deal carries $200–500M in total deal value across upfront, milestones, and royalties.
                The math is unkind to anyone choosing the alternative.
              </p>
            </div>

            {/* Core ROI table */}
            <div className="bg-[#0d1420] border border-white/[0.06] rounded-2xl overflow-hidden mb-10">
              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.05]">
                {[
                  { label: 'Annual cost (Scale tier, 10 seats)',                            value: '$60,000',      color: 'text-white' },
                  { label: 'Average Phase 2 total deal value (incl. milestones)',           value: '$200–500M',    color: 'text-white' },
                  { label: 'Improvement needed to break even',                              value: '0.012–0.030%', color: 'text-amber-400' },
                  { label: 'Realistic deal optimization with better benchmarks',            value: '$5–20M+',      color: 'text-emerald-400' },
                ].map(row => (
                  <div key={row.label} className="p-6 sm:p-8">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{row.label}</p>
                    <p className={`text-3xl sm:text-4xl font-bold font-mono ${row.color}`}>{row.value}</p>
                  </div>
                ))}
              </div>
              <div className="p-6 sm:p-8 bg-gradient-to-r from-indigo-500/5 via-violet-500/10 to-fuchsia-500/5 border-t border-indigo-500/15">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-1">Implied ROI</p>
                    <p className="text-4xl sm:text-5xl font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-fuchsia-300">83–333x</p>
                  </div>
                  <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
                    Doesn&apos;t account for reduced outside counsel hours
                    ($15–25K per transaction), faster deal timelines, or improved LP reporting.
                  </p>
                </div>
              </div>
            </div>

            {/* Comparison anchoring */}
            <div className="bg-[#0d1420] border border-white/[0.06] rounded-2xl p-8">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">What $60,000/year is also less than</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {roiAnchors.map(a => (
                  <div key={a.label} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.05] rounded-lg">
                    <span className="text-sm text-slate-300 flex-1 pr-3">{a.label}</span>
                    <span className="text-sm font-mono font-bold text-emerald-400">{a.cost}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-600 mt-5 leading-relaxed">
                Replaces a category of spending biotech VCs already make — at less than half the price of comparable enterprise platforms (Cortellis, Evaluate Pharma, Capital IQ),
                <span className="text-slate-400"> with deeper deal-mechanics specialization than any of them.</span>
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            TIER COMPARISON TABLE
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-24 px-4 border-t border-white/[0.04] bg-[#080d16]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white">Compare every tier</h2>
              <p className="mt-3 text-slate-500">Pro is for the dealmaker. Portfolio is built for the firm.</p>
            </div>

            <div className="bg-[#0d1420] border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="grid grid-cols-5 text-xs font-semibold border-b border-white/[0.06]">
                <div className="px-3 sm:px-4 py-4 text-slate-500">Feature</div>
                <div className="px-3 sm:px-4 py-4 text-center text-slate-500">
                  <div>Pro</div>
                  <div className="text-[10px] text-slate-600 font-normal mt-0.5">{PRICING.PRO_PRICE}/mo</div>
                </div>
                <div className="px-3 sm:px-4 py-4 text-center text-indigo-300">
                  <div>Growth</div>
                  <div className="text-[10px] text-slate-600 font-normal mt-0.5">{PORTFOLIO_PRICING.GROWTH_MONTHLY}/mo</div>
                </div>
                <div className="px-3 sm:px-4 py-4 text-center text-violet-300 bg-indigo-500/5">
                  <div>Scale</div>
                  <div className="text-[10px] text-slate-600 font-normal mt-0.5">{PORTFOLIO_PRICING.SCALE_MONTHLY}/mo</div>
                </div>
                <div className="px-3 sm:px-4 py-4 text-center text-fuchsia-300">
                  <div>Enterprise</div>
                  <div className="text-[10px] text-slate-600 font-normal mt-0.5">{PORTFOLIO_PRICING.ENTERPRISE_MONTHLY}/mo</div>
                </div>
              </div>

              {tierComparison.map((row, i) => {
                const isFirstInGroup = !!row.group;
                return (
                  <div key={row.feature}>
                    {isFirstInGroup && (
                      <div className="grid grid-cols-5 bg-indigo-500/[0.04] border-b border-white/[0.04]">
                        <div className="col-span-5 px-3 sm:px-4 py-2.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">{row.group}</span>
                        </div>
                      </div>
                    )}
                    <div className={`grid grid-cols-5 text-sm ${i < tierComparison.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                      <div className="px-3 sm:px-4 py-3.5 text-slate-300 font-medium text-xs sm:text-sm">{row.feature}</div>
                      <CompareCell value={row.pro} accent="slate" />
                      <CompareCell value={row.growth} accent="indigo" />
                      <CompareCell value={row.scale} accent="violet" highlighted />
                      <CompareCell value={row.enterprise} accent="fuchsia" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            IMPLEMENTATION TIMELINE
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-24 px-4 border-t border-white/[0.04]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-5">
                <Calendar className="w-3.5 h-3.5 text-indigo-300" />
                <span className="text-xs font-semibold text-indigo-200 uppercase tracking-wider">Implementation</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">From contract signed to first quarterly report — 30 days.</h2>
              <p className="mt-3 text-slate-500 max-w-xl mx-auto">
                Dedicated white-glove onboarding for the operating partner and every portfolio company.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {onboardingSteps.map((step, i) => (
                <div key={step.week} className="relative p-6 bg-[#0d1420] border border-white/[0.06] rounded-xl hover:border-indigo-500/30 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center">
                      <span className="text-sm font-bold text-indigo-300">{i + 1}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">{step.week}</span>
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            DATA & SECURITY
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-24 px-4 border-t border-white/[0.04] bg-[#080d16]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Data &amp; Security</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Information barriers between every portfolio company</h2>
              <p className="mt-3 text-slate-500 max-w-2xl mx-auto">
                Every portfolio company seat is isolated. The admin dashboard shows aggregate activity only —
                never individual search queries or proprietary analysis.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { icon: Lock,         title: 'Seat Isolation',         desc: 'Company A cannot view Company B\'s searches, saved comps, or deal memos. Hard partition at every layer.' },
                { icon: Server,       title: 'Encryption Everywhere',  desc: 'AES-256 encryption at rest, TLS 1.3 in transit. Hosted on Vercel with Supabase backend.' },
                { icon: ShieldCheck,  title: 'SOC 2 + Custom DPA',     desc: 'SOC 2 Type I roadmap in progress. Pre-built security questionnaire responses + biotech-VC-appropriate DPA template.' },
                { icon: FileBarChart, title: 'Data Portability',       desc: 'All portfolio company data exportable on request. 90-day post-termination retention with full export support.' },
              ].map(s => (
                <div key={s.title} className="p-5 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:border-emerald-500/15 transition-all">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
                    <s.icon className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1.5">{s.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 p-5 bg-[#0d1420] border border-white/[0.06] rounded-xl">
              <p className="text-xs text-slate-500 leading-relaxed">
                <span className="text-slate-300 font-semibold">Database integrity:</span> {DEAL_STATS.TOTAL_DEALS} verified biopharma licensing,
                partnering, and M&amp;A transactions sourced from SEC 8-K filings, FTC premerger filings, press releases,
                clinical trial registries, and proprietary Ambrosia Ventures deal intelligence. New transactions added within
                5 business days of public disclosure.
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            PART OF A LARGER VISION — forward-looking platform story
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-24 px-4 border-t border-white/[0.04]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 mb-5">
                <Sparkles className="w-3.5 h-3.5 text-violet-300" />
                <span className="text-xs font-semibold text-violet-200 uppercase tracking-wider">Part of a Larger Vision</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-[1.15]">
                Portfolio License is the first piece<br />
                of a four-platform intelligence stack.
              </h2>
              <p className="mt-5 text-slate-400 max-w-2xl mx-auto leading-relaxed">
                Ambrosia Benchmarker is one of four specialized platforms Ambrosia Ventures is building for biotech investors.
                All four feed into <span className="text-violet-300 font-semibold">Alaric</span> — the AI orchestration layer that turns specialized
                data into integrated portfolio intelligence.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                {
                  name: 'Benchmarker',
                  status: 'Live',
                  desc: 'Deal terms, benchmarking, partnering, valuation. The platform Portfolio License is built on.',
                  color: 'border-indigo-500/40 bg-indigo-500/5',
                  accentColor: 'text-indigo-300',
                  badgeColor: 'bg-indigo-500/20 text-indigo-200 border-indigo-500/30',
                },
                {
                  name: 'Terrain',
                  status: 'Live',
                  desc: 'Market intelligence, clinical/regulatory event monitoring, competitive pipeline tracking.',
                  color: 'border-teal-500/30 bg-teal-500/5',
                  accentColor: 'text-teal-300',
                  badgeColor: 'bg-teal-500/20 text-teal-200 border-teal-500/30',
                },
                {
                  name: 'Investor Outcomes',
                  status: 'Q3 2026',
                  desc: 'Mark-to-market portfolio valuation, value-add attribution, LP reporting suite.',
                  color: 'border-violet-500/30 bg-violet-500/5',
                  accentColor: 'text-violet-300',
                  badgeColor: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
                },
                {
                  name: 'IP Map',
                  status: 'Q4 2026',
                  desc: 'Patent landscape monitoring, IP risk analysis, freedom-to-operate intelligence.',
                  color: 'border-fuchsia-500/30 bg-fuchsia-500/5',
                  accentColor: 'text-fuchsia-300',
                  badgeColor: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/25',
                },
              ].map(p => (
                <div key={p.name} className={`p-6 border ${p.color} rounded-xl`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`text-lg font-bold ${p.accentColor}`}>{p.name}</h3>
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${p.badgeColor}`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>

            {/* Alaric anchor */}
            <div className="relative p-8 bg-gradient-to-br from-indigo-500/10 via-violet-500/10 to-fuchsia-500/10 border border-violet-500/25 rounded-2xl text-center overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(139,92,246,0.15),transparent)]" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 mb-4">
                  <Brain className="w-3.5 h-3.5 text-violet-200" />
                  <span className="text-xs font-bold text-violet-200 uppercase tracking-wider">Alaric · 2027</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight">
                  The AI orchestration layer above all four platforms.
                </h3>
                <p className="text-sm text-slate-300 max-w-2xl mx-auto leading-relaxed">
                  Alaric synthesizes deal intelligence, market intelligence, fund performance, and IP intelligence into one fund situation report.
                  One-click IC packs. Cross-platform buyer dossiers. Weekly AI-generated portfolio briefings.
                  <span className="text-white font-semibold"> Portfolio License accounts get priority access and preferred bundle pricing as new platforms launch.</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            BOTTOM CTA
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-24 px-4 border-t border-white/[0.04] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(99,102,241,0.15),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_100%,rgba(139,92,246,0.10),transparent)]" />

          <div className="relative max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.1]">
              From contract signed to first<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300">quarterly report — 30 days.</span>
            </h2>
            <p className="mt-6 text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
              15-minute demo with a personalized walkthrough using comps relevant to your portfolio&apos;s lead programs.
              Onboarding begins within 5 business days of executed agreement.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={PORTFOLIO_DEMO_URL}
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold text-lg rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5 transition-all"
              >
                Schedule a Demo
                <ArrowRight className="w-5 h-5" />
              </a>
              <a
                href="mailto:issa@ambrosiaventures.co"
                className="inline-flex items-center gap-2 px-8 py-4 text-slate-300 font-medium rounded-xl hover:text-white hover:bg-white/5 transition-all border border-white/10"
              >
                <Mail className="w-4 h-4" />
                issa@ambrosiaventures.co
              </a>
            </div>

            <p className="mt-8 text-sm text-slate-600">
              Issa Kildani · Managing Partner · Ambrosia Ventures
            </p>
          </div>
        </section>

      </main>
      <SiteFooter />
    </>
  );
}

// ---------------------------------------------------------------------------
// Pricing Card
// ---------------------------------------------------------------------------

interface PricingCardProps {
  tier: string;
  tagline: string;
  seats: string;
  monthly: string;
  annual: string;
  perSeat: string;
  extraSeat: string;
  analystHours: string;
  description: string;
  highlight: boolean;
  enterpriseExtras?: boolean;
}

function PricingCard({ tier, tagline, seats, monthly, annual, perSeat, extraSeat, analystHours, description, highlight, enterpriseExtras }: PricingCardProps) {
  const baseIncludes: React.ReactNode[] = [
    'All 16 fund-level capabilities',
    'Pro platform per seat (unlimited)',
    <span key="hours"><span className="font-semibold text-indigo-300">{analystHours}</span> dedicated analyst time</span>,
    'Quarterly portfolio benchmarking report',
    'Fund-branded white-label reports',
    'SSO/SAML, audit logs, custom DPA',
    'Dedicated 4-week onboarding',
  ];

  const enterpriseAdditions: React.ReactNode[] = enterpriseExtras
    ? [
        <span key="strategy"><span className="font-semibold text-fuchsia-300">Quarterly strategy call</span> with Managing Partner</span>,
        '15% discount on Ambrosia Ventures advisory',
        '2-hour strategic assessment per portfolio company',
      ]
    : [];

  const includes = [...baseIncludes, ...enterpriseAdditions];

  return (
    <div
      className={`relative p-6 sm:p-7 rounded-2xl flex flex-col ${
        highlight
          ? 'bg-gradient-to-b from-[#11182a] to-[#0d1420] border-2 border-indigo-500/40 shadow-2xl shadow-indigo-500/15'
          : 'bg-[#0d1420] border border-white/[0.06]'
      }`}
    >
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-md shadow-indigo-500/30">
            <Sparkles className="w-3 h-3" />
            Most Popular
          </span>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className={`text-xl font-bold ${highlight ? 'text-white' : 'text-slate-200'}`}>{tier}</h3>
          <span className={`text-xs font-semibold ${highlight ? 'text-indigo-300' : 'text-slate-500'}`}>{seats}</span>
        </div>
        <p className={`text-[11px] uppercase tracking-wider font-semibold mb-2 ${highlight ? 'text-indigo-300' : 'text-slate-600'}`}>{tagline}</p>
        <p className="text-xs text-slate-500 leading-relaxed mb-5">{description}</p>

        {/* Price */}
        <div className="mb-5 pb-5 border-b border-white/[0.05]">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-bold text-white">{monthly}</span>
            <span className="text-sm text-slate-500">/mo</span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            <span className="text-slate-400">{annual}</span> billed annually
          </p>
          <div className="mt-3 flex items-center gap-2 text-[11px]">
            <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 rounded border border-indigo-500/20 font-medium">{perSeat}/seat/mo</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">+{extraSeat}/seat/mo additional</span>
          </div>
        </div>

        {/* Includes */}
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Every tier includes</p>
        <ul className="space-y-2 mb-6">
          {includes.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs text-slate-400">
              <Check className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${highlight ? 'text-indigo-400' : 'text-slate-500'}`} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA pinned to bottom */}
      <div className="mt-auto pt-2">
        <a
          href={PORTFOLIO_DEMO_URL}
          className={`flex items-center justify-center gap-2 w-full px-5 py-3 font-semibold text-sm rounded-lg transition-all ${
            highlight
              ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5'
              : 'bg-white/[0.04] text-white border border-white/10 hover:bg-white/[0.08] hover:border-indigo-500/40'
          }`}
        >
          Schedule a Demo
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comparison cell
// ---------------------------------------------------------------------------

interface CompareCellProps {
  value: string | boolean;
  accent: 'slate' | 'indigo' | 'violet' | 'fuchsia';
  highlighted?: boolean;
}

function CompareCell({ value, accent, highlighted }: CompareCellProps) {
  const accentColor = {
    slate: 'text-slate-500',
    indigo: 'text-indigo-400',
    violet: 'text-violet-400',
    fuchsia: 'text-fuchsia-400',
  }[accent];

  return (
    <div className={`px-3 sm:px-4 py-3.5 text-center flex items-center justify-center ${highlighted ? 'bg-indigo-500/[0.04]' : ''}`}>
      {value === true ? (
        <Check className={`w-4 h-4 ${accentColor}`} />
      ) : value === false ? (
        <span className="text-slate-700 text-xs">—</span>
      ) : (
        <span className="text-slate-200 text-[11px] sm:text-xs font-medium">{value}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category Card — for the 5-category framework grid
// ---------------------------------------------------------------------------

interface CategoryCardProps {
  category: {
    category: string;
    eyebrow: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
    features: Array<{
      icon: React.ComponentType<{ className?: string }>;
      name: string;
      desc: string;
    }>;
  };
}

function CategoryCard({ category }: CategoryCardProps) {
  const Icon = category.icon;
  return (
    <div className="bg-[#0d1420] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-indigo-500/20 transition-all">
      <div className="grid lg:grid-cols-3">
        {/* Left: Category header */}
        <div className="p-6 lg:p-7 lg:border-r border-b lg:border-b-0 border-white/[0.05] bg-gradient-to-br from-indigo-500/[0.05] to-violet-500/[0.03]">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/25 rounded-full mb-4">
            <Icon className="w-3.5 h-3.5 text-indigo-300" />
            <span className="text-xs text-indigo-200 font-medium uppercase tracking-wider">{category.eyebrow}</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2 leading-tight">{category.category}</h3>
          <p className="text-xs text-slate-500 leading-relaxed">{category.description}</p>
          <p className="mt-4 text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">{category.features.length} capabilit{category.features.length === 1 ? 'y' : 'ies'}</p>
        </div>

        {/* Right: Feature list */}
        <div className="lg:col-span-2 p-5 lg:p-7">
          <div className="space-y-3">
            {category.features.map(f => {
              const FIcon = f.icon;
              return (
                <div key={f.name} className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg hover:border-indigo-500/15 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <FIcon className="w-3.5 h-3.5 text-indigo-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white mb-0.5">{f.name}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feature mockups (one per Fund-Level Intelligence feature)
// ---------------------------------------------------------------------------

function FeatureMockup({ type }: { type: string }) {
  if (type === 'Admin Dashboard') {
    return (
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-2xl p-5 shadow-2xl shadow-indigo-950/30">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Operating Partner View</span>
          <span className="text-[10px] text-indigo-400 font-mono">Q2 2026</span>
        </div>

        <div className="space-y-2">
          {[
            { co: 'OncoVista', sessions: 18, comps: 87, memos: 4, status: 'high' },
            { co: 'NeuralPath Bio', sessions: 12, comps: 54, memos: 3, status: 'high' },
            { co: 'CellGenix', sessions: 9, comps: 41, memos: 2, status: 'med' },
            { co: 'MetaboRx', sessions: 7, comps: 32, memos: 2, status: 'med' },
            { co: 'DermaCore', sessions: 4, comps: 18, memos: 1, status: 'low' },
            { co: 'CardioPath', sessions: 2, comps: 9, memos: 0, status: 'low' },
          ].map(c => (
            <div key={c.co} className="grid grid-cols-12 gap-2 items-center p-2.5 bg-white/[0.02] border border-white/[0.04] rounded-lg">
              <span className={`col-span-1 w-1.5 h-1.5 rounded-full ${c.status === 'high' ? 'bg-indigo-400' : c.status === 'med' ? 'bg-violet-400/60' : 'bg-slate-600'}`} />
              <span className="col-span-4 text-[11px] font-medium text-white truncate">{c.co}</span>
              <div className="col-span-7 grid grid-cols-3 gap-1 text-center">
                <div>
                  <p className="text-[9px] text-slate-600">sessions</p>
                  <p className="text-[10px] font-mono text-slate-300">{c.sessions}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-600">comps</p>
                  <p className="text-[10px] font-mono text-slate-300">{c.comps}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-600">memos</p>
                  <p className="text-[10px] font-mono text-indigo-400">{c.memos}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-2.5 bg-indigo-500/5 border border-indigo-500/15 rounded-lg flex items-center justify-between">
          <span className="text-[10px] text-slate-400">Total portfolio engagement (30d)</span>
          <span className="text-[11px] font-mono font-bold text-indigo-300">52 sessions · 241 comps</span>
        </div>
      </div>
    );
  }

  if (type === 'Quarterly Portfolio Report') {
    return (
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-2xl p-5 shadow-2xl shadow-indigo-950/30">
        <div className="flex items-start gap-3 mb-4 pb-4 border-b border-white/[0.05]">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
            <FileBarChart className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Q2 2026 · Portfolio Benchmarking Report</p>
            <p className="text-sm font-bold text-white">Atlas Bio Capital</p>
            <p className="text-[10px] text-slate-600">Prepared by Ambrosia Ventures · 24 pages</p>
          </div>
        </div>

        <div className="space-y-2.5 mb-4">
          {[
            'Portfolio-Wide Deal Landscape (Q2 2026)',
            'Company-Specific Benchmarks (9 active companies)',
            'Market Positioning Analysis',
            'LP Executive Summary',
          ].map((s, i) => (
            <div key={s} className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[9px] font-bold text-indigo-400 flex-shrink-0">{i + 1}</span>
              <span className="text-[11px] text-slate-300">{s}</span>
            </div>
          ))}
        </div>

        <div className="p-3 bg-slate-800/20 rounded-lg border border-slate-700/40 mb-3">
          <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Upfront % of Total Deal — Portfolio vs Market</p>
          <div className="space-y-1.5">
            {[
              { co: 'OncoVista (P2)', portfolio: 75 },
              { co: 'NeuralPath (P1)', portfolio: 45 },
              { co: 'CellGenix (P3)', portfolio: 80 },
            ].map(b => (
              <div key={b.co}>
                <div className="flex justify-between text-[9px] text-slate-500 mb-0.5">
                  <span>{b.co}</span>
                  <span className="font-mono">{b.portfolio}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${b.portfolio}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-2.5 bg-amber-500/5 border border-amber-500/15 rounded-lg">
          <p className="text-[10px] text-amber-300">
            <span className="font-semibold">⚠ Flagged:</span> NeuralPath upfront tracking 17pts below market for Phase 1 neuro deals.
          </p>
        </div>
      </div>
    );
  }

  if (type === 'Cross-Portfolio Partner Matching') {
    return (
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-2xl p-5 shadow-2xl shadow-indigo-950/30">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Cross-Portfolio Intelligence</span>
          <span className="text-[10px] text-violet-400 font-mono">3 alerts</span>
        </div>

        <div className="mb-3 p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-lg">
          <div className="flex items-start gap-2">
            <Network className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wider mb-1">Intra-Portfolio Synergy</p>
              <p className="text-[11px] text-white font-medium">OncoVista + CellGenix</p>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                Complementary ADC payload + cell therapy delivery platform. Co-development opportunity.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-3 p-3 bg-amber-500/5 border border-amber-500/15 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider mb-1">Competitive Overlap</p>
              <p className="text-[11px] text-white font-medium">3 companies pursuing AstraZeneca</p>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                OncoVista, MetaboRx, and CellGenix all targeting AZN BD. Coordination recommended.
              </p>
            </div>
          </div>
        </div>

        <div className="p-3 bg-indigo-500/5 border border-indigo-500/15 rounded-lg">
          <div className="flex items-start gap-2">
            <Users className="w-3.5 h-3.5 text-indigo-300 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wider mb-1">Warm Intro Available</p>
              <p className="text-[11px] text-white font-medium">NeuralPath Bio → Roche Neurology</p>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                Roche head of Neuroscience BD warm to bispecific antibody platforms. Thesis memo attached.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Deal Alert Feeds
  return (
    <div className="bg-[#0d1420] border border-white/[0.06] rounded-2xl p-5 shadow-2xl shadow-indigo-950/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-indigo-300" />
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Weekly Digest · Apr 8</span>
        </div>
        <span className="text-[10px] text-indigo-400 font-mono">12 alerts</span>
      </div>

      <div className="space-y-2">
        {[
          { co: 'OncoVista', alert: 'Pfizer / Vanguard Bio · ADC · P2', value: '$2.1B', match: '94% match' },
          { co: 'NeuralPath', alert: 'Roche / Acelyrin · Bispecific · P1', value: '$840M', match: '89% match' },
          { co: 'CellGenix', alert: 'Novartis / CellGenix Tx · CAR-T · P3', value: '$3.4B', match: '87% match' },
          { co: 'MetaboRx', alert: 'Eli Lilly / Camurus · GLP-1 · P2', value: '$1.6B', match: '82% match' },
        ].map((a, i) => (
          <div key={i} className="p-2.5 bg-white/[0.02] border border-white/[0.05] rounded-lg hover:border-indigo-500/20 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-indigo-300">→ {a.co}</span>
              <span className="text-[10px] text-indigo-400 font-mono">{a.match}</span>
            </div>
            <p className="text-[11px] text-white truncate">{a.alert}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[9px] text-slate-600">AI relevance: same TA + adjacent modality + earlier stage</span>
              <span className="text-[10px] font-mono font-bold text-indigo-400">{a.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center justify-between">
        <span className="text-[9px] text-slate-600">Configurable per portfolio company</span>
        <span className="text-[9px] text-indigo-400 font-medium">View all →</span>
      </div>
    </div>
  );
}
