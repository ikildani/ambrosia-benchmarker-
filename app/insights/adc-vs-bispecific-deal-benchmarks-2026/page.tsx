import { Metadata } from 'next';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { KeyTakeaways } from '@/components/insights/KeyTakeaways';
import { TrustBar } from '@/components/insights/TrustBar';
import { AuthorByline } from '@/components/insights/AuthorByline';
import { InsightCTA } from '@/components/insights/InsightCTA';
import { InsightEmailCapture } from '@/components/insights/InsightEmailCapture';
import { RelatedInsights } from '@/components/insights/RelatedInsights';
import { GatedBenchmarkTable } from '@/components/insights/GatedBenchmarkTable';
import { DEAL_STATS } from '@/lib/config/constants';

const ChartSkeleton = () => (
  <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
    <div className="h-64 sm:h-80 flex items-end gap-2 px-8 pb-8 animate-pulse">
      {[35, 50, 65, 80, 95].map((h, i) => (
        <div key={i} className="flex-1 bg-slate-100 rounded-t" style={{ height: `${h}%` }} />
      ))}
    </div>
  </div>
);

const PhaseUpfrontChart = dynamic(
  () => import('@/components/insights/PhaseUpfrontChart').then(m => ({ default: m.PhaseUpfrontChart })),
  { loading: () => <ChartSkeleton /> }
);
const TrendLineChart = dynamic(
  () => import('@/components/insights/TrendLineChart').then(m => ({ default: m.TrendLineChart })),
  { loading: () => <ChartSkeleton /> }
);
const WaterfallChart = dynamic(
  () => import('@/components/insights/WaterfallChart').then(m => ({ default: m.WaterfallChart })),
  { loading: () => <ChartSkeleton /> }
);
const MiniCalculator = dynamic(() => import('@/components/insights/MiniCalculator').then(m => ({ default: m.MiniCalculator })));
const InlineEmailCapture = dynamic(() => import('@/components/insights/InlineEmailCapture').then(m => ({ default: m.InlineEmailCapture })));
const ScrollProgress = dynamic(() => import('@/components/insights/ScrollProgress').then(m => ({ default: m.ScrollProgress })));
const CiteThisData = dynamic(() => import('@/components/insights/CiteThisData').then(m => ({ default: m.CiteThisData })));
const ReportViewTracker = dynamic(() => import('@/components/insights/ReportViewTracker').then(m => ({ default: m.ReportViewTracker })));
const StickyTOC = dynamic(() => import('@/components/insights/StickyTOC').then(m => ({ default: m.StickyTOC })));

