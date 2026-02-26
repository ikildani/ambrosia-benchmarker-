/**
 * Competitive Pipeline Intelligence Service
 *
 * Analyzes competing assets in the same indication/modality space using
 * clinical trials data and curated competitive landscape information.
 */

import type { CompetitiveLandscape, CompetitiveAsset } from '@/lib/financial/types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Curated competitive density data for top indications.
 * Maps indication → known pipeline density and key competitors.
 *
 * This data supplements live ClinicalTrials.gov queries with
 * curated intelligence that the API cannot provide (expected timelines,
 * differentiation narratives, market share assumptions).
 */
const CURATED_COMPETITIVE_DATA: Record<string, {
  density: 'very_high' | 'high' | 'moderate' | 'low' | 'very_low';
  keyAssets: CompetitiveAsset[];
  marketDynamics: string;
}> = {
  // Oncology — high density
  lung_nsclc: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Merck', assetName: 'Keytruda', modality: 'mab', phase: 'approved', indication: 'NSCLC', differentiator: 'Market leader; >$25B revenue' },
      { companyName: 'AstraZeneca', assetName: 'Tagrisso', modality: 'smallMolecule', phase: 'approved', indication: 'NSCLC EGFR', differentiator: 'EGFR standard of care' },
      { companyName: 'Daiichi Sankyo/AstraZeneca', assetName: 'Dato-DXd', modality: 'adc', phase: 'phase3', indication: 'NSCLC', expectedApprovalYear: 2025, differentiator: 'TROP2 ADC; broad solid tumor potential' },
      { companyName: 'Roche', assetName: 'Tiragolumab + Tecentriq', modality: 'bispecific', phase: 'phase3', indication: 'NSCLC', differentiator: 'TIGIT + PD-L1 combination' },
    ],
    marketDynamics: 'Extremely competitive market dominated by checkpoint inhibitors. ADC and bispecific entrants are reshaping treatment paradigms. Differentiation requires either novel MoA or superior efficacy in biomarker-defined subsets.',
  },
  breast_her2: {
    density: 'high',
    keyAssets: [
      { companyName: 'Daiichi Sankyo/AstraZeneca', assetName: 'Enhertu', modality: 'adc', phase: 'approved', indication: 'HER2+ breast', differentiator: 'Best-in-class ADC; $5B+ revenue trajectory' },
      { companyName: 'Roche', assetName: 'Kadcyla', modality: 'adc', phase: 'approved', indication: 'HER2+ breast', differentiator: 'Established T-DM1' },
      { companyName: 'Seagen/Pfizer', assetName: 'Tukysa', modality: 'smallMolecule', phase: 'approved', indication: 'HER2+ breast', differentiator: 'Brain metastases activity' },
    ],
    marketDynamics: 'Enhertu has reset HER2 ADC expectations. New entrants must show differentiation in brain mets, HER2-low, or novel combinations.',
  },
  breast_tnbc: {
    density: 'high',
    keyAssets: [
      { companyName: 'Gilead', assetName: 'Trodelvy', modality: 'adc', phase: 'approved', indication: 'TNBC', differentiator: 'First TROP2 ADC approved in TNBC' },
      { companyName: 'Merck', assetName: 'Keytruda + chemo', modality: 'mab', phase: 'approved', indication: 'TNBC', differentiator: 'IO + chemo standard for PD-L1+' },
    ],
    marketDynamics: 'High unmet need despite ADC and IO approvals. Opportunity exists for antibody-drug conjugates with novel payloads or targets.',
  },

  // Neurology — moderate/low density for rare
  alzheimers: {
    density: 'high',
    keyAssets: [
      { companyName: 'Eisai/Biogen', assetName: 'Leqembi', modality: 'mab', phase: 'approved', indication: 'Early AD', differentiator: 'First anti-amyloid with clear clinical benefit' },
      { companyName: 'Lilly', assetName: 'Kisunla', modality: 'mab', phase: 'approved', indication: 'Early AD', differentiator: 'Time-limited dosing; potentially curative amyloid clearance' },
      { companyName: 'Roche', assetName: 'Trontinemab', modality: 'bbbPlatform', phase: 'phase2', indication: 'AD', expectedApprovalYear: 2028, differentiator: 'Brain shuttle technology for enhanced CNS delivery' },
    ],
    marketDynamics: 'Amyloid hypothesis validated but debate continues. Next wave targets tau, neuroinflammation, and synaptic protection. BBB delivery is key differentiator.',
  },
  obesity: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Novo Nordisk', assetName: 'Wegovy/Ozempic', modality: 'glp1Agonist', phase: 'approved', indication: 'Obesity/T2D', differentiator: 'Market creator; $20B+ franchise' },
      { companyName: 'Lilly', assetName: 'Mounjaro/Zepbound', modality: 'dualIncretin', phase: 'approved', indication: 'Obesity/T2D', differentiator: 'Superior weight loss (~25%)' },
      { companyName: 'Amgen', assetName: 'MariTide', modality: 'mab', phase: 'phase2', indication: 'Obesity', expectedApprovalYear: 2027, differentiator: 'Monthly dosing; muscle-sparing' },
      { companyName: 'Viking Therapeutics', assetName: 'VK2735', modality: 'dualIncretin', phase: 'phase2', indication: 'Obesity', expectedApprovalYear: 2027, differentiator: 'Oral formulation potential' },
      { companyName: 'Roche', assetName: 'CT-996', modality: 'smallMolecule', phase: 'phase1', indication: 'Obesity', differentiator: 'Oral GLP-1 small molecule' },
    ],
    marketDynamics: 'Largest pharma market opportunity in history ($100B+ projected). Oral formulations and muscle-sparing profiles are key differentiation vectors. Crowded but massive.',
  },

  // Immunology
  sle_lupus: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'GSK', assetName: 'Benlysta', modality: 'mab', phase: 'approved', indication: 'SLE', differentiator: 'Only targeted biologic approved for SLE' },
      { companyName: 'AstraZeneca', assetName: 'Anifrolumab', modality: 'mab', phase: 'approved', indication: 'SLE', differentiator: 'Type I interferon receptor antagonist' },
    ],
    marketDynamics: 'Historically difficult indication with high failure rate. Recent successes have validated interferon and B-cell pathways. Significant unmet need in lupus nephritis.',
  },
  atopicderm: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Sanofi/Regeneron', assetName: 'Dupixent', modality: 'mab', phase: 'approved', indication: 'Atopic Derm', differentiator: '$13B franchise; IL-4/IL-13' },
      { companyName: 'AbbVie', assetName: 'Rinvoq', modality: 'jakInhibitor', phase: 'approved', indication: 'Atopic Derm', differentiator: 'Oral JAK1; box warning limits uptake' },
      { companyName: 'Pfizer', assetName: 'Cibinqo', modality: 'jakInhibitor', phase: 'approved', indication: 'Atopic Derm', differentiator: 'Oral JAK1' },
      { companyName: 'Lilly', assetName: 'Ebglyss', modality: 'mab', phase: 'approved', indication: 'Atopic Derm', differentiator: 'IL-13 selective' },
    ],
    marketDynamics: 'Dupixent dominates but faces emerging competition from oral agents and next-gen biologics. OX40 and IL-31 targets in development.',
  },

  // Ophthalmology
  wetAmd: {
    density: 'high',
    keyAssets: [
      { companyName: 'Roche', assetName: 'Vabysmo', modality: 'antiVegf', phase: 'approved', indication: 'Wet AMD', differentiator: 'Bispecific anti-VEGF/Ang-2; extended dosing' },
      { companyName: 'Regeneron', assetName: 'Eylea HD', modality: 'antiVegf', phase: 'approved', indication: 'Wet AMD', differentiator: '8mg high-dose; extended intervals' },
      { companyName: 'Various', assetName: 'Anti-VEGF biosimilars', modality: 'antiVegf', phase: 'approved', indication: 'Wet AMD', differentiator: 'Price pressure from ranibizumab/aflibercept biosimilars' },
    ],
    marketDynamics: 'Anti-VEGF market faces biosimilar erosion but premium for extended dosing. Gene therapy approaches promise one-time treatment.',
  },
  dryAmdGA: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Apellis', assetName: 'SYFOVRE', modality: 'complementInhibitor', phase: 'approved', indication: 'Geographic Atrophy', differentiator: 'First approved therapy for GA' },
      { companyName: 'Astellas (ex-Iveric)', assetName: 'IZERVAY', modality: 'complementInhibitor', phase: 'approved', indication: 'Geographic Atrophy', differentiator: 'Monthly C5 inhibitor' },
    ],
    marketDynamics: 'Newly opened market with two complement-based approvals. Adoption slower than expected due to injection burden and modest efficacy. Next wave targeting earlier disease.',
  },

  // Cardiovascular
  heartFailureHfref: {
    density: 'high',
    keyAssets: [
      { companyName: 'Novartis', assetName: 'Entresto', modality: 'smallMolecule', phase: 'approved', indication: 'HFrEF', differentiator: 'ARNI standard of care; $6B franchise' },
      { companyName: 'AstraZeneca', assetName: 'Farxiga', modality: 'sglt2Inhibitor', phase: 'approved', indication: 'HFrEF', differentiator: 'SGLT2i with HF indication' },
      { companyName: 'BMS', assetName: 'Camzyos', modality: 'myosinInhibitor', phase: 'approved', indication: 'HCM', differentiator: 'First-in-class myosin inhibitor' },
    ],
    marketDynamics: 'Four-pillar HF therapy established (ARNI, SGLT2i, MRA, beta-blocker). Innovation opportunity in gene therapy for cardiomyopathies.',
  },

  // Women's Health
  endometriosis: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'AbbVie', assetName: 'Orilissa', modality: 'gnrhAntagonist', phase: 'approved', indication: 'Endometriosis', differentiator: 'Oral GnRH antagonist' },
      { companyName: 'Myovant/Sumitomo', assetName: 'MYFEMBREE', modality: 'gnrhAntagonist', phase: 'approved', indication: 'Endometriosis/Fibroids', differentiator: 'Combo with add-back therapy' },
    ],
    marketDynamics: 'Underserved market with 10-year average diagnostic delay. GnRH antagonists gaining share. Non-hormonal approaches in early development.',
  },
};

