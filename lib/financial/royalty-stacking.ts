/**
 * Royalty Stacking Risk & Anti-Stacking Provisions
 *
 * Models cumulative upstream royalty obligations and anti-stacking provisions
 * to compute net effective royalty retained by the licensor.
 *
 * Sources: Royalty Pharma SEC filings, Seagen ADC platform terms, UPenn gene
 * therapy patent pool, Alnylam/Arbutus LNP arbitration, DealForma (2018-2025).
 *
 * @module lib/financial/royalty-stacking
 */

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export type IPType = 'platform' | 'method' | 'composition' | 'formulation';

export type StackingModality =
  | 'smallMolecule' | 'mab' | 'adc' | 'carT'
  | 'geneTherapy_AAV' | 'siRNA_ASO' | 'bispecific';

export interface BackgroundIP {
  source: string;
  rate: number;
  type: IPType;
}

export type AntiStackingModel = 'floor' | 'cap' | 'proRata';

export interface AntiStackingProvision {
  model: AntiStackingModel;
  /** floor: min net as fraction of gross; cap: max burden in absolute rate; proRata: factor per obligation */
  value: number;
}

export interface StackedObligation {
  source: string;
  rate: number;
  type: IPType;
}

export interface RoyaltyStackingResult {
  netRoyaltyRate: number;
  stackedObligations: StackedObligation[];
  totalUpstreamBurden: number;
  antiStackingOffset: number;
  effectiveRetention: number;
  impactOnDealValue_pct: number;
  narrative: string;
}

// ---------------------------------------------------------------------------
// Reference Data: Typical Background IP Rates by Modality
// ---------------------------------------------------------------------------

export const TYPICAL_BACKGROUND_IP_RATES: Record<
  StackingModality,
  { range: [number, number]; midpoint: number; description: string; commonSources: string[] }
> = {
  smallMolecule: {
    range: [0.01, 0.03], midpoint: 0.02,
    description: 'Synthesis methods, salt/polymorph forms, formulation IP',
    commonSources: ['University composition patents', 'Process chemistry licenses'],
  },
  mab: {
    range: [0.02, 0.04], midpoint: 0.03,
    description: 'Hybridoma technology, humanization platforms, Fc engineering',
    commonSources: ['MedImmune (AZ)', 'Genentech/Roche', 'Medarex (BMS)'],
  },
  adc: {
    range: [0.04, 0.08], midpoint: 0.06,
    description: 'Linker-payload technology, conjugation chemistry, bystander effect IP',
    commonSources: ['Seagen (vcMMAE/vcMMAF)', 'ImmunoGen (DM1/DM4)', 'Daiichi Sankyo (DXd)'],
  },
  carT: {
    range: [0.03, 0.06], midpoint: 0.045,
    description: 'Viral vector technology, costimulatory domain patents, manufacturing IP',
    commonSources: ['UPenn (Carl June patents)', 'Juno/BMS (4-1BB domain)', 'St. Jude (CD28)'],
  },
  geneTherapy_AAV: {
    range: [0.05, 0.10], midpoint: 0.075,
    description: 'AAV capsid serotypes, tissue-specific promoters, manufacturing scale-up',
    commonSources: ['UPenn (AAV9, James Wilson)', 'Spark (manufacturing)', 'REGENXBIO (NAV Platform)', 'Genethon (promoters)'],
  },
  siRNA_ASO: {
    range: [0.03, 0.05], midpoint: 0.04,
    description: 'Lipid nanoparticle delivery, backbone modifications, targeting ligands',
    commonSources: ['Alnylam (GalNAc platform)', 'Arbutus/Genevant (LNP)', 'Ionis (2\'-MOE chemistry)'],
  },
  bispecific: {
    range: [0.03, 0.06], midpoint: 0.045,
    description: 'Bispecific format patents, T-cell engager architecture, purification methods',
    commonSources: ['Genentech (CrossMAb, knobs-into-holes)', 'Amgen (BiTE)', 'Regeneron (VelociSuite)'],
  },
};

