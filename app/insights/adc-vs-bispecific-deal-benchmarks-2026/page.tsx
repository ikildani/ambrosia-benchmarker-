import { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { KeyTakeaways } from '@/components/insights/KeyTakeaways';
import { TrustBar } from '@/components/insights/TrustBar';
import { AuthorByline } from '@/components/insights/AuthorByline';
import { InsightCTA } from '@/components/insights/InsightCTA';
import { RelatedInsights } from '@/components/insights/RelatedInsights';
import { DEAL_STATS } from '@/lib/config/constants';

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
    url: 'https://calculator.ambrosiaventures.co/insights/adc-vs-bispecific-deal-benchmarks-2026',
    images: [{ url: '/api/og?title=ADC%20vs%20Bispecific%20Deal%20Benchmarks&subtitle=2026%20Market%20Data&type=insight', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ADC vs Bispecific Deal Benchmarks 2026',
    description: 'ADCs command 25-30% higher upfronts. China licensing wave, mega-deal analysis, and modality premiums.',
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/insights/adc-vs-bispecific-deal-benchmarks-2026',
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

function DataTable({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-slate-200">
            {headers.map((h, i) => (
              <th key={i} className={`py-3 px-4 font-semibold text-slate-700 ${i === 0 ? 'text-left' : 'text-right'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
              {row.map((cell, j) => (
                <td key={j} className={`py-3 px-4 ${j === 0 ? 'text-left font-medium text-slate-800' : 'text-right text-slate-600 tabular-nums'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ADCvsBispecificPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://calculator.ambrosiaventures.co' },
      { '@type': 'ListItem', position: 2, name: 'Insights', item: 'https://calculator.ambrosiaventures.co/insights' },
      { '@type': 'ListItem', position: 3, name: 'ADC vs Bispecific Deal Benchmarks 2026', item: 'https://calculator.ambrosiaventures.co/insights/adc-vs-bispecific-deal-benchmarks-2026' },
    ],
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'ADC vs Bispecific Antibody Deal Benchmarks — 2026 Market Data',
    description: 'How ADC and bispecific antibody deal economics compare across upfronts, total deal values, and recent mega-transactions.',
    author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: 'https://calculator.ambrosiaventures.co' },
    publisher: { '@type': 'Organization', name: 'Ambrosia Ventures', logo: { '@type': 'ImageObject', url: 'https://calculator.ambrosiaventures.co/logo.png' } },
    datePublished: '2026-04-02',
    dateModified: '2026-04-02',
    mainEntityOfPage: 'https://calculator.ambrosiaventures.co/insights/adc-vs-bispecific-deal-benchmarks-2026',
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

          <div className="prose prose-slate prose-lg max-w-none">
            <h2 id="head-to-head">Head-to-Head: ADC vs Bispecific Deal Economics</h2>

            <p>
              ADCs and bispecific antibodies are the two most active modalities in biopharma deal-making, together accounting for over 25% of all oncology licensing transactions in 2024-2026. Both are platform technologies capable of generating multiple clinical candidates from a single core technology. But their deal economics diverge meaningfully — and understanding why is critical for licensors, buyers, and investors.
            </p>
          </div>

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">ADC vs Bispecific: Deal Economics Compared</h3>
            <DataTable
              headers={['Metric', 'ADCs', 'Bispecifics']}
              rows={[
                ['Median Upfront (all phases)', <strong key="adc-up">$361M</strong>, '$281M'],
                ['Median TDV (all phases)', '$2,800M', '$2,100M'],
                ['Upfront % of TDV', '13-16%', '12-15%'],
                ['Phase 2 Median Upfront', '$350-550M', '$250-400M'],
                ['Platform Deal Upfront', '$500M-$4B', '$200M-$1.5B'],
                ['Annual Deal Volume (2025)', '35-40 deals', '25-30 deals'],
                ['Royalty Range', '10-18%', '8-15%'],
                ['Median Time to Close', '5-7 months', '4-6 months'],
              ]}
            />
            <p className="text-xs text-slate-400 mt-3">Source: Ambrosia Benchmarker, {DEAL_STATS.TOTAL_DEALS} transactions 2020-2026.</p>
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

          <div className="prose prose-slate prose-lg max-w-none">
            <h2 id="why-adc-premium">Why ADCs Command a Premium</h2>

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

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Oncology Modality Premium (Median Upfront vs. Small Molecule Baseline)</h3>
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
            <p className="text-xs text-slate-400 mt-3">All phases combined. Source: Ambrosia Benchmarker, {DEAL_STATS.TOTAL_DEALS} transactions.</p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 my-8">
            <p className="text-sm font-semibold text-blue-900 mb-1">The Enhertu effect</p>
            <p className="text-sm text-blue-800 leading-relaxed">
              Enhertu&apos;s success across HER2-high breast cancer, HER2-low breast cancer, NSCLC, gastric, and colorectal cancer demonstrated that a single ADC can address a $15B+ market across multiple tumor types. This commercial proof point has permanently elevated ADC deal valuations — every buyer now models multi-indication revenue trajectories for ADC assets.
            </p>
          </div>

          <div className="prose prose-slate prose-lg max-w-none">
            <h2 id="adc-deal-evolution">ADC Deal Market: 2019-2026</h2>

            <p>
              The ADC deal market has gone through three distinct phases: the pre-Seagen era (2019-2021), the mega-deal peak (2022-2023), and the normalized market (2024-2026). Understanding this evolution is essential for calibrating expectations.
            </p>
          </div>

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">ADC Deal Market Evolution</h3>
            <DataTable
              headers={['Year', 'ADC Deals', 'Median TDV', 'Total Value', 'Largest Deal']}
              rows={[
                ['2019', '17', '$1,339M', '$46.2B', 'AstraZeneca-Daiichi ($6.9B)'],
                ['2020', '20', '$2,663M', '$136.8B', 'Gilead-Immunomedics ($21B)'],
                ['2021', '18', '$1,686M', '$76.8B', 'Merck-Seagen ($1.7B collab)'],
                ['2022', '25', '$3,302M', '$105.1B', 'Pfizer-Seagen ($43B acq.)'],
                [<strong key="23" className="text-blue-700">2023</strong>, <strong key="23n">32</strong>, <strong key="23t">$5,932M</strong>, <strong key="23v">$371.8B</strong>, 'Pfizer-Seagen close + AbbVie-ImmunoGen ($10.1B)'],
                ['2024', '35', '$1,824M', '$104.4B', 'Merck-Daiichi Sankyo ($22B TDV)'],
                ['2025*', '17', '$1,598M', '$36.7B', 'BMS-TERN ($1.2B)'],
              ]}
            />
            <p className="text-xs text-slate-400 mt-3">*2025 data through Q3. Source: Ambrosia Benchmarker.</p>
          </div>

          <div className="prose prose-slate prose-lg max-w-none">
            <h2 id="bispecific-momentum">Bispecific Antibody Momentum</h2>

            <p>
              While ADCs dominate on absolute deal value, bispecifics are the fastest-growing modality by deal count growth rate. Bispecific deal volume has approximately doubled from 2021 to 2025, driven by clinical validation of T-cell engagers in hematology and the emergence of novel bispecific formats in solid tumors and immunology.
            </p>
          </div>

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Bispecific Antibody Deal Economics by Indication Type</h3>
            <DataTable
              headers={['Category', 'Median Upfront', 'Median TDV', 'Key Targets']}
              rows={[
                [<strong key="heme" className="text-blue-700">Hematology (T-cell engagers)</strong>, '$250-400M', '$1.5-3.0B', 'BCMA, CD20, GPRC5D'],
                ['Solid Tumor (T-cell engagers)', '$150-300M', '$1.0-2.5B', 'DLL3, CLDN18.2, MUC16'],
                ['Immunology (dual-target)', '$200-500M', '$1.2-3.5B', 'IL-4/IL-13, TNF/IL-17, TSLP/IL-13'],
                ['Next-gen Formats', '$100-250M', '$800M-2.0B', 'Trispecifics, conditional activation'],
              ]}
            />
          </div>

          <InsightCTA
            variant="mid"
            heading="Benchmark Your ADC or Bispecific"
            description="Model deal terms for your specific modality, target, phase, and therapeutic area — with real comparable transactions."
          />

          <div className="prose prose-slate prose-lg max-w-none">
            <h2 id="china-licensing">The China-to-West Licensing Wave</h2>

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

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Notable China-to-West ADC Licensing Deals (Total Deal Value)</h3>
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

          <div className="prose prose-slate prose-lg max-w-none">
            <h2 id="where-bispecifics-win">Where Bispecifics Close the Gap</h2>

            <p>
              Bispecifics outperform ADCs on deal economics in two specific contexts:
            </p>

            <ul>
              <li><strong>Hematology.</strong> T-cell engaging bispecifics have become the dominant modality for relapsed/refractory multiple myeloma and B-cell lymphomas. In this space, bispecific upfronts and TDVs match or exceed ADC levels, because the clinical and commercial validation (teclistamab, glofitamab, epcoritamab) is equally strong.</li>
              <li><strong>Immunology/autoimmune.</strong> Bispecific antibodies targeting two inflammatory cytokines (e.g., IL-4/IL-13, TNF/IL-17) are a growing category in immunology deal-making, where ADCs have limited relevance. These deals can command $200-500M upfronts at Phase 2 due to the large market opportunity in chronic inflammatory diseases.</li>
            </ul>

            <h2 id="modality-comparison">Full Modality Comparison: Oncology Upfronts</h2>
          </div>

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Median Upfront by Oncology Modality</h3>
            <DataTable
              headers={['Modality', 'Median Upfront', 'Median TDV', 'Deal Count (2020-2026)']}
              rows={[
                [<strong key="adc" className="text-blue-700">ADC</strong>, <strong key="adc-u">$361M</strong>, '$2,800M', '~165'],
                ['Bispecific', '$281M', '$2,100M', '~120'],
                ['Radiopharmaceutical', '$220M', '$1,600M', '~45'],
                ['CAR-T (hematologic)', '$185M', '$1,400M', '~60'],
                ['mRNA (oncology)', '$156M', '$1,200M', '~30'],
                ['CAR-T (solid tumor)', '$140M', '$1,100M', '~25'],
                ['Gene Therapy', '$100M', '$900M', '~20'],
              ]}
            />
            <p className="text-xs text-slate-400 mt-3">All phases combined. Deal counts are approximate. Source: Ambrosia Benchmarker.</p>
          </div>

          <div className="prose prose-slate prose-lg max-w-none">
            <h2 id="mega-deals">Recent Mega-Deals: Case Studies</h2>

            <ul>
              <li><strong>Merck-Daiichi Sankyo (2024):</strong> $4B upfront, $22B TDV. ADC collaboration across three programs. The largest single upfront in ADC licensing history, reflecting platform-level conviction.</li>
              <li><strong>AbbVie-ImmunoGen (2024):</strong> $10.1B acquisition. Single-asset ADC company (Elahere, ovarian cancer). Premium driven by first-in-class status and expanding label potential.</li>
              <li><strong>Pfizer-Seagen (2023):</strong> $43B acquisition. The deal that reshaped ADC valuations permanently, pricing Seagen&apos;s 4-product ADC platform at 10x trailing revenue.</li>
              <li><strong>BMS-BioNTech (2024):</strong> Bispecific collaboration. $1.2B upfront for multiple T-cell engaging bispecifics in solid tumors, demonstrating growing confidence in the format beyond hematology.</li>
              <li><strong>AstraZeneca-Daiichi Sankyo (2023 expansion):</strong> $2B additional upfront to expand the Enhertu collaboration to additional tumor types. Platform expansion deal that validated the multi-indication ADC thesis.</li>
            </ul>

            <h2 id="faq">Frequently Asked Questions</h2>

            <h3>Why do ADCs command higher deal valuations than bispecifics?</h3>
            <p>
              ADCs benefit from validated commercial models (Enhertu approaching $10B+ peak sales), platform scalability across 5-10+ tumor types, and manufacturing scarcity that creates supply-side premium. The 25-30% upfront gap reflects these structural advantages.
            </p>

            <h3>What are typical ADC upfronts in 2026?</h3>
            <p>
              Median ADC upfront is $361M across all phases. Phase 2 ADC upfronts range from $200-600M depending on target differentiation, payload novelty, and therapeutic area. Platform deals (multiple targets) command $500M-$4B upfronts, as seen in the Merck-Daiichi collaboration.
            </p>

            <h3>How has the China licensing wave affected ADC deal terms?</h3>
            <p>
              Chinese-origin ADCs are being licensed to Western pharma at $50-200M upfronts for Phase 1-2 assets. This increases buyer options but also validates modality conviction. The wave has compressed deal timelines and created competitive dynamics that benefit all ADC licensors.
            </p>

            <h3>Are bispecific deal values catching up?</h3>
            <p>
              Bispecific deal volume is growing faster than ADC deal volume, but the absolute valuation gap has remained stable at 25-30%. Bispecifics are gaining in hematology and immunology, where they match or exceed ADC deal values. In solid tumors, ADCs retain the premium.
            </p>

            <h3>What modality has the highest deal valuations in oncology?</h3>
            <p>
              ADCs lead with $361M median upfront, followed by bispecifics ($281M), radiopharmaceuticals ($220M), and CAR-T for hematologic malignancies ($185M). Use the <Link href="/calculator" className="text-teal-600 font-medium hover:text-teal-700">Ambrosia Benchmarker</Link> to model deal terms for your specific modality.
            </p>
          </div>

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
