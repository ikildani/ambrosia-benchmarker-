import {
  calculateDealTerms,
  formatCurrency,
  type CalculationInput,
  type Phase,
  type Modality,
  type Indication,
} from './calculations';

export interface InsightPageData {
  slug: string;
  stat: string;
  title: string;
  metaDescription: string;
  context: string;
  source: string;
  calculatorPrefill: { phase?: string; modality?: string; indication?: string };
  relatedInsights: { slug: string; stat: string; title: string }[];
}

function makeInput(overrides: Partial<CalculationInput>): CalculationInput {
  return {
    therapeuticArea: overrides.therapeuticArea ?? 'oncology',
    phase: overrides.phase ?? 'phase2',
    modality: overrides.modality ?? 'smallMolecule',
    indication: overrides.indication ?? 'lung_nsclc',
    territory: overrides.territory ?? 'global',
    biomarker: overrides.biomarker ?? 'unselected',
    lineOfTherapy: overrides.lineOfTherapy ?? '2L',
    treatmentApproach: overrides.treatmentApproach ?? 'symptomatic',
    combinationPotential: overrides.combinationPotential ?? 'some',
    competitivePosition: overrides.competitivePosition ?? 'racing',
    dataQuality: overrides.dataQuality ?? 'promising',
    regulatoryDesignations: overrides.regulatoryDesignations ?? {
      breakthrough: false,
      fastTrack: false,
      orphan: false,
      prime: false,
    },
  };
}