// ---------------------------------------------------------------------------
// Reference Data: Standard Anti-Stacking Provisions
// ---------------------------------------------------------------------------

export const ANTI_STACKING_MODELS: Record<
  AntiStackingModel,
  { description: string; typicalRange: [number, number]; defaultValue: number }
> = {
  floor: {
    description: 'Net royalty cannot fall below X% of gross. Most common provision (~70% of deals with stacking language).',
    typicalRange: [0.50, 0.60], defaultValue: 0.50,
  },
  cap: {
    description: 'Total deductible third-party royalties capped at Y pp of gross. Seen in ~40% of licenses, often paired with floor.',
    typicalRange: [0.03, 0.05], defaultValue: 0.04,
  },
  proRata: {
    description: 'Each additional obligation reduced proportionally (e.g., 0.25 factor: 2nd reduced 25%, 3rd 50%). Less common (~15%), favored in gene therapy.',
    typicalRange: [0.20, 0.35], defaultValue: 0.25,
  },
};

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/** Round to 4 decimal places (basis-point precision) */
function bp(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Apply anti-stacking provisions in order: proRata -> cap -> floor.
 * Returns adjusted burden, offset, and itemized obligations.
 */
function applyAntiStacking(
  grossRate: number,
  obligations: BackgroundIP[],
  provisions: AntiStackingProvision[],
): { adjustedBurden: number; offset: number; adjustedObligations: StackedObligation[] } {
  const sorted = [...obligations].sort((a, b) => b.rate - a.rate);
  let rates = sorted.map((o) => o.rate);

  // Step 1: Pro-rata — each successive obligation reduced by factor * index
  const proRata = provisions.find((p) => p.model === 'proRata');
  if (proRata) {
    rates = rates.map((r, i) => r * (1 - Math.min(1, proRata.value * i)));
  }

  let total = rates.reduce((s, r) => s + r, 0);

  // Step 2: Cap — total third-party burden capped at absolute rate
  const cap = provisions.find((p) => p.model === 'cap');
  if (cap && total > cap.value) {
    const sf = cap.value / total;
    rates = rates.map((r) => r * sf);
    total = cap.value;
  }

  // Step 3: Floor — net royalty cannot fall below floor fraction of gross
  const floor = provisions.find((p) => p.model === 'floor');
  if (floor) {
    const maxDeductible = grossRate - grossRate * floor.value;
    if (total > maxDeductible) {
      const sf = maxDeductible / total;
      rates = rates.map((r) => r * sf);
      total = maxDeductible;
    }
  }

  const rawBurden = obligations.reduce((s, o) => s + o.rate, 0);

  return {
    adjustedBurden: bp(total),
    offset: bp(rawBurden - total),
    adjustedObligations: sorted.map((o, i) => ({ source: o.source, rate: bp(rates[i]), type: o.type })),
  };
}

/**
 * Estimate deal-value impact from royalty erosion.
 * Royalties typically represent ~50% of total deal value; milestones are unaffected.
 */
function estimateDealValueImpact(retentionLoss: number, royaltyShare = 0.50): number {
  return bp(retentionLoss * royaltyShare);
}

/** Build human-readable narrative for the stacking analysis. */
function buildNarrative(
  grossRate: number,
  netRate: number,
  adjustedBurden: number,
  offset: number,
  obligations: StackedObligation[],
  provisions: AntiStackingProvision[],
  dealImpact: number,
): string {
  const pct = (v: number) => (v * 100).toFixed(1);
  const parts: string[] = [];

  parts.push(
    `Gross contractual royalty of ${pct(grossRate)}% is subject to ${obligations.length} ` +
    `upstream IP obligation${obligations.length !== 1 ? 's' : ''} totaling ${pct(adjustedBurden)}pp in effective stacking burden.`,
  );

  if (provisions.length > 0) {
    const labels = provisions.map((p) => {
      if (p.model === 'floor') return `floor at ${(p.value * 100).toFixed(0)}% of gross`;
      if (p.model === 'cap') return `cap at ${pct(p.value)}pp`;
      return `pro-rata (${(p.value * 100).toFixed(0)}%/obligation)`;
    });
    parts.push(`Anti-stacking provisions (${labels.join('; ')}) reduce burden by ${pct(offset)}pp.`);
  } else {
    parts.push('No anti-stacking provisions apply. Full upstream burden borne by licensor.');
  }

  const retainedPct = ((netRate / grossRate) * 100).toFixed(0);
  parts.push(`Net effective royalty: ${pct(netRate)}% (${retainedPct}% retention). Deal value impact: -${pct(dealImpact)}%.`);

  if (obligations.length >= 3) {
    parts.push('Stacking risk is elevated. Consider renegotiating upstream licenses or consolidating via patent pool.');
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Main Computation
// ---------------------------------------------------------------------------

/**
 * Compute net effective royalty rate after upstream stacking and anti-stacking provisions.
 *
 * @param grossRoyaltyRate - Contractual gross royalty (decimal, e.g. 0.12 for 12%)
 * @param backgroundIPs - Upstream IP obligations the licensee must pay
 * @param antiStackingProvisions - Contractual provisions limiting stacking erosion
 *
 * @example
 * computeRoyaltyStacking(0.12,
 *   [{ source: 'Seagen vcMMAE', rate: 0.04, type: 'platform' },
 *    { source: 'University composition', rate: 0.02, type: 'composition' }],
 *   [{ model: 'floor', value: 0.50 }])
 * // => netRoyaltyRate: 0.06 (floor keeps net at 50% of gross)
 */
export function computeRoyaltyStacking(
  grossRoyaltyRate: number,
  backgroundIPs: BackgroundIP[],
  antiStackingProvisions: AntiStackingProvision[] = [],
): RoyaltyStackingResult {
  if (grossRoyaltyRate <= 0 || grossRoyaltyRate > 1) {
    throw new Error(`grossRoyaltyRate must be in (0, 1]. Got: ${grossRoyaltyRate}`);
  }
  for (const ip of backgroundIPs) {
    if (ip.rate < 0 || ip.rate > 1) {
      throw new Error(`Background IP rate for "${ip.source}" must be in [0, 1]. Got: ${ip.rate}`);
    }
  }

  if (backgroundIPs.length === 0) {
    return {
      netRoyaltyRate: grossRoyaltyRate,
      stackedObligations: [],
      totalUpstreamBurden: 0,
      antiStackingOffset: 0,
      effectiveRetention: 1,
      impactOnDealValue_pct: 0,
      narrative: `Gross royalty of ${(grossRoyaltyRate * 100).toFixed(1)}% has no upstream stacking obligations. Full royalty retained.`,
    };
  }

  const rawBurden = backgroundIPs.reduce((s, ip) => s + ip.rate, 0);
  const { adjustedBurden, offset, adjustedObligations } = applyAntiStacking(
    grossRoyaltyRate, backgroundIPs, antiStackingProvisions,
  );

  const netRoyaltyRate = bp(Math.max(0, grossRoyaltyRate - adjustedBurden));
  const effectiveRetention = grossRoyaltyRate > 0 ? bp(netRoyaltyRate / grossRoyaltyRate) : 0;
  const dealImpact = estimateDealValueImpact(1 - effectiveRetention);

  const narrative = buildNarrative(
    grossRoyaltyRate, netRoyaltyRate, adjustedBurden, offset,
    adjustedObligations, antiStackingProvisions, dealImpact,
  );

  return {
    netRoyaltyRate,
    stackedObligations: adjustedObligations,
    totalUpstreamBurden: bp(rawBurden),
    antiStackingOffset: offset,
    effectiveRetention,
    impactOnDealValue_pct: bp(dealImpact),
    narrative,
  };
}

// ---------------------------------------------------------------------------
// Convenience: Stacking Estimate from Modality
// ---------------------------------------------------------------------------

/**
 * Quick stacking estimate using typical rates for a modality.
 * Applies default floor provision at 50% of gross.
 */
const MODALITY_TO_STACKING: Record<string, StackingModality> = {
  smallMolecule: 'smallMolecule', mab: 'mab', adc: 'adc', bispecific: 'bispecific', trispecificAntibody: 'bispecific',
  carT_heme: 'carT', carT_solid: 'carT', carT_autoimmune: 'carT', inVivoCarT: 'carT', carTreg: 'carT',
  geneTherapy: 'geneTherapy_AAV', geneTherapyOcular: 'geneTherapy_AAV', geneTherapyRare: 'geneTherapy_AAV',
  rnai: 'siRNA_ASO', aso: 'siRNA_ASO', oligonucleotide: 'siRNA_ASO', siRNA: 'siRNA_ASO',
  tCellEngager: 'bispecific', bispecificHeme: 'bispecific',
  peptide: 'smallMolecule', protac: 'smallMolecule', molecularGlue: 'smallMolecule',
  glp1Agonist: 'smallMolecule', dualIncretin: 'smallMolecule', tripleIncretin: 'smallMolecule',
  oralPeptide: 'smallMolecule', sglt2Inhibitor: 'smallMolecule', amylinAnalog: 'smallMolecule',
  mrna: 'siRNA_ASO', cellTherapy: 'carT', stemCell: 'carT',
  radiopharmaceutical: 'smallMolecule', psychedelic: 'smallMolecule',
  antiVegf: 'mab', fcrnAntagonist: 'mab', complementInhibitor: 'mab',
  jakInhibitor: 'smallMolecule', jakInhibitorDerm: 'smallMolecule',
  il17Inhibitor: 'mab', il13Inhibitor: 'mab', s1pModulator: 'smallMolecule',
  antiTl1a: 'mab', tl1aInhibitor: 'mab', il23GI: 'mab',
  myosinInhibitor: 'smallMolecule', pcsk9Targeting: 'mab', rnaCardio: 'siRNA_ASO',
  antiviral: 'smallMolecule', antibioticNovel: 'smallMolecule', vaccinePreventive: 'mab', phageTherapy: 'mab',
  gnrhAntagonist: 'smallMolecule', hormoneTherapy: 'smallMolecule', neuroactiveSteroid: 'smallMolecule',
  enzymeReplacement: 'mab', substrateReduction: 'smallMolecule',
  oncolyticVirus: 'geneTherapy_AAV', bbbPlatform: 'mab', therapeuticVaccine: 'mab',
  ionChannel: 'smallMolecule', tauTargeting: 'mab',
  topicalBiologic: 'mab', topicalOphthalmic: 'smallMolecule', intravitreal: 'mab',
  oralIntegrin: 'smallMolecule', gutSelectiveIntegrin: 'mab', dualAntagonist: 'mab',
  btki: 'smallMolecule', microbiomeBased: 'smallMolecule', antiActivin: 'mab',
  anticoagulantNovel: 'smallMolecule',
};

export function estimateStackingByModality(
  grossRoyaltyRate: number,
  modality: StackingModality | string,
  obligationCount = 2,
): RoyaltyStackingResult {
  const mappedModality = MODALITY_TO_STACKING[modality as string] || (modality as StackingModality);
  const profile = TYPICAL_BACKGROUND_IP_RATES[mappedModality];
  if (!profile) throw new Error(`Unknown modality: ${modality}`);

  const perRate = profile.midpoint / Math.max(1, obligationCount);
  const types: IPType[] = ['platform', 'composition', 'method', 'formulation'];
  const backgroundIPs: BackgroundIP[] = Array.from({ length: obligationCount }, (_, i) => ({
    source: profile.commonSources[i % profile.commonSources.length],
    rate: perRate,
    type: types[i % types.length],
  }));

  return computeRoyaltyStacking(grossRoyaltyRate, backgroundIPs, [
    { model: 'floor', value: ANTI_STACKING_MODELS.floor.defaultValue },
  ]);
}