/**
 * Analyze competitive landscape for a given indication.
 * Combines curated intelligence with live clinical trial data from the database.
 */
export async function analyzeCompetitiveLandscape(
  supabase: SupabaseClient,
  indication: string,
  therapeuticArea: string,
  modality?: string,
): Promise<CompetitiveLandscape> {
  // Start with curated data
  const curated = CURATED_COMPETITIVE_DATA[indication];

  // Query live trial data for competing assets
  let trialCount = 0;
  const byPhase: Record<string, number> = {};

  try {
    const { data: trials } = await supabase
      .from('company_trials')
      .select('company_name, phase, modality, indication_specific')
      .in('status', ['recruiting', 'active_not_recruiting', 'not_yet_recruiting'])
      .or(`indication_specific.eq.${indication},indication_category.eq.${getIndicationCategory(indication, therapeuticArea)}`)
      .limit(100);

    if (trials) {
      trialCount = trials.length;
      for (const trial of trials) {
        const phase = trial.phase || 'Unknown';
        byPhase[phase] = (byPhase[phase] || 0) + 1;
      }
    }
  } catch {
    // Database query failed — use curated data only
  }

  // Calculate competitive density score (0-100)
  let densityScore = 50; // default moderate
  if (curated) {
    const densityMap: Record<string, number> = {
      very_high: 85, high: 70, moderate: 50, low: 30, very_low: 15,
    };
    densityScore = densityMap[curated.density] || 50;
  }
  // Adjust by live trial count
  if (trialCount > 20) densityScore = Math.min(95, densityScore + 15);
  else if (trialCount > 10) densityScore = Math.min(90, densityScore + 10);
  else if (trialCount < 3) densityScore = Math.max(10, densityScore - 15);

  const keyCompetitors = curated?.keyAssets || [];
  const firstMoverAdvantage = densityScore < 40;

  // Market share erosion estimate
  const erosionMap: Record<string, number> = {
    very_high: 0.45, high: 0.30, moderate: 0.15, low: 0.08, very_low: 0.03,
  };
  const erosion = curated ? (erosionMap[curated.density] || 0.15) : Math.min(0.50, trialCount * 0.02);

  // Expected next approval
  const upcomingApprovals = keyCompetitors
    .filter(a => a.expectedApprovalYear && a.expectedApprovalYear > new Date().getFullYear())
    .sort((a, b) => (a.expectedApprovalYear || 9999) - (b.expectedApprovalYear || 9999));
  const expectedNextApproval = upcomingApprovals[0]
    ? { company: upcomingApprovals[0].companyName, year: upcomingApprovals[0].expectedApprovalYear! }
    : undefined;

  const narrative = curated?.marketDynamics ||
    `${trialCount} active clinical trials identified for this indication. ` +
    `Competitive density is ${densityScore > 70 ? 'high' : densityScore > 40 ? 'moderate' : 'low'}, ` +
    `suggesting ${densityScore > 70 ? 'significant competitive pressure' : densityScore > 40 ? 'a manageable competitive environment' : 'limited competition with potential first-mover advantage'}.`;

  return {
    indication,
    totalCompetingAssets: Math.max(trialCount, keyCompetitors.length),
    byPhase,
    keyCompetitors,
    competitiveDensityScore: densityScore,
    firstMoverAdvantage,
    expectedNextApproval,
    marketShareErosionEstimate: erosion,
    narrative,
  };
}

/** Map specific indication to its category for broader trial search */
function getIndicationCategory(indication: string, therapeuticArea: string): string {
  const categoryMap: Record<string, string> = {
    oncology: 'solid_tumor',
    neurology: 'cns',
    immunology: 'autoimmune',
    metabolic: 'metabolic',
    cardiovascular: 'cardiovascular',
    infectiousDisease: 'infectious_disease',
    ophthalmology: 'ophthalmology',
    womensHealth: 'reproductive',
  };
  return categoryMap[therapeuticArea] || therapeuticArea;
}
