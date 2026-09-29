/**
 * /search-and-evaluation — the public, indexable page for the Search &
 * Evaluation module. The feed itself (/radar) is Pro-gated and noindex; this
 * page carries the SEO surface: SoftwareApplication, FAQ and breadcrumb
 * JSON-LD, OG image, canonical, sitemap entry (app/sitemap.ts).
 *
 * Coverage copy is written as floors and stays honest about what is and is
 * not in the universe (registry-derived, industry sponsors; preclinical only
 * where a company disclosed the program in a filing).
 */

import type { Metadata } from 'next';
import { LIVE_DEAL_COUNT, formatDealCount, PRICING } from '@/lib/config/constants';
import { generateBreadcrumbSchema, generateFAQSchema, generateWebPageSchema } from '@/lib/seo/structured-data';
import { radarBacktested } from '@/lib/radar/backtested';
import { SearchEvaluationLanding } from '@/components/radar/landing/SearchEvaluationLanding';
import { notFound } from 'next/navigation';
import { RADAR_PUBLIC } from '@/lib/radar/launch';
import { radarAccessible } from '@/lib/radar/launch-server';

const BASE_URL = 'https://solidus.ambrosiaventures.co';
const URL = `${BASE_URL}/search-and-evaluation`;
const TITLE = 'Search & Evaluation — Screen Unpartnered Clinical-Stage Assets | Solidus';
const DESCRIPTION = `Screen 45,000+ unpartnered clinical-stage and preclinical programs from trial registries in 100 countries. Licensing-intent score shown against peers, predicted deal terms from ${formatDealCount(LIVE_DEAL_COUNT)} comparable transactions, mandates with daily digests, and an acquirer view. Included in Solidus Pro.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'biopharma asset search',
    'in-licensing opportunities',
    'unpartnered clinical assets',
    'licensing intent score',
    'biotech pipeline screening',
    'BD asset scouting tool',
    'pharma in-licensing pipeline',
    'clinical-stage asset database',
    'business development search and evaluation',
  ],
  alternates: { canonical: URL },
  // Indexable only after the public launch.
  robots: RADAR_PUBLIC ? undefined : { index: false, follow: false },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    url: URL,
    siteName: 'Solidus',
    images: [{
      url: `/api/og?title=${encodeURIComponent('Search & Evaluation')}&subtitle=${encodeURIComponent('45,000+ unpartnered programs · 100 countries · scored on evidence')}`,
      width: 1200,
      height: 630,
      alt: 'Search & Evaluation — Solidus by Ambrosia Ventures',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Search & Evaluation | Solidus',
    description: 'Screen unpartnered clinical-stage assets with a licensing-intent score and predicted deal terms.',
    images: [`/api/og?title=${encodeURIComponent('Search & Evaluation')}`],
  },
};

export const dynamic = 'force-dynamic';

const FAQS = [
  {
    question: 'What is in the Search & Evaluation universe?',
    answer: 'Clinical-stage programs (Phase 1 to Phase 3) sponsored by companies, resolved from public trial registries in 100 countries: ClinicalTrials.gov, the EU CTR and EudraCT, Japan\'s jRCT, Korea\'s CRIS, China\'s CDE registry, ANZCTR, CTRI and others. Preclinical programs are included only where the company disclosed them in an SEC filing (10-K, 20-F, S-1 or F-1), with the sentence that disclosed them shown on the asset. Academic and hospital sponsors, Phase 4 and approved products, and programs a company runs only as a comparator are excluded from the default view and reachable through filters.',
  },
  {
    question: 'What does the licensing-intent score predict?',
    answer: 'The probability that a program is announced as licensed, optioned or acquired within twelve months. It is trained on announced deals and shown as a percentile within the asset\'s phase and therapeutic-area peers, with each factor\'s source and a confidence figure. The out-of-sample backtest (ROC-AUC, precision at 50 and 100, lift, calibration) is published on the methodology page and updated every retrain.',
  },
  {
    question: 'Where do the predicted deal terms come from?',
    answer: `From the same ${formatDealCount(LIVE_DEAL_COUNT)} verified transactions behind the Solidus benchmarks. Each asset's upfront, total and royalty ranges are drawn from phase-matched comparables in the same therapeutic area and modality, and the comparables are listed on the asset so the range can be checked.`,
  },
  {
    question: 'How does "unpartnered" get decided?',
    answer: 'Each asset is checked against the deal database, the trial\'s collaborators, drug ownership records and press releases. "No partner found" always lists what was checked, and partnered assets carry the deal or the source that established the partnership.',
  },
  {
    question: 'What is a mandate?',
    answer: 'Saved buyer criteria: therapeutic areas, modalities, phase range, geography, partnership status and minimum scores. New matches arrive as a daily or weekly digest by email, Slack or in-app, and every match can be saved or dismissed. Templates cover common archetypes such as a mid-cap oncology in-licensing team or a Japanese pharma seeking ex-Asia rights.',
  },
  {
    question: 'What is the acquirer view?',
    answer: 'Pick a buyer and see the programs that fit its portfolio gaps: patent cliffs, thin therapeutic areas, missing modalities, pipeline stage. Each recommendation carries the asset\'s intent score, a fit score and predicted terms.',
  },
  {
    question: 'Is Search & Evaluation included in Pro?',
    answer: `Yes. It is part of Solidus Pro (${PRICING.PRO_MONTHLY}) alongside the calculation engines, benchmarks, company intelligence and Market Pulse. Portfolio plans add shared mandates, an organisation watchlist and Slack delivery.`,
  },
];

export default async function SearchEvaluationPage() {
  if (!(await radarAccessible())) notFound();
  const backtested = await radarBacktested();
  const faqSchema = generateFAQSchema(FAQS);
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: BASE_URL },
    { name: 'Search & Evaluation', url: URL },
  ]);
  const webPageSchema = generateWebPageSchema({ name: TITLE, description: DESCRIPTION, url: URL });
  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Solidus Search & Evaluation',
    description: DESCRIPTION,
    url: URL,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Biopharma business development',
    operatingSystem: 'Web',
    isPartOf: { '@type': 'SoftwareApplication', name: 'Solidus', url: BASE_URL },
    offers: { '@type': 'Offer', price: '299', priceCurrency: 'USD', description: 'Included in Solidus Pro, billed monthly' },
    featureList: [
      'Licensing-intent score per asset with peer percentile and published backtest',
      'Predicted deal terms per asset from cited comparable transactions',
      'Mandates with daily or weekly digests',
      'Acquirer view by company',
      'Watchlist, alert rules and saved views',
      'Excel and PDF export',
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} />
      <SearchEvaluationLanding backtested={backtested} faqs={FAQS} dealCount={formatDealCount(LIVE_DEAL_COUNT)} />
    </>
  );
}
