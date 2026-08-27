import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import CompanyPageClient from './CompanyPageClient';

// ISR: regenerate company pages every hour
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('companies')
    .select('id')
    .order('deals_last_12mo', { ascending: false, nullsFirst: false })
    .limit(200);
  return (data || []).map((c) => ({ companyId: c.id }));
}

const BASE_URL = 'https://solidus.ambrosiaventures.co';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Props {
  params: Promise<{ companyId: string }>;
}

// ─── Label Helpers ─────────────────────────────────────────

const COMPANY_TYPE_LABELS: Record<string, string> = {
  large_pharma: 'Large Pharma',
  mid_pharma: 'Mid-Size Pharma',
  large_biotech: 'Large Biotech',
  mid_biotech: 'Biotech',
  specialty: 'Specialty Pharma',
};

const MODALITY_LABELS: Record<string, string> = {
  adc: 'ADC',
  car_t: 'CAR-T',
  bispecific_antibody: 'Bispecific Antibodies',
  bispecific: 'Bispecific Antibodies',
  small_molecule: 'Small Molecules',
  smallMolecule: 'Small Molecules',
  gene_therapy: 'Gene Therapy',
  geneTherapy: 'Gene Therapy',
  radiopharmaceutical: 'Radiopharmaceuticals',
  radiopharm: 'Radiopharmaceuticals',
  monoclonal_antibody: 'Monoclonal Antibodies',
  monoclonalAntibody: 'Monoclonal Antibodies',
  mrna: 'mRNA',
  rnaTherapeutic: 'RNA Therapeutics',
  rnai: 'RNAi',
  antibody: 'Antibodies',
  peptide: 'Peptides',
  cell_therapy: 'Cell Therapy',
  cellTherapy: 'Cell Therapy',
  protac: 'PROTACs',
  molecularGlue: 'Molecular Glues',
  oligonucleotide: 'Oligonucleotides',
  aso: 'ASO',
  vaccine: 'Vaccines',
};

const TA_LABELS: Record<string, string> = {
  oncology: 'Oncology',
  neurology: 'Neurology',
  immunology: 'Immunology',
  cardiovascular: 'Cardiovascular',
  metabolic: 'Metabolic',
  rareDisease: 'Rare Disease',
  rare_disease: 'Rare Disease',
  infectiousDisease: 'Infectious Disease',
  infectious_disease: 'Infectious Disease',
  ophthalmology: 'Ophthalmology',
  dermatology: 'Dermatology',
  womensHealth: "Women's Health",
  gastroenterology: 'Gastroenterology',
  hematology: 'Hematology',
  solid_tumor: 'Solid Tumors',
  hematological: 'Hematological Malignancies',
  cns: 'CNS Disorders',
  autoimmune: 'Autoimmune',
  respiratory: 'Respiratory',
};

// Map TA keys to their route slugs for internal linking
const TA_ROUTE_SLUGS: Record<string, string> = {
  oncology: 'oncology',
  neurology: 'neurology',
  immunology: 'immunology',
  cardiovascular: 'cardiovascular',
  metabolic: 'metabolic',
  rareDisease: 'rareDisease',
  rare_disease: 'rareDisease',
  infectiousDisease: 'infectiousDisease',
  infectious_disease: 'infectiousDisease',
  ophthalmology: 'ophthalmology',
  dermatology: 'dermatology',
  womensHealth: 'womensHealth',
  gastroenterology: 'gastroenterology',
  hematology: 'hematology',
};

const PHASE_LABELS: Record<string, string> = {
  preclinical: 'Preclinical',
  phase_1: 'Phase 1',
  phase_1_2: 'Phase 1/2',
  phase_2: 'Phase 2',
  phase_2_3: 'Phase 2/3',
  phase_3: 'Phase 3',
  approved: 'Approved',
};

const APPETITE_LABELS: Record<string, string> = {
  aggressive: 'Aggressive',
  moderate: 'Moderate',
  selective: 'Selective',
  low: 'Low',
};

