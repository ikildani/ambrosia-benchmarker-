// Programmatic SEO page generator for company deal profiles
// Generates ~200-400 pages like /benchmarks/pfizer-deal-benchmarks
// Pure function — no side effects, safe for generateStaticParams at build time

import { COMPARABLE_DEALS, type ComparableDeal } from './comparableDeals';
import { EXTENDED_COMPARABLE_DEALS, type ExtendedComparableDeal } from '@/data/comparable-deals-extended';
import type { BenchmarkPageData } from './benchmarkPages';

// Extend BenchmarkPageData to include 'company' category.
// The base type in benchmarkPages.ts can be updated to include 'company'
// in the union when these pages are wired into the routing layer.
export type CompanyBenchmarkPageData = Omit<BenchmarkPageData, 'category'> & {
  category: 'modality' | 'indication' | 'phase' | 'overview' | 'company';
};

// ═══════════════════════════════════════════════════════════════════════
// Unified deal interface for company page generation
// ═══════════════════════════════════════════════════════════════════════

interface NormalizedDeal {
  licensor: string;
  licensee: string;
  totalValueM: number;
  upfrontM: number;
  milestonesM: number;
  year: number;
  dealType: string;
  modality: string;
  therapeuticArea: string;
  headline: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Merge + normalize both deal sources
// ═══════════════════════════════════════════════════════════════════════

function normalizeCuratedDeal(d: ComparableDeal): NormalizedDeal {
  return {
    licensor: d.licensor,
    licensee: d.licensee,
    totalValueM: d.totalValueM ?? 0,
    upfrontM: d.upfrontM ?? 0,
    milestonesM: d.milestonesM ?? 0,
    year: d.year,
    dealType: d.dealType ?? 'licensing',
    modality: d.modalities?.[0] ?? 'smallMolecule',
    therapeuticArea: d.therapeuticArea === 'both' ? 'oncology' : d.therapeuticArea,
    headline: `${d.licensor} / ${d.licensee} — ${d.value} (${d.year})`,
  };
}

function normalizeExtendedDeal(d: ExtendedComparableDeal): NormalizedDeal {
  return {
    licensor: d.licensor,
    licensee: d.licensee,
    totalValueM: d.totalDealValue ?? 0,
    upfrontM: d.upfront ?? 0,
    milestonesM: d.milestones ?? 0,
    year: d.year,
    dealType: d.dealType ?? 'licensing',
    modality: d.modality ?? 'smallMolecule',
    therapeuticArea: d.therapeuticArea,
    headline: d.headline,
  };
}

function getAllNormalizedDeals(): NormalizedDeal[] {
  const curated = COMPARABLE_DEALS.map(normalizeCuratedDeal);
  const seen = new Set(curated.map(d => `${d.licensor}|${d.licensee}|${d.year}`));
  const extended = EXTENDED_COMPARABLE_DEALS
    .filter(d => !seen.has(`${d.licensor}|${d.licensee}|${d.year}`))
    .map(normalizeExtendedDeal);
  return [...curated, ...extended];
}

// ═══════════════════════════════════════════════════════════════════════
// Slug + display name helpers
// ═══════════════════════════════════════════════════════════════════════

function toSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[.,()'''""]/g, '')
    .replace(/&/g, 'and')
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ═══════════════════════════════════════════════════════════════════════
// TA display name + slug mapping
// ═══════════════════════════════════════════════════════════════════════

const TA_DISPLAY: Record<string, string> = {
  oncology: 'Oncology',
  neurology: 'Neurology & CNS',
  immunology: 'Immunology & Autoimmune',
  metabolic: 'Metabolic & Obesity',
  cardiovascular: 'Cardiovascular',
  infectiousDisease: 'Infectious Disease',
  ophthalmology: 'Ophthalmology',
  womensHealth: "Women's Health",
  rareDisease: 'Rare Disease',
  hematology: 'Hematology',
  dermatology: 'Dermatology',
  gastroenterology: 'Gastroenterology',
};

const TA_PAGE_SLUG: Record<string, { slug: string; title: string }> = {
  oncology: { slug: 'oncology-deal-benchmarks-2026', title: 'Oncology Deal Overview 2026' },
  neurology: { slug: 'neurology-cns-deal-benchmarks', title: 'Neurology & CNS Deal Overview' },
  immunology: { slug: 'immunology-autoimmune-deal-benchmarks', title: 'Immunology & Autoimmune Deals' },
  metabolic: { slug: 'metabolic-obesity-deal-benchmarks-2026', title: 'Metabolic & Obesity Overview' },
  cardiovascular: { slug: 'cardiovascular-deal-benchmarks', title: 'Cardiovascular Deal Benchmarks' },
  infectiousDisease: { slug: 'infectious-disease-deal-benchmarks', title: 'Infectious Disease Deal Benchmarks' },
  ophthalmology: { slug: 'ophthalmology-deal-benchmarks', title: 'Ophthalmology Deal Benchmarks' },
  rareDisease: { slug: 'rare-disease-licensing-benchmarks', title: 'Rare Disease Licensing Benchmarks' },
  hematology: { slug: 'hematology-deal-benchmarks', title: 'Hematology Deal Benchmarks' },
  dermatology: { slug: 'dermatology-licensing-benchmarks', title: 'Dermatology Licensing Benchmarks' },
  gastroenterology: { slug: 'gastroenterology-deal-benchmarks', title: 'Gastroenterology Deal Benchmarks' },
};

const MODALITY_DISPLAY: Record<string, string> = {
  smallMolecule: 'Small Molecule',
  mab: 'Monoclonal Antibody',
  bispecific: 'Bispecific Antibody',
  trispecificAntibody: 'Trispecific Antibody',
  adc: 'ADC',
  carT_heme: 'CAR-T',
  geneTherapy: 'Gene Therapy',
  geneTherapyRare: 'Gene Therapy (Rare)',
  rnai: 'RNAi',
  aso: 'ASO',
  peptide: 'Peptide',
  glp1Agonist: 'GLP-1 Agonist',
  dualIncretin: 'Dual Incretin',
  tripleIncretin: 'Triple Incretin',
  amylinAnalog: 'Amylin Analog',
  jakInhibitor: 'JAK Inhibitor',
  jakInhibitorDerm: 'JAK Inhibitor (Derm)',
  tl1aInhibitor: 'Anti-TL1A',
  s1pModulator: 'S1P Modulator',
  fcrnAntagonist: 'FcRn Antagonist',
  complementInhibitor: 'Complement Inhibitor',
  dualAntagonist: 'Dual Antagonist',
  oralIntegrin: 'Oral Integrin',
  bbbPlatform: 'BBB Platform',
  psychedelic: 'Neuroplastogen',
  radiopharmaceutical: 'Radiopharmaceutical',
  vaccine: 'Vaccine',
  mrna: 'mRNA',
  inVivoCarT: 'In Vivo CAR-T',
  antiActivin: 'Anti-Activin',
  myosinInhibitor: 'Myosin Inhibitor',
  pcsk9Targeting: 'PCSK9 Targeting',
};

const MODALITY_PAGE_SLUG: Record<string, { slug: string; title: string }> = {
  adc: { slug: 'adc-deal-benchmarks', title: 'ADC Deal Benchmarks' },
  bispecific: { slug: 'bispecific-antibody-deal-benchmarks', title: 'Bispecific Antibody Deals' },
  trispecificAntibody: { slug: 'trispecific-antibody-deal-benchmarks', title: 'Trispecific Antibody Deals' },
  carT_heme: { slug: 'car-t-deal-benchmarks', title: 'CAR-T Cell Therapy Deals' },
  geneTherapy: { slug: 'gene-therapy-deal-benchmarks', title: 'Gene Therapy Deals' },
  geneTherapyRare: { slug: 'gene-therapy-rare-disease-deal-benchmarks', title: 'Gene Therapy Rare Disease Deals' },
  smallMolecule: { slug: 'small-molecule-deal-benchmarks', title: 'Small Molecule Deals' },
  rnai: { slug: 'rnai-sirna-deal-benchmarks', title: 'RNAi/siRNA Deals' },
  mab: { slug: 'antibody-deal-benchmarks', title: 'Monoclonal Antibody Deals' },
  radiopharmaceutical: { slug: 'radiopharmaceutical-deal-benchmarks', title: 'Radiopharmaceutical Deals' },
  glp1Agonist: { slug: 'glp1-obesity-deal-benchmarks-2026', title: 'GLP-1 Obesity Deals' },
  mrna: { slug: 'mrna-therapeutics-deal-benchmarks', title: 'mRNA Therapeutics Deals' },
  jakInhibitor: { slug: 'jak-inhibitor-dermatology-benchmarks', title: 'JAK Inhibitor Deals' },
  tl1aInhibitor: { slug: 'anti-tl1a-deal-benchmarks', title: 'Anti-TL1A Deals' },
};

// ═══════════════════════════════════════════════════════════════════════
// Stats computation helpers
// ═══════════════════════════════════════════════════════════════════════

function formatValueShort(valueM: number): string {
  if (valueM >= 1000) {
    const b = valueM / 1000;
    return `$${b % 1 === 0 ? b.toFixed(0) : b.toFixed(1)}B`;
  }
  return `$${valueM.toFixed(0)}M`;
}

function mode<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  const counts = new Map<T, number>();
  for (const item of arr) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  let best: T | undefined;
  let bestCount = 0;
  for (const [item, count] of counts) {
    if (count > bestCount) {
      best = item;
      bestCount = count;
    }
  }
  return best;
}

function topN<T>(arr: T[], n: number): { value: T; count: number; pct: number }[] {
  const counts = new Map<T, number>();
  for (const item of arr) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count, pct: Math.round((count / arr.length) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// ═══════════════════════════════════════════════════════════════════════
// Company page builder
// ═══════════════════════════════════════════════════════════════════════

interface CompanyProfile {
  name: string;
  deals: NormalizedDeal[];
  roles: Set<'licensor' | 'licensee'>;
}

function buildCompanyPage(profile: CompanyProfile): CompanyBenchmarkPageData {
  const { name, deals, roles } = profile;
  const slug = `${toSlug(name)}-deal-benchmarks`;

  // ── Compute stats ──
  const totalDeals = deals.length;
  const totalValueM = deals.reduce((sum, d) => sum + d.totalValueM, 0);
  const upfronts = deals.map(d => d.upfrontM).filter(v => v > 0);
  const medianUpfront = median(upfronts);

  // Most active year
  const years = deals.map(d => d.year);
  const mostActiveYear = mode(years) ?? deals[0].year;
  const dealsInBestYear = years.filter(y => y === mostActiveYear).length;

  // Primary TA
  const tas = deals.map(d => d.therapeuticArea);
  const topTAs = topN(tas, 3);
  const primaryTA = topTAs[0]?.value ?? 'oncology';

  // Primary modality
  const modalities = deals.map(d => d.modality);
  const topModalities = topN(modalities, 3);
  const primaryModality = topModalities[0]?.value ?? 'smallMolecule';

  // Top deals by value (deduplicate by counterparty + year)
  const deduped = [...deals].sort((a, b) => b.totalValueM - a.totalValueM);
  const seenDealKeys = new Set<string>();
  const topDeals: NormalizedDeal[] = [];
  for (const d of deduped) {
    const counterparty = d.licensor === name ? d.licensee : d.licensor;
    const key = `${counterparty}|${d.year}|${d.totalValueM}`;
    if (!seenDealKeys.has(key)) {
      seenDealKeys.add(key);
      topDeals.push(d);
    }
    if (topDeals.length >= 3) break;
  }

  // Role description
  const roleList = Array.from(roles);
  const roleDesc = roleList.length === 2
    ? 'both a licensor and licensee'
    : roleList[0] === 'licensor'
      ? 'a licensor (out-licensor)'
      : 'a licensee (in-licensor/acquirer)';

  // Deal pattern description
  const dealTypes = deals.map(d => d.dealType);
  const topDealType = mode(dealTypes) ?? 'licensing';
  const dealPatternMap: Record<string, string> = {
    licensing: 'a preference for licensing partnerships',
    acquisition: 'an active acquisition strategy',
    codevelopment: 'a collaborative co-development approach',
    option: 'a disciplined option-based deal strategy',
    collaboration: 'a collaborative partnership model',
  };
  const dealPattern = dealPatternMap[topDealType] ?? 'diversified deal-making activity';

  // TA distribution text
  const taDistText = topTAs
    .slice(0, 3)
    .map(t => `${TA_DISPLAY[t.value] ?? t.value} (${t.pct}%)`)
    .join(', ');

  // Modality distribution text
  const modalityDistText = topModalities
    .slice(0, 2)
    .map(m => MODALITY_DISPLAY[m.value] ?? m.value)
    .join(' and ');

  // Top deals description
  const topDealsText = topDeals
    .map(d => {
      const counterparty = d.licensor === name ? d.licensee : d.licensor;
      return `${counterparty} (${formatValueShort(d.totalValueM)}, ${d.year})`;
    })
    .join(', ');

  // ── Hero stats ──
  const heroStats = [
    {
      label: 'Total Deals',
      value: totalDeals.toString(),
      subtext: `Across ${new Set(tas).size} therapeutic area${new Set(tas).size > 1 ? 's' : ''}`,
    },
    {
      label: 'Total Deal Value',
      value: formatValueShort(totalValueM),
      subtext: `Cumulative transaction value`,
    },
    {
      label: 'Most Active Year',
      value: mostActiveYear.toString(),
      subtext: `${dealsInBestYear} deal${dealsInBestYear > 1 ? 's' : ''} closed`,
    },
    {
      label: 'Primary TA',
      value: TA_DISPLAY[primaryTA] ?? primaryTA,
      subtext: `${topTAs[0]?.pct ?? 0}% of deal activity`,
    },
  ];

  // ── Context paragraphs ──
  const uniqueTAs = new Set(tas);
  const taListText = Array.from(uniqueTAs)
    .map(ta => TA_DISPLAY[ta] ?? ta)
    .join(', ');

  const contextParagraphs = [
    `${name} has been involved in ${totalDeals} transaction${totalDeals > 1 ? 's' : ''} totaling ${formatValueShort(totalValueM)} across ${taListText}. As ${roleDesc}, they have demonstrated ${dealPattern}.`,
    `Key transactions include ${topDealsText}.`,
    `Their deal activity is concentrated in ${TA_DISPLAY[primaryTA] ?? primaryTA} (${topTAs[0]?.pct ?? 0}%) with ${modalityDistText} assets representing their most common deal type${topModalities.length > 1 ? 's' : ''}.`,
  ];

  // ── Calculator prefill ──
  const calculatorPrefill: CompanyBenchmarkPageData['calculatorPrefill'] = {
    therapeuticArea: primaryTA,
    modality: primaryModality,
  };

  // ── FAQs ──
  const faqs: CompanyBenchmarkPageData['faqs'] = [
    {
      question: `How many deals has ${name} done?`,
      answer: `${name} has completed ${totalDeals} verified transaction${totalDeals > 1 ? 's' : ''} tracked in our database, spanning from ${Math.min(...years)} to ${Math.max(...years)}. These deals have a combined value of ${formatValueShort(totalValueM)}.`,
    },
    {
      question: `What is ${name}'s typical deal structure?`,
      answer: upfronts.length > 0
        ? `Based on ${totalDeals} deal${totalDeals > 1 ? 's' : ''}, ${name}'s transactions show a median upfront payment of ${formatValueShort(medianUpfront)}. Their most common deal type is ${topDealType}, reflecting ${dealPattern}.`
        : `${name}'s most common deal type is ${topDealType}, reflecting ${dealPattern}. Specific upfront payment data is limited in publicly disclosed terms.`,
    },
    {
      question: `What therapeutic areas does ${name} focus on?`,
      answer: topTAs.length > 1
        ? `${name} is primarily active in ${topTAs.map(t => `${TA_DISPLAY[t.value] ?? t.value} (${t.pct}%)`).join(', ')}.`
        : `${name} focuses on ${TA_DISPLAY[topTAs[0]?.value ?? ''] ?? topTAs[0]?.value ?? 'multiple areas'}, representing ${topTAs[0]?.pct ?? 100}% of their tracked deals.`,
    },
  ];

  // Add a 4th FAQ for companies with enough data
  if (totalDeals >= 4) {
    faqs.push({
      question: `How has ${name}'s deal activity trended over time?`,
      answer: `${name}'s most active period was ${mostActiveYear} with ${dealsInBestYear} transaction${dealsInBestYear > 1 ? 's' : ''}. Their deals span ${Math.max(...years) - Math.min(...years) + 1} year${Math.max(...years) - Math.min(...years) >= 1 ? 's' : ''} of activity from ${Math.min(...years)} to ${Math.max(...years)}.`,
    });
  }

  // ── Related pages ──
  const relatedPages: CompanyBenchmarkPageData['relatedPages'] = [];

  // Link to primary TA page
  const taPage = TA_PAGE_SLUG[primaryTA];
  if (taPage) {
    relatedPages.push(taPage);
  }

  // Link to primary modality page
  const modalityPage = MODALITY_PAGE_SLUG[primaryModality];
  if (modalityPage) {
    relatedPages.push(modalityPage);
  }

  // Link to secondary TA page if different
  if (topTAs.length > 1) {
    const secondaryTAPage = TA_PAGE_SLUG[topTAs[1].value];
    if (secondaryTAPage && secondaryTAPage.slug !== taPage?.slug) {
      relatedPages.push(secondaryTAPage);
    }
  }

  // Pad with a phase page if we have room
  if (relatedPages.length < 4) {
    relatedPages.push({ slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' });
  }

  return {
    slug,
    title: `${name} Deal History & Licensing Benchmarks 2026`,
    metaDescription: `Complete deal history for ${name} including licensing terms, acquisition premiums, and transaction benchmarks. ${totalDeals} verified transaction${totalDeals > 1 ? 's' : ''} tracked.`,
    h1: `${name} — Deal History & Benchmarks`,
    heroStats,
    contextParagraphs,
    calculatorPrefill,
    faqs,
    relatedPages: relatedPages.slice(0, 4),
    category: 'company',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════

const STANDALONE_EXCLUSIONS = new Set([
  'N/A (standalone)',
  'N/A',
  'N/A (internal)',
  'N/A (post-acquisition writedown)',
  'N/A (EU commercialization)',
  'N/A (Japan rights retained)',
  'n/a',
  'standalone',
  'Partner',
]);

// Normalize company name variants to a canonical form
const COMPANY_ALIASES: Record<string, string> = {
  'J&J': 'Johnson & Johnson',
  'Janssen': 'Johnson & Johnson',
  'Janssen (J&J)': 'Johnson & Johnson',
  'Gilead Sciences': 'Gilead',
  'Astellas': 'Astellas Pharma',
  'Celgene/BMS': 'BMS',
  'Alexion': 'AstraZeneca',
  'Alexion Pharmaceuticals': 'AstraZeneca',
  'Alexion/AstraZeneca': 'AstraZeneca',
  'Genmab/Seagen': 'Genmab',
  'Roche/Genentech': 'Roche',
  'Genentech': 'Roche',
  'Arena/Pfizer': 'Pfizer',
  'Sanofi/Regeneron': 'Sanofi',
  'Telavant Holdings': 'Telavant',
  'Vertex': 'Vertex Pharmaceuticals',
  'Alnylam': 'Alnylam Pharmaceuticals',
  'Melinta/Mundipharma': 'Melinta Therapeutics',
  'XOMA/Kissei': 'XOMA',
  'Hengrui Pharma': 'Hengrui Medicine',
  'Leo Pharma': 'LEO Pharma',
  'Samsung': 'Samsung Bioepis',
  'Swedish Orphan Biovitrum (Sobi)': 'Sobi',
  'Recordati (Enjaymo)': 'Recordati',
  'Celgene': 'BMS',
};

let _cachedPages: CompanyBenchmarkPageData[] | null = null;

/**
 * Generate CompanyBenchmarkPageData for every company with 2+ deals.
 * Results are cached after first call (pure data, safe across SSR builds).
 */
export function getCompanyBenchmarkPages(): CompanyBenchmarkPageData[] {
  if (_cachedPages) return _cachedPages;

  const allDeals = getAllNormalizedDeals();

  // Build company profiles
  const companyMap = new Map<string, CompanyProfile>();

  function resolveCompanyName(raw: string): string | null {
    if (STANDALONE_EXCLUSIONS.has(raw)) return null;
    return COMPANY_ALIASES[raw] ?? raw;
  }

  for (const deal of allDeals) {
    // Process licensor
    const licensorName = resolveCompanyName(deal.licensor);
    if (licensorName) {
      if (!companyMap.has(licensorName)) {
        companyMap.set(licensorName, { name: licensorName, deals: [], roles: new Set() });
      }
      const profile = companyMap.get(licensorName)!;
      profile.deals.push(deal);
      profile.roles.add('licensor');
    }

    // Process licensee
    const licenseeName = resolveCompanyName(deal.licensee);
    if (licenseeName) {
      if (!companyMap.has(licenseeName)) {
        companyMap.set(licenseeName, { name: licenseeName, deals: [], roles: new Set() });
      }
      const profile = companyMap.get(licenseeName)!;
      profile.deals.push(deal);
      profile.roles.add('licensee');
    }
  }

  // Filter to companies with 2+ deals
  const qualifiedCompanies = Array.from(companyMap.values())
    .filter(p => p.deals.length >= 2)
    .sort((a, b) => b.deals.length - a.deals.length || a.name.localeCompare(b.name));

  _cachedPages = qualifiedCompanies.map(buildCompanyPage);
  return _cachedPages;
}

/**
 * Look up a single company benchmark page by slug.
 */
export function getCompanyBenchmarkBySlug(slug: string): CompanyBenchmarkPageData | undefined {
  return getCompanyBenchmarkPages().find(p => p.slug === slug);
}

/**
 * Get all company benchmark slugs (for generateStaticParams).
 */
export function getAllCompanyBenchmarkSlugs(): string[] {
  return getCompanyBenchmarkPages().map(p => p.slug);
}
