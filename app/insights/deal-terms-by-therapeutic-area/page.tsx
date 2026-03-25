import { Metadata } from 'next';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { InsightPageHeader } from '@/components/insights/InsightPageHeader';
import { GatedBenchmarkTable } from '@/components/insights/GatedBenchmarkTable';
import { InsightCTA } from '@/components/insights/InsightCTA';
import { InsightCallout } from '@/components/insights/InsightCallout';
import { AuthorByline } from '@/components/insights/AuthorByline';
import { TableOfContents } from '@/components/insights/TableOfContents';
import { RelatedInsights } from '@/components/insights/RelatedInsights';
import { KeyTakeaways } from '@/components/insights/KeyTakeaways';
import { TrustBar } from '@/components/insights/TrustBar';

const PhaseUpfrontChart = dynamic(() => import('@/components/insights/PhaseUpfrontChart').then(m => ({ default: m.PhaseUpfrontChart })));
const InlineEmailCapture = dynamic(() => import('@/components/insights/InlineEmailCapture').then(m => ({ default: m.InlineEmailCapture })));
const ScrollProgress = dynamic(() => import('@/components/insights/ScrollProgress').then(m => ({ default: m.ScrollProgress })));
const MiniCalculator = dynamic(() => import('@/components/insights/MiniCalculator').then(m => ({ default: m.MiniCalculator })));

const BASE_URL = 'https://calculator.ambrosiaventures.co';
const PAGE_URL = `${BASE_URL}/insights/deal-terms-by-therapeutic-area`;

