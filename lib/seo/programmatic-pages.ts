/**
 * Programmatic long-tail page generation engine.
 * Enumerates valid TA × Phase × Territory combinations and provides
 * data + content for each page.
 */

import { getBenchmarksSync, type PhaseBaselineEntry } from '@/lib/benchmarks';
import { calculateDealTerms, formatCurrency, type CalculationInput, type TherapeuticArea, type Phase, type Territory } from '@/lib/calculations';
import { EXTENDED_COMPARABLE_DEALS, type ExtendedComparableDeal } from '@/data/comparable-deals-extended';
import { LIVE_DEAL_COUNT, formatDealCount } from '@/lib/config/constants';

const benchmarks = getBenchmarksSync();

// ── Configuration ────────────────────────────────────────────────────────────

const TAS: { key: TherapeuticArea; slug: string; label: string; titleLabel: string }[] = [
  { key: 'oncology', slug: 'oncology', label: 'Oncology', titleLabel: 'Oncology' },
  { key: 'neurology', slug: 'neurology', label: 'Neurology/CNS', titleLabel: 'Neuro/CNS' },
  { key: 'immunology', slug: 'immunology', label: 'Immunology', titleLabel: 'Immunology' },
  { key: 'metabolic', slug: 'metabolic', label: 'Metabolic/Obesity', titleLabel: 'Metabolic' },
  { key: 'cardiovascular', slug: 'cardiovascular', label: 'Cardiovascular', titleLabel: 'CV' },
  { key: 'infectiousDisease', slug: 'infectious-disease', label: 'Infectious Disease', titleLabel: 'Infectious Dis.' },
  { key: 'ophthalmology', slug: 'ophthalmology', label: 'Ophthalmology', titleLabel: 'Ophthal' },
  { key: 'womensHealth', slug: 'womens-health', label: "Women's Health", titleLabel: "Women's Health" },
  { key: 'rareDisease', slug: 'rare-disease', label: 'Rare Disease', titleLabel: 'Rare Disease' },
  { key: 'hematology', slug: 'hematology', label: 'Hematology', titleLabel: 'Hematology' },
  { key: 'dermatology', slug: 'dermatology', label: 'Dermatology', titleLabel: 'Dermatology' },
  { key: 'gastroenterology', slug: 'gastroenterology', label: 'Gastroenterology', titleLabel: 'GI' },
];

const PHASES: { key: Phase; slug: string; label: string }[] = [
  { key: 'preclinical', slug: 'preclinical', label: 'Preclinical' },
  { key: 'phase1', slug: 'phase-1', label: 'Phase 1' },
  { key: 'phase2', slug: 'phase-2', label: 'Phase 2' },
  { key: 'phase3', slug: 'phase-3', label: 'Phase 3' },
  { key: 'approved', slug: 'approved', label: 'Approved' },
];

const TERRITORIES: { key: Territory; slug: string; label: string; titleLabel: string }[] = [
  { key: 'global', slug: 'global', label: 'Global', titleLabel: 'Global' },
  { key: 'us_only', slug: 'us', label: 'US Only', titleLabel: 'US' },
  { key: 'ex_us', slug: 'ex-us', label: 'Ex-US', titleLabel: 'Ex-US' },
  { key: 'europe', slug: 'europe', label: 'Europe', titleLabel: 'EU' },
  { key: 'japan', slug: 'japan', label: 'Japan', titleLabel: 'Japan' },
  { key: 'china', slug: 'china', label: 'China', titleLabel: 'China' },
];

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProgrammaticPageData {
  slug: string;
  ta: { key: TherapeuticArea; slug: string; label: string; titleLabel: string };
  phase: { key: Phase; slug: string; label: string };
  territory: { key: Territory; slug: string; label: string; titleLabel: string };
  title: string;
  metaDescription: string;
  h1: string;
  upfront: { low: number; median: number; high: number };
  totalValue: { low: number; median: number; high: number };
  royalty: { base: number; max: number };
  territoryMultiplier: number;
  comparableDeals: ExtendedComparableDeal[];
  relatedSlugs: string[];
}

// ── Core Functions ───────────────────────────────────────────────────────────

function makeSlug(ta: string, phase: string, territory: string): string {
  return `${ta}-${phase}-deals-${territory}`;
}

function makeInput(ta: TherapeuticArea, phase: Phase, territory: Territory): CalculationInput {
  return {
    therapeuticArea: ta,
    phase,
    modality: 'smallMolecule',
    indication: 'lung_nsclc' as CalculationInput['indication'],
    territory,
    biomarker: 'unselected',
    lineOfTherapy: '2L',
    treatmentApproach: 'symptomatic',
    combinationPotential: 'some',
    competitivePosition: 'racing',
    dataQuality: 'promising',
    regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
  };
}