function buildInsights(): InsightPageData[] {
  // ADC Phase 2 upfront
  const adcP2 = calculateDealTerms(makeInput({ modality: 'adc' as Modality, phase: 'phase2' as Phase }));
  // Radiopharmaceutical premium vs small molecule
  const radioP2 = calculateDealTerms(makeInput({ modality: 'radiopharmaceutical' as Modality, phase: 'phase2' as Phase }));
  const smP2 = calculateDealTerms(makeInput({ modality: 'smallMolecule' as Modality, phase: 'phase2' as Phase }));
  // Phase 3 oncology
  const oncoP3 = calculateDealTerms(makeInput({ phase: 'phase3' as Phase, modality: 'smallMolecule' as Modality }));
  // CAR-T total deal value
  const cartP2 = calculateDealTerms(makeInput({ modality: 'carT' as Modality, phase: 'phase2' as Phase }));
  // Bispecific antibody
  const bispP2 = calculateDealTerms(makeInput({ modality: 'bispecificAntibody' as Modality, phase: 'phase2' as Phase }));
  // Gene therapy
  const geneP2 = calculateDealTerms(makeInput({ modality: 'geneTherapy' as Modality, phase: 'phase2' as Phase }));
  // Preclinical
  const preclinical = calculateDealTerms(makeInput({ phase: 'preclinical' as Phase }));

  const radioPremium = Math.round(
    ((radioP2.terms.upfront.median - smP2.terms.upfront.median) / smP2.terms.upfront.median) * 100
  );

  const insights: InsightPageData[] = [
    {
      slug: 'adc-phase-2-upfront-2026',
      stat: formatCurrency(adcP2.terms.upfront.median),
      title: 'Phase 2 ADC deals average this upfront payment in 2026',
      metaDescription: `Phase 2 ADC licensing deals command ${formatCurrency(adcP2.terms.upfront.median)} median upfront payments in 2026, reflecting strong demand for antibody-drug conjugate technology.`,
      context: `Antibody-drug conjugates (ADCs) continue to be one of the hottest modalities in biopharma licensing. With total deal values reaching ${formatCurrency(adcP2.terms.totalDealValue.median)} at Phase 2, ADCs command premium economics driven by platform versatility, validated targets, and next-generation linker-payload technologies.`,
      source: 'Based on analysis of 500+ biopharma licensing deals from 2020-2026',
      calculatorPrefill: { phase: 'phase2', modality: 'adc' },
      relatedInsights: [],
    },
    {
      slug: 'radiopharmaceutical-premium-2026',
      stat: `${radioPremium}%`,
      title: 'Radiopharmaceuticals command this premium over small molecules',
      metaDescription: `Radiopharmaceutical licensing deals command a ${radioPremium}% premium over small molecule deals in upfront payments, driven by the theranostic revolution in oncology.`,
      context: `The theranostic revolution has made radiopharmaceuticals one of the most valuable modalities in biopharma licensing. With built-in companion diagnostics and precision targeting, these assets command significantly higher deal terms than traditional small molecules across all development stages.`,
      source: 'Based on analysis of 500+ biopharma licensing deals from 2020-2026',
      calculatorPrefill: { phase: 'phase2', modality: 'radiopharmaceutical' },
      relatedInsights: [],
    },
    {
      slug: 'phase-3-oncology-deal-value-2026',
      stat: formatCurrency(oncoP3.terms.totalDealValue.median),
      title: 'Median total deal value for Phase 3 oncology assets in 2026',
      metaDescription: `Phase 3 oncology licensing deals reach ${formatCurrency(oncoP3.terms.totalDealValue.median)} in total deal value, with upfront payments of ${formatCurrency(oncoP3.terms.upfront.median)}.`,
      context: `Phase 3 oncology assets represent the highest-value licensing opportunities in biopharma. With de-risked clinical data and clear regulatory paths, these deals attract premium economics. Upfront payments reach ${formatCurrency(oncoP3.terms.upfront.median)}, with royalty rates of ${oncoP3.tieredRoyalties.base.low}%-${oncoP3.tieredRoyalties.base.high}%.`,
      source: 'Based on analysis of 500+ biopharma licensing deals from 2020-2026',
      calculatorPrefill: { phase: 'phase3' },
      relatedInsights: [],
    },
    {
      slug: 'car-t-total-deal-value-2026',
      stat: formatCurrency(cartP2.terms.totalDealValue.median),
      title: 'CAR-T cell therapy deals reach this total value at Phase 2',
      metaDescription: `CAR-T cell therapy Phase 2 licensing deals reach ${formatCurrency(cartP2.terms.totalDealValue.median)} total deal value with ${formatCurrency(cartP2.terms.upfront.median)} upfront.`,
      context: `CAR-T cell therapy remains a high-value modality despite manufacturing complexity. Deal structures reflect the transformative potential of cell therapy, with substantial milestone payments tied to manufacturing scale-up, regulatory approval, and commercial success across multiple indications.`,
      source: 'Based on analysis of 500+ biopharma licensing deals from 2020-2026',
      calculatorPrefill: { phase: 'phase2', modality: 'carT' },
      relatedInsights: [],
    },
    {
      slug: 'bispecific-antibody-upfront-2026',
      stat: formatCurrency(bispP2.terms.upfront.median),
      title: 'Bispecific antibody Phase 2 deals command this upfront',
      metaDescription: `Bispecific antibody Phase 2 licensing deals average ${formatCurrency(bispP2.terms.upfront.median)} in upfront payments, driven by dual-targeting mechanisms and immuno-oncology applications.`,
      context: `Bispecific antibodies have emerged as a dominant force in immuno-oncology licensing. Their ability to engage multiple targets simultaneously creates compelling clinical differentiation, and deal terms reflect the breadth of potential indications and combination strategies.`,
      source: 'Based on analysis of 500+ biopharma licensing deals from 2020-2026',
      calculatorPrefill: { phase: 'phase2', modality: 'bispecificAntibody' },
      relatedInsights: [],
    },
    {
      slug: 'gene-therapy-deal-economics-2026',
      stat: formatCurrency(geneP2.terms.totalDealValue.median),
      title: 'Gene therapy total deal value at Phase 2 in 2026',
      metaDescription: `Gene therapy Phase 2 licensing deals reach ${formatCurrency(geneP2.terms.totalDealValue.median)} total deal value, reflecting curative potential and one-time treatment economics.`,
      context: `Gene therapy deals are structured to reflect the curative potential of single-administration treatments. With upfront payments of ${formatCurrency(geneP2.terms.upfront.median)}, these deals include significant regulatory and commercial milestones tied to durable efficacy data and market access.`,
      source: 'Based on analysis of 500+ biopharma licensing deals from 2020-2026',
      calculatorPrefill: { phase: 'phase2', modality: 'geneTherapy' },
      relatedInsights: [],
    },
    {
      slug: 'preclinical-licensing-upfront-2026',
      stat: formatCurrency(preclinical.terms.upfront.median),
      title: 'Preclinical assets still command this upfront payment',
      metaDescription: `Even at the preclinical stage, biopharma licensing deals average ${formatCurrency(preclinical.terms.upfront.median)} in upfront payments, with total deal values of ${formatCurrency(preclinical.terms.totalDealValue.median)}.`,
      context: `Preclinical licensing deals demonstrate that innovative science commands value even before clinical validation. Platform technologies, novel mechanisms, and hot therapeutic areas drive competitive dynamics that push preclinical deal terms well above historical norms. Total deal values can reach ${formatCurrency(preclinical.terms.totalDealValue.median)}.`,
      source: 'Based on analysis of 500+ biopharma licensing deals from 2020-2026',
      calculatorPrefill: { phase: 'preclinical' },
      relatedInsights: [],
    },
  ];

  // Wire up related insights (each gets 3 others)
  for (let i = 0; i < insights.length; i++) {
    insights[i].relatedInsights = insights
      .filter((_, j) => j !== i)
      .slice(0, 3)
      .map(({ slug, stat, title }) => ({ slug, stat, title }));
  }

  return insights;
}

const INSIGHTS = buildInsights();

export function getAllInsights(): InsightPageData[] {
  return INSIGHTS;
}

export function getInsightBySlug(slug: string): InsightPageData | undefined {
  return INSIGHTS.find((i) => i.slug === slug);
}

export function getAllInsightSlugs(): string[] {
  return INSIGHTS.map((i) => i.slug);
}