export const metadata: Metadata = {
  title: 'Biopharma Deal Terms by Therapeutic Area: A 12-TA Comparison | Ambrosia Ventures',
  description: 'Compare biopharma licensing deal benchmarks across 12 therapeutic areas. Metabolic/obesity commands the highest total values ($4.5B at Phase 3), while immunology leads Phase 2 upfronts at $120M median.',
  keywords: [
    'biopharma deal benchmarks by therapeutic area',
    'pharma licensing deal terms',
    'oncology deal benchmarks',
    'immunology licensing deals',
    'metabolic obesity deal values',
    'therapeutic area deal comparison',
    'biotech deal intelligence',
    'pharma BD benchmarks',
  ],
  openGraph: {
    title: 'Biopharma Deal Terms: 12-TA Comparison with Phase 2 & Phase 3 Benchmarks',
    description: 'Metabolic/obesity leads at $4.5B total value. Immunology commands $120M Phase 2 upfronts. Full 12-TA benchmark data.',
    type: 'article',
    url: PAGE_URL,
    images: [{ url: `/api/og?title=${encodeURIComponent('Deal Terms by Therapeutic Area')}&subtitle=${encodeURIComponent('12-TA Comparison: Phase 2 & Phase 3 Benchmarks')}&type=insight`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Biopharma Deal Terms by Therapeutic Area: 12-TA Comparison',
    description: 'Metabolic/obesity leads at $4.5B total value. Full Phase 2 & Phase 3 benchmarks across 12 TAs.',
  },
  alternates: {
    canonical: PAGE_URL,
  },
};

export default function DealTermsByTherapeuticAreaPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Insights', item: `${BASE_URL}/insights` },
      { '@type': 'ListItem', position: 3, name: 'Deal Terms by Therapeutic Area', item: PAGE_URL },
    ],
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Biopharma Deal Terms by Therapeutic Area: A 12-TA Comparison',
    description: 'Comprehensive comparison of biopharma licensing deal benchmarks across 12 therapeutic areas at Phase 2 and Phase 3.',
    author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: BASE_URL },
    publisher: { '@type': 'Organization', name: 'Ambrosia Ventures', logo: { '@type': 'ImageObject', url: `${BASE_URL}/logo.png` } },
    datePublished: '2026-03-24',
    mainEntityOfPage: PAGE_URL,
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Which therapeutic area commands the highest total deal values?',
        acceptedAnswer: { '@type': 'Answer', text: 'Metabolic/obesity now commands the highest total deal values at both Phase 2 ($2.0B median) and Phase 3 ($4.5B median), driven by the GLP-1 revolution and validated $100B+ commercial models. Immunology is second at Phase 3 ($3.2B).' },
      },
      {
        '@type': 'Question',
        name: 'Why does immunology command such high upfront payments at Phase 2?',
        acceptedAnswer: { '@type': 'Answer', text: 'Immunology Phase 2 upfronts ($120M median) reflect the large addressable patient populations, validated commercial models (anti-TNF, anti-IL class), and recent mega-deals like Merck/Prometheus ($10.8B) and Roche/Telavant ($7.1B) that reset valuation expectations for the entire therapeutic area.' },
      },
      {
        '@type': 'Question',
        name: 'How do oncology deal values compare to other therapeutic areas?',
        acceptedAnswer: { '@type': 'Answer', text: 'Oncology remains the highest-volume deal market but no longer commands the highest per-deal values. Phase 2 oncology upfronts ($95M) trail immunology ($120M) and metabolic ($150M). At Phase 3, oncology ($2.5B) ranks behind metabolic ($4.5B) and immunology ($3.2B).' },
      },
      {
        '@type': 'Question',
        name: 'What makes rare disease deals different from large-market TAs?',
        acceptedAnswer: { '@type': 'Answer', text: 'Rare disease deals command orphan drug premiums including 7-year market exclusivity, accelerated FDA pathways, and pricing power ($200K-500K+ per patient annually). Despite smaller patient populations, total deal values ($750M Phase 2, $1.7B Phase 3) reflect these regulatory and commercial advantages.' },
      },
      {
        '@type': 'Question',
        name: 'Are dermatology and gastroenterology deal values increasing?',
        acceptedAnswer: { '@type': 'Answer', text: 'Yes. Dermatology is experiencing a resurgence driven by JAK inhibitor and TYK2 inhibitor competition, with Phase 2 upfronts reaching $45M median. Gastroenterology has been transformed by anti-TL1A biology (Merck/Prometheus $10.8B) and now commands $70M Phase 2 upfronts and $1.9B Phase 3 total values.' },
      },
    ],
  };

  const datasetSchema = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Biopharma Deal Terms by Therapeutic Area: 12-TA Phase 2 & Phase 3 Benchmarks',
    description: 'Median upfront payments and total deal values for biopharma licensing deals across 12 therapeutic areas at Phase 2 and Phase 3, derived from 2,600+ transactions (2020-2026).',
    url: PAGE_URL,
    creator: { '@type': 'Organization', name: 'Ambrosia Ventures' },
    datePublished: '2026-03-24',
    license: 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
  };

  const tocItems = [
    { id: 'phase-2-benchmarks', label: 'Phase 2 Deal Benchmarks: 12 Therapeutic Areas' },
    { id: 'phase-3-benchmarks', label: 'Phase 3 Deal Benchmarks: 12 Therapeutic Areas' },
    { id: 'metabolic-obesity', label: 'Why Metabolic/Obesity Commands the Highest Valuations' },
    { id: 'immunology-premium', label: "Immunology's Hidden Premium" },
    { id: 'emerging-hotspots', label: 'Emerging TA Hotspots' },
    { id: 'marquee-deals', label: 'Marquee Deals by Therapeutic Area' },
    { id: 'faq', label: 'Frequently Asked Questions' },
  ];

  const relatedArticles = [
    {
      href: '/insights/oncology-upfront-payment-benchmarks',
      title: 'Oncology Upfront Payment Benchmarks',
      description: 'Phase-by-phase upfront payment ranges for oncology licensing deals with real transaction examples.',
      badge: 'Data Report',
    },
    {
      href: '/insights/pharma-licensing-royalty-rates',
      title: 'Pharma Licensing Royalty Rates by Phase & Modality',
      description: 'Benchmark royalty data from 3% at discovery to 25% for approved assets across 8 modalities.',
      badge: 'Data Report',
    },
    {
      href: '/insights/biotech-licensing-europe',
      title: 'Biotech Licensing in Europe: Regional Benchmarks',
      description: 'How European licensing deal terms compare to US benchmarks across therapeutic areas.',
      badge: 'Data Report',
    },
    {
      href: '/insights/out-licensing-asia-pacific',
      title: 'Out-Licensing in Asia-Pacific',
      description: 'Deal term benchmarks and strategic considerations for APAC out-licensing transactions.',
      badge: 'Data Report',
    },
    {
      href: '/guides/biotech-licensing-deal-structure',
      title: 'Biotech Licensing Deal Structure Guide',
      description: 'A tactical guide to structuring upfronts, milestones, and royalties for optimal deal economics.',
      badge: 'Guide',
    },
  ];

  return (
    <>
      <ScrollProgress />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetSchema) }} />

      <main className="min-h-screen bg-white">
        <InsightPageHeader
          title="Biopharma Deal Terms by Therapeutic Area: A 12-TA Comparison"
          titleAccent={{ text: '12-TA Comparison', color: 'text-blue-400' }}
          subtitle="Metabolic/obesity now commands the highest total deal values. Immunology leads Phase 2 upfronts. A comprehensive benchmark comparison across every major therapeutic area."
          badge="Data Report"
          readTime="14 min read"
          stats={[
            { value: '12', label: 'Therapeutic areas' },
            { value: '$4.5B', label: 'Highest Phase 3 TDV' },
            { value: '2,600+', label: 'Deals analyzed' },
          ]}
          breadcrumbLabel="Deal Terms by TA"
        />

        <article className="max-w-3xl mx-auto px-4 py-12">
          <AuthorByline date="2026-03-24" />

          <KeyTakeaways
            takeaways={[
              'Metabolic/obesity commands the highest Phase 2 total deal values ($2.0B median) — surpassing oncology — driven by GLP-1 commercial potential.',
              'Immunology Phase 2 upfronts ($120M median) exceed oncology ($95M) following the Merck/Prometheus $10.8B validation of anti-TL1A.',
              'The Phase 2\u2192Phase 3 premium is 2.5-3.5x across all TAs, making proof-of-concept the universal value inflection point.',
              'Therapeutic area selection alone can swing Phase 2 upfront by 3.8x ($40M women\u2019s health vs $150M metabolic).',
            ]}
          />

          <TableOfContents items={tocItems} />

          <div className="prose prose-slate prose-lg max-w-none">
            <TrustBar />

            <p>
              Therapeutic area is the second most important variable in biopharma deal economics, after development phase. A Phase 2 <Link href="/therapeutic-areas/immunology" className="text-teal-600 font-medium hover:text-teal-700">immunology</Link> asset and a Phase 2 dermatology asset may have identical clinical data packages, but the licensing terms they command can differ by 3x or more on <Link href="/glossary/upfront-payment" className="text-teal-600 font-medium hover:text-teal-700">upfront</Link> alone. Understanding these TA-specific dynamics is not optional for deal professionals — it is the difference between leaving hundreds of millions on the table and negotiating from an informed position.
            </p>

            <p>
              This analysis benchmarks deal terms across all 12 major therapeutic areas at both Phase 2 and Phase 3, the two most active licensing windows. For each TA, we report median upfront payments and median total deal values, anchored by real marquee transactions that define the current market. For the full methodology behind these benchmarks, see our <Link href="/benchmarks" className="text-teal-600 font-medium hover:text-teal-700">benchmark database</Link>.
            </p>

            <p>
              The data reveals three critical shifts that are reshaping deal economics in 2026: metabolic/obesity&apos;s ascent to the highest-valued therapeutic area, immunology&apos;s continued premium driven by validated biology, and the emergence of previously &quot;quiet&quot; TAs like gastroenterology and dermatology as serious deal markets.
            </p>

            <h2 id="phase-2-benchmarks">Phase 2 Deal Benchmarks: 12 Therapeutic Areas</h2>

            <p>
              Phase 2 is the proof-of-concept inflection point where the majority of biopharma out-licensing occurs. The table below shows median upfront payments and total deal values for Phase 2 assets across all 12 benchmarked therapeutic areas. The spread is remarkable: a Phase 2 metabolic asset commands nearly 4x the upfront of a Phase 2 women&apos;s health asset. For a closer look at how <Link href="/insights/phase-2-milestone-payment-benchmarks" className="text-teal-600 font-medium hover:text-teal-700">Phase 2 milestone payments</Link> layer on top of these upfronts, see our dedicated report.
            </p>
          </div>

          <GatedBenchmarkTable
            headers={['Therapeutic Area', 'Median Upfront', 'Median Total Value', 'Upfront/TDV Ratio']}
            rows={[
              [<strong key="met" className="text-blue-700">Metabolic / Obesity</strong>, <strong key="met-u" className="text-blue-700">$150M</strong>, <strong key="met-t" className="text-blue-700">$2.0B</strong>, '7.5%'],
              [<strong key="imm" className="text-blue-700">Immunology</strong>, <strong key="imm-u" className="text-blue-700">$120M</strong>, <strong key="imm-t" className="text-blue-700">$1.5B</strong>, '8.0%'],
              ['Oncology', '$95M', '$1.1B', '8.6%'],
              ['Hematology', '$80M', '$950M', '8.4%'],
              ['Neurology', '$75M', '$900M', '8.3%'],
              ['Gastroenterology', '$70M', '$850M', '8.2%'],
              ['Cardiovascular', '$65M', '$800M', '8.1%'],
              ['Rare Disease', '$60M', '$750M', '8.0%'],
              ['Ophthalmology', '$55M', '$650M', '8.5%'],
              ['Infectious Disease', '$50M', '$600M', '8.3%'],
              ['Dermatology', '$45M', '$550M', '8.2%'],
              ['Women\'s Health', '$40M', '$500M', '8.0%'],
            ]}
            freeRows={5}
            ctaText="Unlock all 12 TA benchmarks — Pro subscription"
            ctaHref="/#pricing"
            footnote="Phase 2 medians from Ambrosia Ventures database (2020-2026). TDV = Total Deal Value including milestones."
          />

          <PhaseUpfrontChart
            data={[
              { phase: 'Metabolic', low: 75, median: 150, high: 300 },
              { phase: 'Immunology', low: 60, median: 120, high: 250 },
              { phase: 'Oncology', low: 45, median: 95, high: 200 },
              { phase: 'Hematology', low: 40, median: 80, high: 170 },
              { phase: 'Neurology', low: 35, median: 75, high: 160 },
              { phase: 'GI', low: 35, median: 70, high: 145 },
              { phase: 'Cardio', low: 30, median: 65, high: 135 },
              { phase: 'Rare Dis.', low: 30, median: 60, high: 130 },
              { phase: 'Ophthalm.', low: 25, median: 55, high: 115 },
              { phase: 'Infect. Dis.', low: 25, median: 50, high: 100 },
              { phase: 'Dermatol.', low: 20, median: 45, high: 90 },
              { phase: "Women's H.", low: 20, median: 40, high: 85 },
            ]}
            title="Phase 2 Median Upfront Across 12 Therapeutic Areas"
            yLabel="Median Upfront ($M)"
          />

          <div className="prose prose-slate prose-lg max-w-none">
            <h2 id="phase-3-benchmarks">Phase 3 Deal Benchmarks: 12 Therapeutic Areas</h2>

            <p>
              Phase 3 deal economics shift dramatically. The risk of pivotal trial failure narrows the valuation range between TAs, but the absolute numbers increase substantially. Metabolic/obesity assets at Phase 3 command a staggering $4.5 billion in median total deal value — a reflection of the GLP-1 revolution and the massive commercial models now validated by Novo Nordisk and Eli Lilly.
            </p>
          </div>

          <GatedBenchmarkTable
            headers={['Therapeutic Area', 'Median Upfront', 'Median Total Value', 'Ph2-to-Ph3 Multiplier']}
            rows={[
              [<strong key="met3" className="text-blue-700">Metabolic / Obesity</strong>, <strong key="met3-u" className="text-blue-700">$400M</strong>, <strong key="met3-t" className="text-blue-700">$4.5B</strong>, '2.25x'],
              [<strong key="imm3" className="text-blue-700">Immunology</strong>, <strong key="imm3-u" className="text-blue-700">$300M</strong>, <strong key="imm3-t" className="text-blue-700">$3.2B</strong>, '2.13x'],
              ['Oncology', '$230M', '$2.5B', '2.27x'],
              ['Hematology', '$200M', '$2.2B', '2.32x'],
              ['Neurology', '$180M', '$2.0B', '2.22x'],
              ['Gastroenterology', '$170M', '$1.9B', '2.24x'],
              ['Cardiovascular', '$160M', '$1.8B', '2.25x'],
              ['Rare Disease', '$140M', '$1.7B', '2.27x'],
              ['Ophthalmology', '$130M', '$1.5B', '2.31x'],
              ['Infectious Disease', '$120M', '$1.4B', '2.33x'],
              ['Dermatology', '$100M', '$1.2B', '2.18x'],
              ['Women\'s Health', '$90M', '$1.1B', '2.20x'],
            ]}
            freeRows={4}
            ctaText="Unlock all 12 Phase 3 TA benchmarks — Pro subscription"
            ctaHref="/#pricing"
            footnote="Phase 3 medians from Ambrosia Ventures database (2020-2026). Multiplier shows Phase 3 TDV / Phase 2 TDV."
          />

          <InsightCallout title="The Phase 2-to-Phase 3 multiplier is remarkably consistent">
            <p>
              Across all 12 therapeutic areas, the Phase 2-to-Phase 3 total deal value multiplier falls in a narrow 2.13x-2.33x range. This means the relative premium for Phase 3 data is approximately the same regardless of TA — what varies dramatically is the absolute base from which that multiplier applies. A 2.25x multiplier on a $2B metabolic Phase 2 deal yields $4.5B; the same multiplier on a $500M women&apos;s health deal yields $1.1B.
            </p>
          </InsightCallout>

          <InsightCTA
            variant="mid"
            heading="Model Any TA at Any Phase"
            description="Select your therapeutic area, phase, and modality to generate deal benchmarks calibrated to your specific asset profile."
          />

          <MiniCalculator defaultTA="immunology" defaultPhase="phase2" defaultModality="smallMolecule" />

          <div className="prose prose-slate prose-lg max-w-none">
            <h2 id="metabolic-obesity">Why Metabolic/Obesity Now Commands the Highest Valuations</h2>

            <p>
              The metabolic/obesity therapeutic area has undergone a complete repricing over the past three years. As recently as 2022, metabolic deals were a middle-of-the-pack category, with total values roughly comparable to cardiovascular. The catalyst was not a single deal but a convergence of forces that created the largest addressable market in pharmaceutical history.
            </p>

            <p>
              <strong>The GLP-1 revolution</strong> validated a commercial model that few had imagined possible. Novo Nordisk&apos;s Wegovy and Eli Lilly&apos;s Zepbound demonstrated that anti-obesity drugs could achieve unprecedented patient demand, with combined revenues projected to exceed $100 billion annually by 2030. This created a race among every major pharma company to secure pipeline assets in the GLP-1 and related pathways.
            </p>

            <p>
              <strong>Marquee deal: Novo Nordisk / Catalent ($16.5B, 2024).</strong> While technically a manufacturing acquisition, this deal was driven entirely by GLP-1 production capacity. It signaled that the metabolic space had become so valuable that companies would spend tens of billions simply to ensure supply. The <strong>Eli Lilly</strong> portfolio of mounjaro licensing deals, exceeding $3.2 billion in aggregate, further anchored the TA&apos;s premium.
            </p>

            <p>
              For biotech founders with metabolic assets, the implication is clear: the market is willing to pay 2-3x the historical norm for credible obesity and diabetes programs, particularly those offering oral formulations, next-generation mechanisms (amylin agonists, GDF15, GIPR antagonists), or combination approaches. However, the bar for &quot;credible&quot; is rising as the competitive landscape intensifies.
            </p>

            <h2 id="immunology-premium">Immunology&apos;s Hidden Premium</h2>

            <p>
              <Link href="/therapeutic-areas/immunology" className="text-teal-600 font-medium hover:text-teal-700">Immunology</Link> has quietly become the second highest-valued therapeutic area, commanding Phase 2 upfronts of $120M and Phase 3 total values of $3.2B. Two factors drive this premium.
            </p>

            <p>
              <strong>First, the anti-TL1A wave.</strong> The <strong>Merck / Prometheus deal ($10.8B)</strong> for an anti-TL1A antibody in Crohn&apos;s disease reset market expectations for the entire inflammatory bowel disease space. TL1A inhibition is emerging as the next major mechanism in autoimmune disease, with applications across IBD, fibrotic diseases, and potentially atopic dermatitis. Every major pharma company is now seeking TL1A-class assets, creating intense competition that drives valuations higher.
            </p>

            <p>
              <strong>Second, CAR-T in autoimmune disease.</strong> The application of CAR-T cell therapy to autoimmune conditions (lupus, scleroderma, myasthenia gravis) is generating remarkable early clinical data. While deal volume is still limited, the few transactions that have occurred suggest valuations comparable to CAR-T oncology deals, with the added advantage of a much larger addressable patient population.
            </p>

            <p>
              <strong>Roche / Telavant ($7.1B)</strong> further anchored immunology&apos;s premium, demonstrating that acquirers will pay aggressive multiples for validated immunology mechanisms even at relatively early stages of development. For context on how <Link href="/insights/pharma-licensing-royalty-rates" className="text-teal-600 font-medium hover:text-teal-700">royalty rates</Link> differ in immunology versus other TAs, see our royalty benchmark report.
            </p>

            <h2 id="emerging-hotspots">Emerging TA Hotspots</h2>

            <p>
              Beyond the headline TAs, three areas are experiencing meaningful deal activity increases that are reshaping their benchmark ranges.
            </p>

            <p>
              <strong>Gastroenterology</strong> has been transformed by the anti-TL1A biology that spans both immunology and GI classifications. The Merck/Prometheus deal anchored in Crohn&apos;s disease created ripple effects across the entire GI space, pulling up valuations for assets targeting ulcerative colitis, celiac disease, and eosinophilic GI disorders. Phase 2 GI upfronts have risen from $40M to $70M in just two years.
            </p>

            <p>
              <strong>Dermatology</strong> is experiencing renewed interest driven by JAK inhibitor competition, TYK2 inhibitor development, and the expanding atopic dermatitis market. While absolute deal values remain modest ($45M upfront at Phase 2), the year-over-year growth rate in dermatology deal volume is among the highest across all TAs. The <strong>Pfizer / Arena</strong> partnership in dermatologic conditions signaled that major pharma is willing to invest in the space.
            </p>

            <p>
              <strong>Rare disease</strong> continues to command orphan drug premiums that defy its small patient populations. Seven-year market exclusivity, accelerated FDA pathways, and pricing power ($200K-500K+ per patient annually) allow rare disease deals to approach or exceed the per-deal values of much larger therapeutic areas. The <strong>Vertex / Alpine ($4.9B)</strong> deal for IgA nephropathy demonstrated that the rare disease premium remains intact. For a comprehensive overview of rare disease deal dynamics, explore our <Link href="/therapeutic-areas/oncology" className="text-teal-600 font-medium hover:text-teal-700">therapeutic area benchmarks</Link> starting with oncology.
            </p>

            <h2 id="marquee-deals">Marquee Deals by Therapeutic Area</h2>

            <p>
              The following transactions represent the market-defining deal in each of the six highest-valued therapeutic areas:
            </p>

            <ul>
              <li><strong>Metabolic:</strong> Novo Nordisk / Catalent — $16.5B (2024). GLP-1 manufacturing capacity acquisition that signaled the scale of the obesity opportunity.</li>
              <li><strong>Immunology:</strong> Merck / Prometheus — $10.8B. Anti-TL1A for Crohn&apos;s disease. Reset valuation expectations for the entire autoimmune space.</li>
              <li><strong>Neurology:</strong> AbbVie / Cerevel — $8.7B. Broad <Link href="/therapeutic-areas/neurology" className="text-teal-600 font-medium hover:text-teal-700">neuroscience</Link> portfolio including schizophrenia, Parkinson&apos;s, and mood disorders.</li>
              <li><strong>Oncology:</strong> Pfizer / Seagen — $43B (2023). The largest <Link href="/therapeutic-areas/oncology" className="text-teal-600 font-medium hover:text-teal-700">oncology</Link> deal in history, driven by the ADC platform and commercial franchise.</li>
              <li><strong>Cardiovascular:</strong> BridgeBio / Astellas — $1.7B ex-US. ATTR cardiomyopathy with mid-single to low-double digit tiered royalties.</li>
              <li><strong>Rare Disease:</strong> Vertex / Alpine — $4.9B. IgA nephropathy program demonstrating rare disease premium intact.</li>
            </ul>

            <p>
              Each of these deals reflects TA-specific dynamics: metabolic rewards manufacturing scale, immunology rewards validated mechanisms, neurology rewards broad portfolio coverage, and oncology rewards platform-level technology. For additional detail on how <Link href="/glossary/upfront-payment" className="text-teal-600 font-medium hover:text-teal-700">upfront payments</Link> are structured in these marquee transactions, see our glossary.
            </p>
          </div>

          <InsightCallout title="Cross-TA portfolio strategy">
            <p>
              If your company has assets spanning multiple therapeutic areas, deal timing should account for TA-specific premiums. It may be optimal to out-license a Phase 2 metabolic asset (at $150M upfront) before a Phase 2 neurology asset (at $75M), even if the neurology asset is further along clinically. The TA premium can outweigh a full phase advance in some comparisons.
            </p>
          </InsightCallout>

          <div className="prose prose-slate prose-lg max-w-none">
            <h2 id="faq">Frequently Asked Questions</h2>
          </div>

          <div className="my-8 space-y-0">
            <details className="group border-b border-slate-200 py-4">
              <summary className="flex items-center justify-between cursor-pointer text-lg font-semibold text-slate-900 hover:text-teal-700">
                <span>Which therapeutic area has the highest total deal values?</span>
                <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="mt-3 text-slate-600 leading-relaxed">
                Metabolic/obesity now commands the highest total deal values at both Phase 2 ($2.0B median) and Phase 3 ($4.5B median), driven by the GLP-1 revolution and commercial models validated by Novo Nordisk and Eli Lilly. Immunology is the close second at Phase 3 with $3.2B median total deal value.
              </div>
            </details>

            <details className="group border-b border-slate-200 py-4">
              <summary className="flex items-center justify-between cursor-pointer text-lg font-semibold text-slate-900 hover:text-teal-700">
                <span>Why does immunology command such high Phase 2 upfronts?</span>
                <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="mt-3 text-slate-600 leading-relaxed">
                Immunology Phase 2 upfronts ($120M median) are driven by large addressable patient populations, validated commercial models from the anti-TNF and anti-IL class, and recent mega-deals (Merck/Prometheus at $10.8B, Roche/Telavant at $7.1B) that reset valuation expectations. The emerging anti-TL1A and autoimmune CAR-T waves further intensify competition for assets.
              </div>
            </details>

            <details className="group border-b border-slate-200 py-4">
              <summary className="flex items-center justify-between cursor-pointer text-lg font-semibold text-slate-900 hover:text-teal-700">
                <span>How does oncology compare to other TAs on a per-deal basis?</span>
                <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="mt-3 text-slate-600 leading-relaxed">
                Oncology remains the highest-volume deal market but no longer commands the highest per-deal values. Phase 2 oncology upfronts ($95M median) trail immunology ($120M) and metabolic ($150M). At Phase 3, oncology ($2.5B) ranks third behind metabolic ($4.5B) and immunology ($3.2B). Oncology&apos;s strength is deal volume, not per-deal premium.
              </div>
            </details>

            <details className="group border-b border-slate-200 py-4">
              <summary className="flex items-center justify-between cursor-pointer text-lg font-semibold text-slate-900 hover:text-teal-700">
                <span>What makes rare disease deals different?</span>
                <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="mt-3 text-slate-600 leading-relaxed">
                Rare disease deals command orphan drug premiums: 7-year market exclusivity, accelerated FDA pathways, and pricing power of $200K-500K+ per patient annually. Despite small patient populations (often under 50,000), Phase 2 total values ($750M) and Phase 3 values ($1.7B) rival much larger therapeutic areas due to these regulatory and commercial advantages.
              </div>
            </details>

            <details className="group border-b border-slate-200 py-4">
              <summary className="flex items-center justify-between cursor-pointer text-lg font-semibold text-slate-900 hover:text-teal-700">
                <span>Which TAs are growing fastest in deal activity?</span>
                <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="mt-3 text-slate-600 leading-relaxed">
                Gastroenterology, dermatology, and metabolic/obesity are experiencing the fastest growth in deal activity and valuations. GI has been transformed by anti-TL1A biology (Merck/Prometheus), with Phase 2 upfronts rising from $40M to $70M in two years. Dermatology is growing from JAK/TYK2 inhibitor competition. Metabolic deal values have roughly tripled since 2022 due to the GLP-1 revolution.
              </div>
            </details>
          </div>

          <InlineEmailCapture source="deal-terms-by-ta" />

          <RelatedInsights articles={relatedArticles} />

          <InsightCTA
            variant="bottom"
            heading="Benchmark Your Therapeutic Area"
            description="Generate deal benchmarks for your specific therapeutic area, phase, and modality — calibrated from 2,600+ real transactions across 12 TAs."
          />
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