function getMatchingDeals(ta: TherapeuticArea, territory: Territory): ExtendedComparableDeal[] {
  return EXTENDED_COMPARABLE_DEALS.filter(deal => {
    if (deal.therapeuticArea !== ta && deal.therapeuticArea !== ta.replace(/([A-Z])/g, '_$1').toLowerCase()) return false;
    if (territory === 'global') return true;
    const t = deal.territory.toLowerCase();
    if (territory === 'europe') return t.includes('europe') || t === 'eu' || t === 'ex_us';
    if (territory === 'japan') return t.includes('japan');
    if (territory === 'china') return t.includes('china');
    if (territory === 'us_only') return t === 'us' || t === 'us_only';
    if (territory === 'ex_us') return t === 'ex_us' || t.includes('europe') || t.includes('japan');
    return true;
  }).slice(0, 10);
}

function getRelatedSlugs(ta: typeof TAS[number], phase: typeof PHASES[number], territory: typeof TERRITORIES[number]): string[] {
  const related: string[] = [];
  // Same TA, different phases
  for (const p of PHASES) {
    if (p.key !== phase.key) related.push(makeSlug(ta.slug, p.slug, territory.slug));
  }
  // Same phase, different TAs (top 3)
  for (const t of TAS.slice(0, 4)) {
    if (t.key !== ta.key) related.push(makeSlug(t.slug, phase.slug, territory.slug));
  }
  // Same TA+phase, different territories (top 2)
  for (const terr of TERRITORIES.slice(0, 3)) {
    if (terr.key !== territory.key) related.push(makeSlug(ta.slug, phase.slug, terr.slug));
  }
  return related.slice(0, 8);
}

// ── Build All Pages ──────────────────────────────────────────────────────────

let _allPages: ProgrammaticPageData[] | null = null;

function buildAllPages(): ProgrammaticPageData[] {
  if (_allPages) return _allPages;

  const pages: ProgrammaticPageData[] = [];
  const territories = benchmarks.territories as Record<string, { multiplier: number; label: string; context: string }>;

  for (const ta of TAS) {
    for (const phase of PHASES) {
      for (const territory of TERRITORIES) {
        try {
          const result = calculateDealTerms(makeInput(ta.key, phase.key, territory.key));
          const terrData = territories[territory.key];
          const terrMultiplier = terrData?.multiplier ?? 1;

          const slug = makeSlug(ta.slug, phase.slug, territory.slug);
          const deals = getMatchingDeals(ta.key, territory.key);

          const territoryLabel = territory.key === 'global' ? '' : ` ${territory.label}`;
          const territoryTitleSuffix = territory.key === 'global' ? '' : ` ${territory.titleLabel}`;
          const dealCount = formatDealCount(LIVE_DEAL_COUNT);
          const upfrontMedian = formatCurrency(result.terms.upfront.median);
          const upfrontLow = formatCurrency(result.terms.upfront.low);
          const upfrontHigh = formatCurrency(result.terms.upfront.high);
          const royaltyLow = result.tieredRoyalties.base.low;
          const royaltyHigh = result.tieredRoyalties.base.high;

          // CTR-optimized title: TA + phase + year + $ number, under 60 chars
          // Global: "Oncology Phase 2 Deals 2026: $258M Upfront | Free"
          // Territory: "Oncology Phase 2 Deals 2026 US: $301M Upfront"
          const title = territory.key === 'global'
            ? `${ta.titleLabel} ${phase.label} Deals 2026: ${upfrontMedian} Upfront | Free`
            : `${ta.titleLabel} ${phase.label} Deals 2026 ${territory.titleLabel}: ${upfrontMedian} Upfront`;

          const h1 = `${ta.label} ${phase.label} Deal Benchmarks${territoryLabel ? ` — ${territory.label}` : ''} (2026)`;

          // CTR-optimized description: lead with range, royalties, deal count, CTA, under 155 chars
          // "Phase 2 oncology deals: $144M–$365M upfront, 12–19% royalties. From 1,900+ verified deals. Free benchmarks."
          const metaDescription = `${phase.label} ${ta.label.toLowerCase()} deals${territoryLabel ? ` in ${territory.label}` : ''}: ${upfrontLow}–${upfrontHigh} upfront, ${royaltyLow}–${royaltyHigh}% royalties. From ${dealCount} verified deals. Free benchmarks.`;

          pages.push({
            slug,
            ta,
            phase,
            territory,
            title,
            metaDescription,
            h1,
            upfront: result.terms.upfront,
            totalValue: result.terms.totalDealValue,
            royalty: { base: result.tieredRoyalties.base.low, max: result.tieredRoyalties.base.high },
            territoryMultiplier: terrMultiplier,
            comparableDeals: deals,
            relatedSlugs: getRelatedSlugs(ta, phase, territory),
          });
        } catch {
          // Skip invalid combinations
        }
      }
    }
  }

  _allPages = pages;
  return pages;
}

// ── Exports ──────────────────────────────────────────────────────────────────

export function getAllProgrammaticSlugs(): string[] {
  return buildAllPages().map(p => p.slug);
}

export function getProgrammaticPageData(slug: string): ProgrammaticPageData | undefined {
  return buildAllPages().find(p => p.slug === slug);
}

export function getAllProgrammaticPages(): ProgrammaticPageData[] {
  return buildAllPages();
}

export { TAS, PHASES, TERRITORIES, formatCurrency };