export const metadata: Metadata = {
  title: 'ADC vs Bispecific Antibody Deal Benchmarks — 2026 Market Data | Ambrosia Ventures',
  description: `ADC and bispecific antibody deal terms compared from ${DEAL_STATS.TOTAL_DEALS} biopharma transactions. Upfront premiums, total deal values, recent mega-deals, and why ADCs command 25-30% higher valuations.`,
  keywords: [
    'ADC deal terms',
    'bispecific antibody licensing',
    'ADC vs bispecific deals 2026',
    'antibody-drug conjugate deal benchmarks',
    'bispecific deal economics',
    'ADC licensing premium',
    'ADC deal valuation 2026',
    'bispecific antibody deal terms',
  ],
  openGraph: {
    title: 'ADC vs Bispecific Antibody Deal Benchmarks — 2026 Market Data',
    description: 'ADCs command 25-30% upfront premiums over bispecifics. Mega-deal analysis and China licensing wave data.',
    type: 'article',
    url: 'https://solidus.ambrosiaventures.co/insights/adc-vs-bispecific-deal-benchmarks-2026',
    images: [{ url: '/api/og?title=ADC%20vs%20Bispecific%20Deal%20Benchmarks&subtitle=2026%20Market%20Data&type=insight', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ADC vs Bispecific Deal Benchmarks 2026',
    description: 'ADCs command 25-30% higher upfronts. China licensing wave, mega-deal analysis, and modality premiums.',
  },
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/insights/adc-vs-bispecific-deal-benchmarks-2026',
  },
};

function HorizontalBarChart({ data, maxValue, color = '#0d9488' }: {
  data: { label: string; value: number; displayValue: string }[];
  maxValue: number;
  color?: string;
}) {
  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-32 text-right text-sm font-medium text-slate-600 flex-shrink-0">{item.label}</div>
          <div className="flex-1 h-8 bg-slate-100 rounded-md overflow-hidden relative">
            <div
              className="h-full rounded-md flex items-center justify-end px-2"
              style={{ width: `${(item.value / maxValue) * 100}%`, backgroundColor: color, opacity: 0.85 }}
            >
              <span className="text-xs font-bold text-white">{item.displayValue}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ComparisonCard({ left, right, label }: {
  left: { title: string; value: string; sub?: string };
  right: { title: string; value: string; sub?: string };
  label: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 my-6">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{label}</p>
      <div className="grid grid-cols-2 gap-6">
        <div className="text-center p-4 bg-slate-50 rounded-lg">
          <div className="text-2xl font-bold text-slate-700">{left.value}</div>
          <div className="text-sm font-medium text-slate-500 mt-1">{left.title}</div>
          {left.sub && <div className="text-xs text-slate-400 mt-1">{left.sub}</div>}
        </div>
        <div className="text-center p-4 bg-teal-50 rounded-lg border-2 border-teal-200">
          <div className="text-2xl font-bold text-teal-700">{right.value}</div>
          <div className="text-sm font-medium text-teal-600 mt-1">{right.title}</div>
          {right.sub && <div className="text-xs text-teal-500 mt-1">{right.sub}</div>}
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-6 text-center">
      <div className="text-3xl sm:text-4xl font-bold text-slate-900">{value}</div>
      <div className="text-sm font-medium text-slate-600 mt-1">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function ADCvsBispecificPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://solidus.ambrosiaventures.co' },
      { '@type': 'ListItem', position: 2, name: 'Insights', item: 'https://solidus.ambrosiaventures.co/insights' },
      { '@type': 'ListItem', position: 3, name: 'ADC vs Bispecific Deal Benchmarks 2026', item: 'https://solidus.ambrosiaventures.co/insights/adc-vs-bispecific-deal-benchmarks-2026' },
    ],
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'ADC vs Bispecific Antibody Deal Benchmarks — 2026 Market Data',
    description: 'How ADC and bispecific antibody deal economics compare across upfronts, total deal values, and recent mega-transactions.',
    author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: 'https://solidus.ambrosiaventures.co' },
    publisher: { '@type': 'Organization', name: 'Ambrosia Ventures', logo: { '@type': 'ImageObject', url: 'https://solidus.ambrosiaventures.co/logo.png' } },
    datePublished: '2026-04-02',
    dateModified: '2026-04-02',
    mainEntityOfPage: 'https://solidus.ambrosiaventures.co/insights/adc-vs-bispecific-deal-benchmarks-2026',
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Why do ADCs command higher deal valuations than bispecific antibodies?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'ADCs command 25-30% higher median upfront payments than bispecifics for three reasons: (1) validated commercial precedent — Enhertu, Padcev, and Adcetris have demonstrated blockbuster revenue trajectories, (2) broader indication potential — ADC platforms can be retargeted to multiple tumor types with the same payload-linker technology, and (3) manufacturing scarcity — the specialized conjugation and payload manufacturing capabilities are concentrated in a small number of CDMOs, creating supply-side premium.',
        },
      },
      {
        '@type': 'Question',
        name: 'What are typical upfront payments for ADC licensing deals in 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Median ADC upfront payments are approximately $361M across all phases, compared to $281M for bispecifics. At Phase 2, ADC upfronts range from $200-600M depending on target, payload differentiation, and therapeutic area. Platform-level ADC deals (granting rights to multiple targets) have commanded upfronts exceeding $1B, as seen in the Merck-Daiichi Sankyo collaboration ($4B upfront, $22B TDV).',
        },
      },
      {
        '@type': 'Question',
        name: 'How has the China-to-West ADC licensing wave affected deal terms?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Chinese biotech companies (e.g., LaNova Medicines, MediLink Therapeutics, Lanova Medicines) have licensed ADC assets to Western pharma at significant premiums. These deals typically feature $50-200M upfronts with $1-2B+ TDV for Phase 1-2 assets, reflecting both the quality of Chinese ADC innovation and Western pharma urgency to build ADC portfolios. The wave has compressed timelines and increased competition among buyers, benefiting licensors globally.',
        },
      },
      {
        '@type': 'Question',
        name: 'Are bispecific antibody deal values catching up to ADCs?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Bispecific deal values are increasing, driven by clinical success of T-cell engagers (teclistamab, glofitamab) and growing commercial validation. However, the gap has remained relatively stable at 25-30% because ADC deal values have also increased. Bispecifics are gaining ground in hematology (where T-cell engagers dominate) and immunology (where bispecific formats enable novel mechanisms), but ADCs retain the premium in solid tumors.',
        },
      },
      {
        '@type': 'Question',
        name: 'What modality commands the highest deal valuations in oncology?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'In oncology, ADCs command the highest median upfront ($361M), followed by bispecifics ($281M), radiopharmaceuticals ($220M), and CAR-T ($185M for hematologic, $140M for solid tumor). ADCs and radiopharmaceuticals are the two fastest-growing modalities by deal volume, both benefiting from platform scalability and target diversification opportunities.',
        },
      },
    ],
  };

  return (
    <>
      <ScrollProgress />
      <ReportViewTracker report="adc-vs-bispecific-2026" />
      <StickyTOC sections={[
        { id: 'head-to-head', label: 'Head-to-Head', number: 1 },
        { id: 'why-adc-premium', label: 'ADC Premium', number: 2 },
        { id: 'adc-deal-evolution', label: 'ADC Market', number: 3 },
        { id: 'bispecific-momentum', label: 'Bispecific Momentum', number: 4 },
        { id: 'china-licensing', label: 'China Licensing', number: 5 },
        { id: 'where-bispecifics-win', label: 'Where Bispecifics Win', number: 6 },
        { id: 'modality-comparison', label: 'Full Comparison', number: 7 },
        { id: 'mega-deals', label: 'Mega-Deals', number: 8 },
        { id: 'faq', label: 'FAQ', number: 9 },
      ]} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <main className="min-h-screen bg-white">
        {/* Hero */}
        <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-24 pb-20 px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.08),transparent)]" />
          <div className="relative max-w-3xl mx-auto text-center">
            <nav className="flex items-center justify-center gap-2 text-sm text-slate-400 mb-8">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <Link href="/insights" className="hover:text-white transition-colors">Insights</Link>
              <span>/</span>
              <span className="text-slate-200">ADC vs Bispecific Benchmarks</span>
            </nav>

            <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 text-sm font-medium rounded-full mb-6">
              Modality Comparison
            </span>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
              ADC vs Bispecific:{' '}
              <span className="text-blue-400">2026 Deal Benchmarks</span>
            </h1>

            <p className="text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto mb-10">
              How ADC and bispecific antibody deal economics compare across {DEAL_STATS.TOTAL_DEALS} transactions. Why ADCs command a 25-30% premium and where bispecifics are closing the gap.
            </p>

            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">$361M</div>
                <div className="text-xs text-slate-400">ADC median upfront</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">$281M</div>
                <div className="text-xs text-slate-400">Bispecific median upfront</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">25-30%</div>
                <div className="text-xs text-slate-400">ADC premium</div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <article className="max-w-3xl mx-auto px-4 py-12">
          <TrustBar />
          <AuthorByline date="April 2, 2026" />

          <KeyTakeaways takeaways={[
            'ADCs command 25-30% higher median upfront payments than bispecifics ($361M vs $281M), driven by commercial validation, platform scalability, and manufacturing scarcity.',
            'ADC deal volume peaked at $372B in 2023 (Pfizer-Seagen era) and has normalized to $100-105B annually, but deal count continues to grow.',
            'The China-to-West ADC licensing wave has created a new deal archetype: $50-200M upfronts for Phase 1-2 Chinese-origin ADCs with novel payloads and targets.',
            'Bispecifics are gaining ground in hematology (T-cell engagers) and immunology, but ADCs retain the premium in solid tumors.',
          ]} />

          {/* ── SECTION 1: HEAD-TO-HEAD ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 1</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="head-to-head">Head-to-Head: ADC vs Bispecific Deal Economics</h2>

            <p>
              ADCs and bispecific antibodies are the two most active modalities in biopharma deal-making, together accounting for over 25% of all oncology licensing transactions in 2024-2026. Both are platform technologies capable of generating multiple clinical candidates from a single core technology. But their deal economics diverge meaningfully — and understanding why is critical for licensors, buyers, and investors.
            </p>
          </div>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1A</p>
            <h3 className="text-base font-bold text-slate-900 mb-4">ADC vs Bispecific: Deal Economics Compared</h3>
          </div>

          <GatedBenchmarkTable
            headers={['Metric', 'ADCs', 'Bispecifics']}
            rows={[
              ['Median Upfront (all phases)', '$361M', '$281M'],
              ['Median TDV (all phases)', '$2,800M', '$2,100M'],
              ['Upfront % of TDV', '13-16%', '12-15%'],
              ['Phase 2 Median Upfront', '$350-550M', '$250-400M'],
              ['Platform Deal Upfront', '$500M-$4B', '$200M-$1.5B'],
              ['Annual Deal Volume (2025)', '35-40 deals', '25-30 deals'],
              ['Royalty Range', '10-18%', '8-15%'],
              ['Median Time to Close', '5-7 months', '4-6 months'],
            ]}
            freeRows={8}
            footnote={`Source: Solidus, ${DEAL_STATS.TOTAL_DEALS} transactions 2020-2026.`}
          />

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              ADCs command higher deal values on every metric &mdash; but the gap is narrowing in specific therapeutic contexts. The 25-30% upfront premium reflects structural advantages in commercial validation, platform economics, and supply scarcity. Bispecifics are closing the gap where they have their own clinical champions: hematology and immunology.
            </p>
          </div>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1B</p>
            <h3 className="text-base font-bold text-slate-900 mb-4">Median Upfront Payment Comparison</h3>
          </div>

          <ComparisonCard
            label="Median Upfront Payment (All Phases)"
            left={{ title: 'Bispecific Antibody', value: '$281M', sub: 'Growing in hematology + immunology' }}
            right={{ title: 'ADC', value: '$361M', sub: '25-30% premium over bispecifics' }}
          />

          <div className="my-8 grid sm:grid-cols-2 gap-4">
            <StatCard value="$361M" label="ADC Median Upfront" sub="All phases, 2020-2026" />
            <StatCard value="$281M" label="Bispecific Median Upfront" sub="All phases, 2020-2026" />
          </div>

          {/* ── PULL QUOTE 1 ── */}
          <section className="bg-slate-900 text-white -mx-4 sm:-mx-8 md:-mx-16 lg:-mx-24">
            <div className="max-w-3xl mx-auto px-6 py-14 text-center">
              <blockquote className="text-2xl sm:text-3xl font-bold leading-snug tracking-tight">
                &ldquo;ADCs command a 25-30% upfront premium over bispecifics &mdash; the largest sustained modality gap in oncology deal-making.&rdquo;
              </blockquote>
              <p className="mt-4 text-sm text-slate-400">Based on {DEAL_STATS.TOTAL_DEALS} verified transactions (2020&ndash;2026)</p>
            </div>
          </section>

          {/* ── SECTION 2: WHY ADC PREMIUM ── */}
          <div className="prose prose-slate prose-lg max-w-none mt-12">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 2</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="why-adc-premium">Why ADCs Command a Premium</h2>

            <p>
              The 25-30% ADC upfront premium over bispecifics is driven by three structural factors that are unlikely to change in the near term:
            </p>

            <p>
              <strong>1. Validated commercial models.</strong> Enhertu (Daiichi Sankyo/AstraZeneca) is on track for $10B+ peak sales. Padcev (Astellas/Seagen/Pfizer) exceeded $3B in its first full year post-bladder cancer approval. These commercial proof points give buyers confidence in the revenue assumptions that underpin ADC deal valuations. Bispecifics have growing commercial validation (teclistamab, glofitamab, mosunetuzumab), but have not yet produced a $5B+ revenue asset.
            </p>

            <p>
              <strong>2. Platform scalability.</strong> An ADC platform — defined by its linker-payload technology — can be retargeted to 5-10+ tumor types by swapping the antibody component. This creates a portfolio effect: a single platform deal can encompass multiple clinical candidates. The Merck-Daiichi Sankyo collaboration ($4B upfront, $22B TDV) was structured as a platform access deal across three ADC programs. Bispecific platforms also offer scalability, but the engineering complexity of each new target pairing is higher.
            </p>

            <p>
              <strong>3. Manufacturing scarcity.</strong> ADC manufacturing requires specialized conjugation facilities, payload synthesis capabilities, and quality control expertise that are concentrated in a small number of CDMOs (Lonza, Samsung Biologics, WuXi). This supply constraint creates a premium for companies that have secured manufacturing capacity — a factor that directly inflates deal valuations.
            </p>
          </div>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 2A</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Oncology Modality Premium (Median Upfront vs. Small Molecule Baseline)</h3>
            <p className="text-xs text-slate-400 mb-4">All phases combined. ADCs lead, followed by bispecifics and radiopharmaceuticals. The hierarchy reflects commercial validation maturity and supply-side dynamics.</p>
          </div>

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <HorizontalBarChart
              data={[
                { label: 'ADC', value: 361, displayValue: '$361M' },
                { label: 'Bispecific', value: 281, displayValue: '$281M' },
                { label: 'Radiopharm', value: 220, displayValue: '$220M' },
                { label: 'CAR-T (heme)', value: 185, displayValue: '$185M' },
                { label: 'mRNA', value: 156, displayValue: '$156M' },
                { label: 'CAR-T (solid)', value: 140, displayValue: '$140M' },
                { label: 'Gene Therapy', value: 100, displayValue: '$100M' },
              ]}
              maxValue={361}
              color="#0d9488"
            />
            <p className="text-xs text-slate-400 mt-3">All phases combined. Source: Solidus, {DEAL_STATS.TOTAL_DEALS} transactions.</p>
          </div>

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              The ADC-to-bispecific premium ($361M vs $281M, 28% gap) is the most persistent modality spread in oncology deal economics. Unlike radiopharmaceutical premiums, which surged recently on supply constraints, the ADC premium has been stable for three years &mdash; suggesting it reflects fundamental platform economics rather than cyclical enthusiasm.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 my-8">
            <p className="text-sm font-semibold text-blue-900 mb-1">The Enhertu effect</p>
            <p className="text-sm text-blue-800 leading-relaxed">
              Enhertu&apos;s success across HER2-high breast cancer, HER2-low breast cancer, NSCLC, gastric, and colorectal cancer demonstrated that a single ADC can address a $15B+ market across multiple tumor types. This commercial proof point has permanently elevated ADC deal valuations — every buyer now models multi-indication revenue trajectories for ADC assets.
            </p>
          </div>

          {/* ── SECTION 3: ADC DEAL EVOLUTION ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 3</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="adc-deal-evolution">ADC Deal Market: 2019-2026</h2>

            <p>
              The ADC deal market has gone through three distinct phases: the pre-Seagen era (2019-2021), the mega-deal peak (2022-2023), and the normalized market (2024-2026). Understanding this evolution is essential for calibrating expectations.
            </p>
          </div>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 3A</p>
            <h3 className="text-base font-bold text-slate-900 mb-4">ADC Deal Market Evolution</h3>
          </div>

          <GatedBenchmarkTable
            headers={['Year', 'ADC Deals', 'Median TDV', 'Total Value', 'Largest Deal']}
            rows={[
              ['2019', '17', '$1,339M', '$46.2B', 'AstraZeneca-Daiichi ($6.9B)'],
              ['2020', '20', '$2,663M', '$136.8B', 'Gilead-Immunomedics ($21B)'],
              ['2021', '18', '$1,686M', '$76.8B', 'Merck-Seagen ($1.7B collab)'],
              ['2022', '25', '$3,302M', '$105.1B', 'Pfizer-Seagen ($43B acq.)'],
              ['2023', '32', '$5,932M', '$371.8B', 'Pfizer-Seagen close + AbbVie-ImmunoGen ($10.1B)'],
              ['2024', '35', '$1,824M', '$104.4B', 'Merck-Daiichi Sankyo ($22B TDV)'],
              ['2025*', '17', '$1,598M', '$36.7B', 'BMS-TERN ($1.2B)'],
            ]}
            freeRows={7}
            footnote="*2025 data through Q3. Source: Solidus."
          />

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 3B</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">ADC Total Deal Value Trend (2019&ndash;2025)</h3>
            <p className="text-xs text-slate-400 mb-4">The 2023 Pfizer/Seagen acquisition ($43B) created a once-in-a-generation peak. Deal values have since normalized to $100&ndash;105B annually.</p>
          </div>

          <TrendLineChart
            data={[
              { year: '2019', value: 46.2 },
              { year: '2020', value: 136.8 },
              { year: '2021', value: 76.8 },
              { year: '2022', value: 105.1 },
              { year: '2023', value: 371.8 },
              { year: '2024', value: 104.4 },
              { year: '2025', value: 36.7 },
            ]}
            yLabel="Total ADC Deal Value ($B)"
            referenceLine={{ value: 104, label: 'Post-peak normalization' }}
          />

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              ADC deal volume peaked at $371.8B in 2023 &mdash; an anomaly driven by the $43B Pfizer-Seagen acquisition. Post-peak normalization to $104B (2024) represents the market&apos;s true equilibrium. Deal <em>count</em> continues to grow (17&rarr;35 deals, 2019&ndash;2024), but the market has shifted from platform mega-acquisitions to focused single-asset licensing with greater emphasis on target differentiation and payload novelty.
            </p>
          </div>

          {/* ── SECTION 4: BISPECIFIC MOMENTUM ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 4</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="bispecific-momentum">Bispecific Antibody Momentum</h2>

            <p>
              While ADCs dominate on absolute deal value, bispecifics are the fastest-growing modality by deal count growth rate. Bispecific deal volume has approximately doubled from 2021 to 2025, driven by clinical validation of T-cell engagers in hematology and the emergence of novel bispecific formats in solid tumors and immunology.
            </p>
          </div>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 4A</p>
            <h3 className="text-base font-bold text-slate-900 mb-4">Bispecific Antibody Deal Economics by Indication Type</h3>
          </div>

          <GatedBenchmarkTable
            headers={['Category', 'Median Upfront', 'Median TDV', 'Key Targets']}
            rows={[
              ['Hematology (T-cell engagers)', '$250-400M', '$1.5-3.0B', 'BCMA, CD20, GPRC5D'],
              ['Solid Tumor (T-cell engagers)', '$150-300M', '$1.0-2.5B', 'DLL3, CLDN18.2, MUC16'],
              ['Immunology (dual-target)', '$200-500M', '$1.2-3.5B', 'IL-4/IL-13, TNF/IL-17, TSLP/IL-13'],
              ['Next-gen Formats', '$100-250M', '$800M-2.0B', 'Trispecifics, conditional activation'],
            ]}
            freeRows={4}
            footnote={`Source: Solidus, ${DEAL_STATS.TOTAL_DEALS} transactions.`}
          />

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              Bispecific deal economics vary dramatically by indication type. Hematology T-cell engagers command upfronts ($250-400M) that rival ADCs &mdash; driven by the clinical validation of teclistamab, glofitamab, and epcoritamab. Immunology dual-target bispecifics are the fastest-growing subcategory, with $200-500M upfronts reflecting the massive addressable markets in chronic inflammatory disease.
            </p>
          </div>

          <InsightEmailCapture slug="adc-vs-bispecific-deal-benchmarks-2026" />

          <InsightCTA
            variant="mid"
            heading="Benchmark Your ADC or Bispecific"
            description="Model deal terms for your specific modality, target, phase, and therapeutic area — with real comparable transactions."
          />

          {/* ── SECTION 5: CHINA LICENSING ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 5</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="china-licensing">The China-to-West Licensing Wave</h2>

            <p>
              One of the most significant developments in ADC deal-making since 2023 has been the China-to-West licensing wave. Chinese biotech companies — many of which built sophisticated ADC platforms during the 2020-2022 investment boom — are now licensing assets to Western pharma at terms that rival or exceed domestically-originated deals.
            </p>

            <p>
              These deals share common characteristics: Phase 1 or early Phase 2 assets with novel payloads (topoisomerase I inhibitors, MMAE/MMAF alternatives, immunostimulatory payloads), targeting antigens with established clinical precedent (HER2, Trop-2, Nectin-4, B7-H3). Upfronts range from $50-200M with TDVs of $1-2B+, and most include manufacturing technology transfer provisions.
            </p>

            <p>
              For ADC licensors globally, the China wave has two effects: it increases competition for buyer attention (more assets available), but it also validates the modality premium (buyers are willing to pay $100M+ upfronts for Phase 1 ADCs from Chinese companies they may have limited due diligence history with — a strong signal of modality conviction).
            </p>
          </div>

          {/* ── PULL QUOTE 2 ── */}
          <section className="bg-slate-900 text-white -mx-4 sm:-mx-8 md:-mx-16 lg:-mx-24">
            <div className="max-w-3xl mx-auto px-6 py-14 text-center">
              <blockquote className="text-2xl sm:text-3xl font-bold leading-snug tracking-tight">
                &ldquo;Six of the top 10 pharma companies have licensed ADC or bispecific assets from Chinese biotechs in the last 12 months. This is no longer an emerging trend &mdash; it is a structural feature of the global deal landscape.&rdquo;
              </blockquote>
              <p className="mt-4 text-sm text-slate-400">China-to-West out-licensing reached $136B in 2025 (+162% YoY)</p>
            </div>
          </section>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 5A</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Notable China-to-West ADC Licensing Deals (Total Deal Value)</h3>
            <p className="text-xs text-slate-400 mb-4">Selected mega-deals. Total deal values include milestones and contingent payments. The scale of these transactions reflects Western pharma&apos;s urgency to build ADC portfolios.</p>
          </div>

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <HorizontalBarChart
              data={[
                { label: 'AZ / CSPC', value: 18500, displayValue: '$18.5B' },
                { label: 'Merck / Daiichi', value: 22000, displayValue: '$22.0B' },
                { label: 'AbbVie / ImmunoGen', value: 10100, displayValue: '$10.1B' },
                { label: 'BMS / TERN', value: 1200, displayValue: '$1.2B' },
                { label: 'Merck / LaNova', value: 3300, displayValue: '$3.3B' },
              ]}
              maxValue={22000}
              color="#6366f1"
            />
            <p className="text-xs text-slate-400 mt-3">Selected mega-deals. Total deal values include milestones and contingent payments.</p>
          </div>

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              The China-to-West ADC licensing wave has compressed deal timelines and increased competition among buyers. Western pharma is paying $100M+ upfronts for Phase 1 ADCs from Chinese companies &mdash; a level of conviction that would have been unthinkable three years ago. For all ADC licensors, this validates the modality premium even as it increases competitive pressure for buyer attention.
            </p>
          </div>

          {/* ── SECTION 6: WHERE BISPECIFICS WIN ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 6</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="where-bispecifics-win">Where Bispecifics Close the Gap</h2>

            <p>
              Bispecifics outperform ADCs on deal economics in two specific contexts:
            </p>

            <ul>
              <li><strong>Hematology.</strong> T-cell engaging bispecifics have become the dominant modality for relapsed/refractory multiple myeloma and B-cell lymphomas. In this space, bispecific upfronts and TDVs match or exceed ADC levels, because the clinical and commercial validation (teclistamab, glofitamab, epcoritamab) is equally strong.</li>
              <li><strong>Immunology/autoimmune.</strong> Bispecific antibodies targeting two inflammatory cytokines (e.g., IL-4/IL-13, TNF/IL-17) are a growing category in immunology deal-making, where ADCs have limited relevance. These deals can command $200-500M upfronts at Phase 2 due to the large market opportunity in chronic inflammatory diseases.</li>
            </ul>
          </div>

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              The ADC premium is an oncology solid-tumor phenomenon. In hematology and immunology, bispecifics match or exceed ADC deal economics. BD teams should evaluate modality premiums within their specific therapeutic context rather than applying the overall 25-30% ADC premium across all indications.
            </p>
          </div>

          {/* ── SECTION 7: FULL MODALITY COMPARISON ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 7</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="modality-comparison">Full Modality Comparison: Oncology Upfronts</h2>
          </div>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 7A</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Median Upfront by Oncology Modality</h3>
            <p className="text-xs text-slate-400 mb-4">ADCs lead on median upfront at every development phase. The hierarchy reflects commercial validation maturity, manufacturing complexity, and platform scalability.</p>
          </div>

          <GatedBenchmarkTable
            headers={['Modality', 'Median Upfront', 'Median TDV', 'Deal Count (2020-2026)']}
            rows={[
              ['ADC', '$361M', '$2,800M', '~165'],
              ['Bispecific', '$281M', '$2,100M', '~120'],
              ['Radiopharmaceutical', '$220M', '$1,600M', '~45'],
              ['CAR-T (hematologic)', '$185M', '$1,400M', '~60'],
              ['mRNA (oncology)', '$156M', '$1,200M', '~30'],
              ['CAR-T (solid tumor)', '$140M', '$1,100M', '~25'],
              ['Gene Therapy', '$100M', '$900M', '~20'],
            ]}
            freeRows={7}
            footnote={`All phases combined. Deal counts are approximate. Source: Solidus, ${DEAL_STATS.TOTAL_DEALS} transactions.`}
          />

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 7B</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Oncology Modality Upfront Waterfall</h3>
            <p className="text-xs text-slate-400 mb-4">Median upfront payments by modality, arranged from highest to lowest. ADCs and bispecifics together account for over 60% of deal volume.</p>
          </div>

          <WaterfallChart
            data={[
              { phase: 'ADC', value: 361, n: 165 },
              { phase: 'Bispecific', value: 281, n: 120 },
              { phase: 'Radiopharm', value: 220, n: 45 },
              { phase: 'CAR-T (heme)', value: 185, n: 60 },
              { phase: 'mRNA', value: 156, n: 30 },
              { phase: 'CAR-T (solid)', value: 140, n: 25 },
              { phase: 'Gene Therapy', value: 100, n: 20 },
            ]}
          />

          {/* ── SECTION 8: MEGA-DEALS ── */}
          <div className="prose prose-slate prose-lg max-w-none mt-12">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 8</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="mega-deals">Recent Mega-Deals: Case Studies</h2>

            <ul>
              <li><strong>Merck-Daiichi Sankyo (2024):</strong> $4B upfront, $22B TDV. ADC collaboration across three programs. The largest single upfront in ADC licensing history, reflecting platform-level conviction.</li>
              <li><strong>AbbVie-ImmunoGen (2024):</strong> $10.1B acquisition. Single-asset ADC company (Elahere, ovarian cancer). Premium driven by first-in-class status and expanding label potential.</li>
              <li><strong>Pfizer-Seagen (2023):</strong> $43B acquisition. The deal that reshaped ADC valuations permanently, pricing Seagen&apos;s 4-product ADC platform at 10x trailing revenue.</li>
              <li><strong>BMS-BioNTech (2024):</strong> Bispecific collaboration. $1.2B upfront for multiple T-cell engaging bispecifics in solid tumors, demonstrating growing confidence in the format beyond hematology.</li>
              <li><strong>AstraZeneca-Daiichi Sankyo (2023 expansion):</strong> $2B additional upfront to expand the Enhertu collaboration to additional tumor types. Platform expansion deal that validated the multi-indication ADC thesis.</li>
            </ul>
          </div>

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              The five largest ADC/bispecific deals of 2023-2024 total $78.3B in transaction value. These mega-deals have reshaped valuation benchmarks for the entire sector &mdash; every licensor now anchors to these precedents when negotiating deal terms. The shift from platform acquisitions (Pfizer-Seagen, $43B) to single-asset licensing (Merck-Daiichi, $22B TDV) signals a maturing market where buyers want targeted access rather than wholesale platform ownership.
            </p>
          </div>

          {/* ── INTERACTIVE CALCULATOR ── */}
          <section className="my-12">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Interactive</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Model Your ADC or Bispecific Deal</h2>
            <p className="text-slate-500 mb-6">Select your therapeutic area, phase, and modality to see live benchmarks from our database of {DEAL_STATS.TOTAL_DEALS} verified transactions.</p>
            <MiniCalculator defaultTA="oncology" defaultPhase="phase2" defaultModality="adc" />
          </section>

          {/* ── SECTION 9: FAQ ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 9</p>
            <h2 className="text-lg font-bold text-slate-900 mb-4" id="faq">Frequently Asked Questions</h2>
          </div>

          <div className="divide-y divide-slate-200 mb-12">
            {[
              { q: 'Why do ADCs command higher deal valuations than bispecifics?', a: 'ADCs benefit from validated commercial models (Enhertu approaching $10B+ peak sales), platform scalability across 5-10+ tumor types, and manufacturing scarcity that creates supply-side premium. The 25-30% upfront gap reflects these structural advantages.' },
              { q: 'What are typical ADC upfronts in 2026?', a: `Median ADC upfront is $361M across all phases. Phase 2 ADC upfronts range from $200-600M depending on target differentiation, payload novelty, and therapeutic area. Platform deals (multiple targets) command $500M-$4B upfronts, as seen in the Merck-Daiichi collaboration.` },
              { q: 'How has the China licensing wave affected ADC deal terms?', a: 'Chinese-origin ADCs are being licensed to Western pharma at $50-200M upfronts for Phase 1-2 assets. This increases buyer options but also validates modality conviction. The wave has compressed deal timelines and created competitive dynamics that benefit all ADC licensors.' },
              { q: 'Are bispecific deal values catching up?', a: 'Bispecific deal volume is growing faster than ADC deal volume, but the absolute valuation gap has remained stable at 25-30%. Bispecifics are gaining in hematology and immunology, where they match or exceed ADC deal values. In solid tumors, ADCs retain the premium.' },
              { q: 'What modality has the highest deal valuations in oncology?', a: `ADCs lead with $361M median upfront, followed by bispecifics ($281M), radiopharmaceuticals ($220M), and CAR-T for hematologic malignancies ($185M). Use Solidus to model deal terms for your specific modality.` },
            ].map(({ q, a }, i) => (
              <details key={i} className="group py-4">
                <summary className="flex items-center justify-between cursor-pointer text-sm font-semibold text-slate-800 hover:text-teal-700">
                  <span>{q}</span>
                  <svg className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>

          {/* ── EMAIL CAPTURE ── */}
          <section className="mb-12">
            <InlineEmailCapture
              heading="Get Weekly ADC & Bispecific Deal Intelligence"
              description={`Join 2,000+ BD professionals who receive our weekly analysis of modality-specific licensing trends, new deal benchmarks, and negotiation insights from ${DEAL_STATS.TOTAL_DEALS} verified transactions.`}
              source="adc-vs-bispecific-insight"
            />
          </section>

          {/* ── CITE THIS DATA ── */}
          <section className="mb-12">
            <CiteThisData
              title="ADC vs Bispecific Antibody Deal Benchmarks — 2026 Market Data"
              pageUrl="/insights/adc-vs-bispecific-deal-benchmarks-2026"
            />
          </section>

          <RelatedInsights articles={[
            {
              href: '/insights/biopharma-deal-benchmarks-2026',
              title: '3 Data Insights from 3,447 Deals',
              description: 'ADC normalization, Phase 2 inflection, and immunology premium.',
              badge: 'Data Report',
            },
            {
              href: '/insights/oncology-upfront-payment-benchmarks',
              title: 'Oncology Upfront Payment Benchmarks',
              description: 'Phase-by-phase upfront data across all oncology modalities and indications.',
              badge: 'Benchmarks',
            },
            {
              href: '/insights/phase-2-vs-phase-3-deal-economics',
              title: 'Phase 2 vs Phase 3 Deal Economics',
              description: 'When to deal at each stage and the PoC inflection point.',
              badge: 'Comparison',
            },
          ]} />
        </article>

        <InsightCTA
          variant="bottom"
          heading="Benchmark Your ADC or Bispecific"
          description={`Model deal terms for ADCs, bispecifics, and 20+ other modalities — powered by ${DEAL_STATS.TOTAL_DEALS} real transactions.`}
        />
      </main>
      <SiteFooter />
    </>
  );
}