function fmtModality(m: string): string {
  return MODALITY_LABELS[m] || m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmtTA(ta: string): string {
  return TA_LABELS[ta] || ta.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmtPhase(p: string): string {
  return PHASE_LABELS[p] || p.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmtUSD(val: number | null | undefined): string {
  if (val == null) return 'Undisclosed';
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(0)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return 'Date undisclosed';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Date undisclosed';
  // Full date if day is available (not a year-month-only string with day=01)
  const day = d.getUTCDate();
  const isMonthOnly = day === 1 && dateStr.length <= 7; // e.g. "2025-03"
  if (isMonthOnly) {
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** Returns true when announced_date looks suspicious and should show a warning */
function isDateSuspicious(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  // Future date
  if (d.getTime() > now.getTime()) return true;
  // More than 5 years old
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  if (d.getTime() < fiveYearsAgo.getTime()) return true;
  // Exactly Jan 1 of a year (often a placeholder)
  if (d.getUTCMonth() === 0 && d.getUTCDate() === 1) return true;
  return false;
}

// ─── Server Data Fetching ──────────────────────────────────

async function getCompanySEOData(companyId: string) {
  const supabase = createServiceClient();

  // Fetch company profile
  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  if (error || !company) return null;

  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const threeYearsAgo = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Sanitize company name for PostgREST filter
  const companyName = (company.name || '').replace(/[,.()"'\\]/g, '').replace(/[%_]/g, '\\$&');

  // Parallel queries for SEO-visible data
  const [recentDealsResult, trialsResult, trendDealsResult] = await Promise.all([
    // Recent deals (last 12 months)
    // R68: exclude is_synthetic=true so 845 flagged fakes stay off
    // company-detail pages shown to BD users.
    supabase
      .from('deals')
      .select('id, licensor_name, licensee_name, asset_name, modality, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, indication_category, therapeutic_area, deal_type, milestones_total_usd, royalty_low_pct, royalty_high_pct, terms_disclosed')
      .or(`licensee_id.eq.${companyId},licensor_id.eq.${companyId},licensee_name.eq.${companyName},licensor_name.eq.${companyName}`)
      .eq('is_synthetic', false)
      .gte('announced_date', oneYearAgo)
      .order('announced_date', { ascending: false })
      .limit(20),

    // Active trials
    supabase
      .from('company_trials')
      .select('nct_id, trial_title, phase, status, modality, indication_category, start_date')
      .eq('company_id', companyId)
      .in('status', ['recruiting', 'active_not_recruiting', 'enrolling_by_invitation', 'not_yet_recruiting'])
      .order('start_date', { ascending: false })
      .limit(50),

    // 3-year deal count for trend (R68: filter flagged fakes)
    supabase
      .from('deals')
      .select('announced_date, modality, indication_category, therapeutic_area')
      .or(`licensee_id.eq.${companyId},licensor_id.eq.${companyId},licensee_name.eq.${companyName},licensor_name.eq.${companyName}`)
      .eq('is_synthetic', false)
      .gte('announced_date', threeYearsAgo),
  ]);

  const deals = recentDealsResult.data || [];
  const trials = trialsResult.data || [];
  const trendDeals = trendDealsResult.data || [];

  // Aggregate: deals by TA
  const dealsByTA: Record<string, number> = {};
  const dealsByModality: Record<string, number> = {};
  for (const d of [...deals, ...trendDeals]) {
    const ta = d.therapeutic_area || d.indication_category;
    if (ta) dealsByTA[ta] = (dealsByTA[ta] || 0) + 1;
    if (d.modality) dealsByModality[d.modality] = (dealsByModality[d.modality] || 0) + 1;
  }

  // Aggregate: trials by TA / phase
  const trialsByTA: Record<string, number> = {};
  const trialsByPhase: Record<string, number> = {};
  for (const t of trials) {
    if (t.indication_category) trialsByTA[t.indication_category] = (trialsByTA[t.indication_category] || 0) + 1;
    if (t.phase) trialsByPhase[t.phase] = (trialsByPhase[t.phase] || 0) + 1;
  }

  // Top TAs (combined deals + trials)
  const combinedTA: Record<string, number> = {};
  for (const [k, v] of Object.entries(dealsByTA)) combinedTA[k] = (combinedTA[k] || 0) + v;
  for (const [k, v] of Object.entries(trialsByTA)) combinedTA[k] = (combinedTA[k] || 0) + v;
  const topTAs = Object.entries(combinedTA).sort(([, a], [, b]) => b - a).slice(0, 6);

  // Top modalities
  const topModalities = Object.entries(dealsByModality).sort(([, a], [, b]) => b - a).slice(0, 6);

  return {
    company,
    deals,
    trials,
    trendDeals,
    topTAs,
    topModalities,
    dealsByTA,
    dealsByModality,
    trialsByTA,
    trialsByPhase,
  };
}

// ─── Metadata ──────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { companyId } = await params;

  if (!UUID_REGEX.test(companyId)) {
    return { title: 'Company Not Found | Ambrosia Ventures' };
  }

  try {
    const data = await getCompanySEOData(companyId);
    if (!data) {
      return { title: 'Company Not Found | Ambrosia Ventures' };
    }

    const { company, deals, topTAs, topModalities } = data;
    const typeLabel = COMPANY_TYPE_LABELS[company.company_type] || 'Life Sciences';

    // Build keyword-rich title targeting search intent
    const title = `${company.name} Deal History & Licensing Activity | Ambrosia Ventures`;

    // Build rich description targeting "[company] licensing deals 2025 2026"
    const taNames = topTAs.slice(0, 3).map(([k]) => fmtTA(k)).join(', ');
    const modNames = topModalities.slice(0, 2).map(([k]) => fmtModality(k)).join(' & ');
    const dealCount = deals.length;
    const currentYear = new Date().getFullYear();

    let description = `${company.name} (${typeLabel}) licensing deals, pipeline activity, and deal benchmarks ${currentYear - 1}-${currentYear}.`;
    if (dealCount > 0) {
      description += ` ${dealCount} recent transaction${dealCount !== 1 ? 's' : ''}`;
      if (modNames) description += ` in ${modNames}`;
      description += '.';
    }
    if (taNames) {
      description += ` Active in ${taNames}.`;
    }
    description += ' Compare deal terms, patent cliffs, and competitive positioning.';

    // Build keywords
    const keywords = [
      company.name,
      `${company.name} deals`,
      `${company.name} licensing`,
      `${company.name} pipeline`,
      `${company.name} acquisitions`,
      `${company.name} ${currentYear}`,
      ...topTAs.slice(0, 3).map(([k]) => `${company.name} ${fmtTA(k)}`),
      ...topModalities.slice(0, 2).map(([k]) => `${fmtModality(k)} deals`),
      'pharma licensing deals',
      'biotech deal benchmarks',
    ];

    const ogImageUrl = `${BASE_URL}/api/og?title=${encodeURIComponent(company.name)}&subtitle=${encodeURIComponent(`${typeLabel} | Deal Intelligence`)}&type=company`;

    return {
      title,
      description,
      keywords: keywords.join(', '),
      openGraph: {
        title: `${company.name} — ${typeLabel} Deal History & Pipeline`,
        description,
        url: `${BASE_URL}/companies/${companyId}`,
        type: 'profile',
        images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${company.name} Deal Intelligence` }],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${company.name} — ${typeLabel} Deal Intelligence`,
        description,
        images: [ogImageUrl],
      },
      alternates: {
        canonical: `${BASE_URL}/companies/${companyId}`,
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch {
    return { title: 'Company Profile | Ambrosia Ventures' };
  }
}

// ─── Page Component ────────────────────────────────────────

export default async function CompanyPage({ params }: Props) {
  const { companyId } = await params;

  if (!UUID_REGEX.test(companyId)) {
    notFound();
  }

  let data;
  try {
    data = await getCompanySEOData(companyId);
  } catch {
    data = null;
  }

  if (!data) {
    notFound();
  }

  const {
    company,
    deals,
    trials,
    trendDeals,
    topTAs,
    topModalities,
    trialsByPhase,
  } = data;

  const typeLabel = COMPANY_TYPE_LABELS[company.company_type] || 'Life Sciences';
  const currentYear = new Date().getFullYear();

  // ─── Structured Data: Organization ─────────────────────
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: company.name,
    url: company.website_url || `${BASE_URL}/companies/${companyId}`,
    description: `${company.name} is a ${typeLabel.toLowerCase()} company${company.hq_country ? ` headquartered in ${company.hq_country}` : ''}. Deal history, pipeline analysis, and licensing benchmarks from Ambrosia Ventures.`,
    ...(company.hq_country && {
      address: {
        '@type': 'PostalAddress',
        addressCountry: company.hq_country,
      },
    }),
    ...(company.ticker && { tickerSymbol: company.ticker }),
    numberOfEmployees: undefined,
    industry: typeLabel,
    sameAs: company.website_url ? [company.website_url] : undefined,
  };

  // ─── Structured Data: BreadcrumbList ───────────────────
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Companies', item: `${BASE_URL}/companies` },
      { '@type': 'ListItem', position: 3, name: company.name },
    ],
  };

  // ─── Structured Data: ItemList for deals ───────────────
  const dealsWithNames = deals.filter(d => d.asset_name || d.licensor_name || d.licensee_name);
  const dealListSchema = dealsWithNames.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${company.name} Recent Licensing Deals`,
    description: `Recent licensing and acquisition deals involving ${company.name}`,
    numberOfItems: dealsWithNames.length,
    itemListElement: dealsWithNames.slice(0, 10).map((deal, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: deal.asset_name || `${deal.licensor_name || ''} / ${deal.licensee_name || ''} deal`,
      description: [
        deal.deal_type?.replace(/_/g, ' '),
        deal.modality ? fmtModality(deal.modality) : null,
        deal.phase_at_signing ? fmtPhase(deal.phase_at_signing) : null,
        deal.announced_date ? fmtDate(deal.announced_date) : null,
      ].filter(Boolean).join(' | '),
    })),
  } : null;

  // ─── Structured Data: WebPage ──────────────────────────
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name: `${company.name} Deal History & Licensing Activity`,
    description: `Comprehensive deal intelligence for ${company.name} — licensing transactions, clinical pipeline, patent cliffs, and competitive landscape.`,
    url: `${BASE_URL}/companies/${companyId}`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Solidus',
      url: BASE_URL,
    },
    about: {
      '@type': 'Organization',
      name: company.name,
    },
    dateModified: new Date().toISOString(),
    publisher: {
      '@type': 'Organization',
      name: 'Ambrosia Ventures',
      url: BASE_URL,
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/logo.png` },
    },
  };

  // ─── Compute summary text for SEO ─────────────────────
  const totalDeals3yr = trendDeals.length;
  const topTA = topTAs[0];
  const topMod = topModalities[0];

  let summaryText = `${company.name} is a ${typeLabel.toLowerCase()}`;
  if (company.hq_country) summaryText += ` headquartered in ${company.hq_country}`;
  summaryText += '.';

  if (totalDeals3yr > 0) {
    summaryText += ` Over the past three years, ${company.name} has been involved in ${totalDeals3yr} licensing and acquisition transaction${totalDeals3yr !== 1 ? 's' : ''}`;
    if (topMod) summaryText += `, with a primary focus on ${fmtModality(topMod[0])} (${topMod[1]} deal${topMod[1] !== 1 ? 's' : ''})`;
    summaryText += '.';
  }

  if (trials.length > 0) {
    summaryText += ` The company currently has ${trials.length} active clinical trial${trials.length !== 1 ? 's' : ''}`;
    if (topTA) summaryText += `, primarily in ${fmtTA(topTA[0])}`;
    summaryText += '.';
  }

  if (company.patent_cliffs && Array.isArray(company.patent_cliffs) && company.patent_cliffs.length > 0) {
    const nearCliffs = company.patent_cliffs.filter(
      (c: { year?: number }) => c.year && c.year <= currentYear + 3
    );
    if (nearCliffs.length > 0) {
      summaryText += ` ${company.name} faces ${nearCliffs.length} patent cliff${nearCliffs.length !== 1 ? 's' : ''} through ${currentYear + 3}, which may drive increased in-licensing activity.`;
    }
  }

  // Primary TA slug for CTA link
  const primaryTASlug = topTA ? (TA_ROUTE_SLUGS[topTA[0]] || '') : '';

  // ─── Patent Cliffs Data ────────────────────────────────
  const patentCliffs = (company.patent_cliffs && Array.isArray(company.patent_cliffs))
    ? company.patent_cliffs.sort((a: { year?: number }, b: { year?: number }) => (a.year || 9999) - (b.year || 9999))
    : [];

  // Revenue at risk
  const revenueAtRisk: { year: number; amount: number }[] = [];
  if (company.revenue_at_risk_2025) revenueAtRisk.push({ year: 2025, amount: company.revenue_at_risk_2025 });
  if (company.revenue_at_risk_2026) revenueAtRisk.push({ year: 2026, amount: company.revenue_at_risk_2026 });
  if (company.revenue_at_risk_2027) revenueAtRisk.push({ year: 2027, amount: company.revenue_at_risk_2027 });

  return (
    <>
      {/* ─── Structured Data ─────────────────────────────── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      {dealListSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(dealListSchema) }}
        />
      )}

      {/* ─── Interactive Client Component (existing UI) ── */}
      <CompanyPageClient companyId={companyId} />

      {/* ─── SEO Content Layer (server-rendered, crawlable) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">

        {/* ── Company Overview (crawlable H1 + summary) ── */}
        <section className="mt-8 mb-12" aria-label="Company Overview">
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
            <div className="flex flex-wrap items-start gap-3 mb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                {typeLabel}
              </span>
              {company.hq_country && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  {company.hq_country}
                </span>
              )}
              {company.ticker && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono">
                  {company.ticker}
                </span>
              )}
              {company.acquisition_appetite && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  {APPETITE_LABELS[company.acquisition_appetite] || company.acquisition_appetite} Acquisition Appetite
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-3">
              {company.name} Deal History &amp; Licensing Activity
            </h1>

            <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed max-w-4xl">
              {summaryText}
            </p>

            {/* Quick stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Deals (12mo)</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {company.deals_last_12mo || 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Active Trials</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {trials.length || company.active_trials_count || 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Top Modality</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                  {topMod ? fmtModality(topMod[0]) : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Focus Area</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                  {topTA ? fmtTA(topTA[0]) : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Deal Activity Table (server-rendered for crawlers) ── */}
        {deals.length > 0 && (
          <section className="mb-12" aria-label="Deal Activity">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {company.name} Recent Deal Activity
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Licensing, acquisition, and partnership transactions involving {company.name} in the past 12 months.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Asset</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Partner</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Modality</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Phase</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.slice(0, 10).map((deal) => {
                    // Determine the partner (the other party)
                    const isLicensee = deal.licensee_name?.toLowerCase() === company.name.toLowerCase();
                    const partner = isLicensee ? deal.licensor_name : deal.licensee_name;
                    return (
                      <tr key={deal.id} className="border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                        <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium">
                          {deal.asset_name || 'Undisclosed'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {partner || 'Undisclosed'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {deal.modality ? fmtModality(deal.modality) : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {deal.phase_at_signing ? fmtPhase(deal.phase_at_signing) : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 capitalize">
                          {deal.deal_type?.replace(/_/g, ' ') || '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            {fmtDate(deal.announced_date)}
                            {isDateSuspicious(deal.announced_date) && (
                              <span title="Date may be estimated or approximate" className="inline-flex items-center text-amber-500 dark:text-amber-400">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              </span>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {deals.length > 10 && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Showing 10 of {deals.length} recent transactions. Upgrade to Pro for full deal history with financials.
              </p>
            )}
          </section>
        )}

        {/* ── Pipeline Focus ─────────────────────────────── */}
        {(topTAs.length > 0 || topModalities.length > 0) && (
          <section className="mb-12" aria-label="Pipeline Focus">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {company.name} Pipeline Focus
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Therapeutic areas and modalities where {company.name} is most active based on deal history and clinical trial data.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Therapeutic Areas */}
              {topTAs.length > 0 && (
                <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4 uppercase tracking-wide">
                    Therapeutic Areas
                  </h3>
                  <div className="space-y-3">
                    {topTAs.map(([ta, count]) => {
                      const maxCount = topTAs[0][1];
                      const pct = Math.round((count / maxCount) * 100);
                      const slug = TA_ROUTE_SLUGS[ta];
                      return (
                        <div key={ta}>
                          <div className="flex items-center justify-between mb-1">
                            {slug ? (
                              <Link
                                href={`/therapeutic-areas/${slug}`}
                                className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline"
                              >
                                {fmtTA(ta)}
                              </Link>
                            ) : (
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                {fmtTA(ta)}
                              </span>
                            )}
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {count} deal{count !== 1 ? 's' : ''} + trial{count !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                            <div
                              className="bg-teal-500 dark:bg-teal-400 h-2 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Top Modalities */}
              {topModalities.length > 0 && (
                <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4 uppercase tracking-wide">
                    Modalities
                  </h3>
                  <div className="space-y-3">
                    {topModalities.map(([mod, count]) => {
                      const maxCount = topModalities[0][1];
                      const pct = Math.round((count / maxCount) * 100);
                      return (
                        <div key={mod}>
                          <div className="flex items-center justify-between mb-1">
                            <Link
                              href={`/benchmarks/${mod.toLowerCase().replace(/[_\s]+/g, '-')}-deal-benchmarks`}
                              className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline"
                            >
                              {fmtModality(mod)}
                            </Link>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {count} deal{count !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                            <div
                              className="bg-blue-500 dark:bg-blue-400 h-2 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Strategic Signals ──────────────────────────── */}
        {(patentCliffs.length > 0 || company.strategic_priorities?.length > 0 || company.acquisition_appetite || revenueAtRisk.length > 0) && (
          <section className="mb-12" aria-label="Strategic Signals">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {company.name} Strategic Signals
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Key indicators of {company.name}&apos;s licensing and acquisition strategy, including patent expirations, pipeline gaps, and strategic priorities.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Patent Cliffs */}
              {patentCliffs.length > 0 && (
                <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                  <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-3 uppercase tracking-wide flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Patent Cliffs
                  </h3>
                  <ul className="space-y-2">
                    {patentCliffs.slice(0, 5).map((cliff: { drug?: string; year?: number; revenue?: number }, i: number) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 dark:text-slate-200 font-medium">
                          {cliff.drug || 'Undisclosed'}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {cliff.year || '—'}
                          {cliff.revenue ? ` (${fmtUSD(cliff.revenue)})` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Revenue at Risk */}
              {revenueAtRisk.length > 0 && (
                <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                  <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-3 uppercase tracking-wide flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                    </svg>
                    Revenue at Risk (LOE)
                  </h3>
                  <div className="space-y-3">
                    {revenueAtRisk.map(({ year, amount }) => (
                      <div key={year} className="flex items-center justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-300">{year}</span>
                        <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                          {fmtUSD(amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    Patent expirations create urgency for {company.name} to replace revenue through in-licensing or acquisitions.
                  </p>
                </div>
              )}

              {/* Acquisition Appetite + Strategic Priorities */}
              <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3 uppercase tracking-wide flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Strategic Profile
                </h3>
                {company.acquisition_appetite && (
                  <div className="mb-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Acquisition Appetite</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            company.acquisition_appetite === 'aggressive' ? 'bg-red-500 w-full' :
                            company.acquisition_appetite === 'moderate' ? 'bg-amber-500 w-2/3' :
                            company.acquisition_appetite === 'selective' ? 'bg-blue-500 w-1/3' :
                            'bg-slate-400 w-1/4'
                          }`}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300 capitalize">
                        {APPETITE_LABELS[company.acquisition_appetite] || company.acquisition_appetite}
                      </span>
                    </div>
                  </div>
                )}
                {company.strategic_priorities && company.strategic_priorities.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Strategic Priorities</p>
                    <div className="flex flex-wrap gap-1.5">
                      {company.strategic_priorities.slice(0, 6).map((p: string, i: number) => (
                        <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {p.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {!company.acquisition_appetite && (!company.strategic_priorities || company.strategic_priorities.length === 0) && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Strategic profile data is available for Pro subscribers. Includes acquisition appetite scoring and strategic priority mapping.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Clinical Trials Summary (server-rendered) ── */}
        {trials.length > 0 && Object.keys(trialsByPhase).length > 0 && (
          <section className="mb-12" aria-label="Clinical Pipeline">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {company.name} Clinical Pipeline
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {company.name} has {trials.length} active clinical trial{trials.length !== 1 ? 's' : ''} across {Object.keys(trialsByPhase).length} development phase{Object.keys(trialsByPhase).length !== 1 ? 's' : ''}.
            </p>
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                {Object.entries(trialsByPhase)
                  .sort(([a], [b]) => {
                    const order = ['preclinical', 'phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3', 'approved'];
                    return order.indexOf(a) - order.indexOf(b);
                  })
                  .map(([phase, count]) => (
                    <div key={phase} className="text-center">
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{count}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{fmtPhase(phase)}</p>
                    </div>
                  ))}
              </div>
            </div>
          </section>
        )}

        {/* ── CTA Section ────────────────────────────────── */}
        <section className="mb-12" aria-label="Calculate Deal Terms">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 rounded-2xl p-8 sm:p-10 text-white">
            <div className="max-w-3xl">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                See How Your Asset Matches {company.name}&apos;s Portfolio
              </h2>
              <p className="text-slate-300 text-base mb-6 leading-relaxed">
                Use Solidus to benchmark upfront payments, milestones, and royalties
                {topTA ? ` for ${fmtTA(topTA[0])} assets` : ''} — powered by data from 3,500+ real biopharma transactions.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href={primaryTASlug ? `/calculator?ta=${primaryTASlug}` : '/calculator'}
                  className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/25"
                >
                  Run Deal Benchmark
                  <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link
                  href="/#pricing"
                  className="inline-flex items-center justify-center px-6 py-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/20"
                >
                  Get Full Report — $499
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Internal Links Section ─────────────────────── */}
        <section className="mb-12" aria-label="Related Resources">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
            Related Intelligence
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* TA pages */}
            {topTAs.slice(0, 3).map(([ta]) => {
              const slug = TA_ROUTE_SLUGS[ta];
              if (!slug) return null;
              return (
                <Link
                  key={ta}
                  href={`/therapeutic-areas/${slug}`}
                  className="group bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-teal-300 dark:hover:border-teal-700 transition-colors"
                >
                  <p className="text-sm font-semibold text-slate-800 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                    {fmtTA(ta)} Deal Benchmarks
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Market sizing, deal terms, and competitive landscape for {fmtTA(ta).toLowerCase()}
                  </p>
                </Link>
              );
            })}

            {/* Benchmark pages */}
            {topModalities.slice(0, 2).map(([mod]) => (
              <Link
                key={mod}
                href={`/benchmarks/${mod.toLowerCase().replace(/[_\s]+/g, '-')}-deal-benchmarks`}
                className="group bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-teal-300 dark:hover:border-teal-700 transition-colors"
              >
                <p className="text-sm font-semibold text-slate-800 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  {fmtModality(mod)} Benchmarks
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Upfront, milestone, and royalty benchmarks for {fmtModality(mod).toLowerCase()} deals
                </p>
              </Link>
            ))}

            {/* Pulse / Deal Tracker */}
            <Link
              href="/pulse"
              className="group bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-teal-300 dark:hover:border-teal-700 transition-colors"
            >
              <p className="text-sm font-semibold text-slate-800 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                Deal Pulse
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Track the latest biopharma licensing and acquisition deals across all therapeutic areas
              </p>
            </Link>

            {/* Companies hub */}
            <Link
              href="/companies"
              className="group bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-teal-300 dark:hover:border-teal-700 transition-colors"
            >
              <p className="text-sm font-semibold text-slate-800 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                All Company Profiles
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Browse 700+ biotech and pharma company profiles with deal history and pipeline data
              </p>
            </Link>

            {/* Insights */}
            <Link
              href="/insights/biopharma-deal-benchmarks-2026"
              className="group bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-teal-300 dark:hover:border-teal-700 transition-colors"
            >
              <p className="text-sm font-semibold text-slate-800 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                {currentYear} Deal Benchmarks Report
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Industry-wide analysis of deal terms, trends, and market dynamics
              </p>
            </Link>
          </div>
        </section>

        {/* ── Crawlable prose for long-tail SEO ──────────── */}
        <section className="mb-12" aria-label="About">
          <div className="prose prose-slate dark:prose-invert max-w-none text-sm">
            <h2 className="text-lg font-bold">
              About {company.name} Licensing &amp; Deal Activity
            </h2>
            <p>
              {company.name} is a {typeLabel.toLowerCase()} company
              {company.hq_country ? ` based in ${company.hq_country}` : ''} that has been actively
              engaged in licensing transactions across the biopharma landscape.
              {totalDeals3yr > 0 && ` With ${totalDeals3yr} deal${totalDeals3yr !== 1 ? 's' : ''} over the past three years, ${company.name} ranks among the ${totalDeals3yr >= 10 ? 'most' : 'actively'} acquisitive companies tracked by Ambrosia Ventures.`}
            </p>
            {topTAs.length > 0 && (
              <p>
                Key therapeutic areas of focus for {company.name} include{' '}
                {topTAs.slice(0, 4).map(([ta, count], i, arr) => {
                  const label = fmtTA(ta);
                  const sep = i === arr.length - 1 ? '' : i === arr.length - 2 ? ', and ' : ', ';
                  return `${label} (${count} deal${count !== 1 ? 's' : ''} and trial${count !== 1 ? 's' : ''})${sep}`;
                }).join('')}.
                {topModalities.length > 0 && ` In terms of modality, ${company.name} has shown particular interest in ${topModalities.slice(0, 3).map(([m]) => fmtModality(m).toLowerCase()).join(', ')}.`}
              </p>
            )}
            <p>
              Ambrosia Ventures tracks deal terms, pipeline data, patent expirations, and competitive
              positioning for {company.name} and 700+ other biopharma companies. Use our{' '}
              <Link href="/calculator" className="text-teal-600 dark:text-teal-400 hover:underline">Solidus</Link>{' '}
              to benchmark your asset against {company.name}&apos;s historical deal terms, or explore{' '}
              <Link href="/companies" className="text-teal-600 dark:text-teal-400 hover:underline">all company profiles</Link>{' '}
              to find the best partner match for your pipeline.
            </p>
          </div>
        </section>
      </div>

    </>
  );
}
