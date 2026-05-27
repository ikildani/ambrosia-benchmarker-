import {
  calculateDealTerms,
  formatCurrency,
  type CalculationInput,
  type Phase,
  type Modality,
  type Indication,
  type TherapeuticArea,
} from './calculations';
import type { BenchmarkPageData } from './benchmarkPages';

// ── Label maps ──────────────────────────────────────────────────────────────

const TA_LABELS: Record<string, string> = {
  oncology: 'Oncology',
  neurology: 'Neurology',
  immunology: 'Immunology',
  metabolic: 'Metabolic',
  cardiovascular: 'Cardiovascular',
  infectiousDisease: 'Infectious Disease',
  ophthalmology: 'Ophthalmology',
  rareDisease: 'Rare Disease',
  hematology: 'Hematology',
  dermatology: 'Dermatology',
  gastroenterology: 'Gastroenterology',
};

const MODALITY_LABELS: Record<string, string> = {
  smallMolecule: 'Small Molecule',
  mab: 'Monoclonal Antibody',
  adc: 'ADC',
  bispecific: 'Bispecific Antibody',
  carT_heme: 'CAR-T (Heme)',
  carT_solid: 'CAR-T (Solid Tumor)',
  geneTherapy: 'Gene Therapy',
  radiopharmaceutical: 'Radiopharmaceutical',
  protac: 'PROTAC',
  molecularGlue: 'Molecular Glue',
  rnai: 'RNAi / siRNA',
  aso: 'ASO',
  peptide: 'Peptide',
  mrna: 'mRNA',
  tCellEngager: 'T-Cell Engager',
  therapeuticVaccine: 'Therapeutic Vaccine',
  oncolyticVirus: 'Oncolytic Virus',
  cellTherapy: 'Cell Therapy',
  bbbPlatform: 'BBB Platform',
  psychedelic: 'Psychedelic',
  ionChannel: 'Ion Channel',
  tauTargeting: 'Tau-Targeting',
  stemCell: 'Stem Cell',
  carT_autoimmune: 'CAR-T (Autoimmune)',
  inVivoCarT: 'In Vivo CAR-T',
  carTreg: 'CAR-Treg',
  fcrnAntagonist: 'FcRn Antagonist',
  complementInhibitor: 'Complement Inhibitor',
  jakInhibitor: 'JAK Inhibitor',
  s1pModulator: 'S1P Modulator',
  oralIntegrin: 'Oral Integrin',
  tl1aInhibitor: 'TL1A Inhibitor',
  glp1Agonist: 'GLP-1 Agonist',
  dualIncretin: 'Dual Incretin',
  tripleIncretin: 'Triple Incretin',
  sglt2Inhibitor: 'SGLT2 Inhibitor',
  amylinAnalog: 'Amylin Analog',
  oralPeptide: 'Oral Peptide',
  antiActivin: 'Anti-Activin',
  myosinInhibitor: 'Myosin Inhibitor',
  pcsk9Targeting: 'PCSK9',
  rnaCardio: 'RNA (CV)',
  antiviral: 'Antiviral',
  antibioticNovel: 'Novel Antibiotic',
  vaccinePreventive: 'Preventive Vaccine',
  antiVegf: 'Anti-VEGF',
  geneTherapyOcular: 'Gene Therapy (Ocular)',
  intravitreal: 'Intravitreal',
  topicalOphthalmic: 'Topical Ophthalmic',
  il17Inhibitor: 'IL-17 Inhibitor',
  il13Inhibitor: 'IL-13 Inhibitor',
  jakInhibitorDerm: 'JAK Inhibitor (Derm)',
  bispecificHeme: 'Bispecific (Heme)',
  btki: 'BTKi',
  antiTl1a: 'Anti-TL1A',
  il23GI: 'IL-23 (GI)',
  gutSelectiveIntegrin: 'Gut-Selective Integrin',
  enzymeReplacement: 'ERT',
  substrateReduction: 'SRT',
  geneTherapyRare: 'Gene Therapy (Rare)',
  dualAntagonist: 'Dual Antagonist',
  microbiomeBased: 'Microbiome',
};

const PHASE_LABELS: Record<string, string> = {
  preclinical: 'Preclinical',
  phase1: 'Phase 1',
  phase1_2: 'Phase 1/2',
  phase2: 'Phase 2',
  phase2_3: 'Phase 2/3',
  phase3: 'Phase 3',
  approved: 'Approved',
};

// ── Default indications per TA ──────────────────────────────────────────────

const DEFAULT_INDICATION: Record<string, string> = {
  oncology: 'lung_nsclc',
  neurology: 'alzheimers',
  immunology: 'rheumatoidArthritis',
  metabolic: 'obesity',
  cardiovascular: 'heartFailureHfref',
  infectiousDisease: 'hivAids',
  ophthalmology: 'wetAmd',
  rareDisease: 'spinalMuscularAtrophy',
  hematology: 'dlbcl',
  dermatology: 'atopicDermatitis',
  gastroenterology: 'crohnsDisease',
};

// ── Slug helpers ────────────────────────────────────────────────────────────

function modalityToSlug(mod: string): string {
  const overrides: Record<string, string> = {
    smallMolecule: 'small-molecule',
    mab: 'mab',
    adc: 'adc',
    bispecific: 'bispecific',
    carT_heme: 'car-t-heme',
    carT_solid: 'car-t-solid',
    geneTherapy: 'gene-therapy',
    radiopharmaceutical: 'radiopharmaceutical',
    protac: 'protac',
    molecularGlue: 'molecular-glue',
    rnai: 'rnai',
    aso: 'aso',
    peptide: 'peptide',
    mrna: 'mrna',
    tCellEngager: 't-cell-engager',
    therapeuticVaccine: 'therapeutic-vaccine',
    cellTherapy: 'cell-therapy',
    glp1Agonist: 'glp1-agonist',
    dualIncretin: 'dual-incretin',
    tripleIncretin: 'triple-incretin',
    oralPeptide: 'oral-peptide',
    jakInhibitor: 'jak-inhibitor',
    tl1aInhibitor: 'tl1a-inhibitor',
    fcrnAntagonist: 'fcrn-antagonist',
    complementInhibitor: 'complement-inhibitor',
    il17Inhibitor: 'il17-inhibitor',
    il13Inhibitor: 'il13-inhibitor',
    jakInhibitorDerm: 'jak-inhibitor-derm',
    bispecificHeme: 'bispecific-heme',
    antiTl1a: 'anti-tl1a',
    il23GI: 'il23-gi',
    antiVegf: 'anti-vegf',
    pcsk9Targeting: 'pcsk9',
    myosinInhibitor: 'myosin-inhibitor',
    enzymeReplacement: 'ert',
    geneTherapyRare: 'gene-therapy-rare',
    carT_autoimmune: 'car-t-autoimmune',
    s1pModulator: 's1p-modulator',
    oralIntegrin: 'oral-integrin',
  };
  return overrides[mod] || mod.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
}

function taToSlug(ta: string): string {
  const overrides: Record<string, string> = {
    infectiousDisease: 'infectious-disease',
    rareDisease: 'rare-disease',
  };
  return overrides[ta] || ta;
}

function phaseToSlug(phase: string): string {
  const overrides: Record<string, string> = {
    preclinical: 'preclinical',
    phase1: 'phase-1',
    phase1_2: 'phase-1-2',
    phase2: 'phase-2',
    phase2_3: 'phase-2-3',
    phase3: 'phase-3',
    approved: 'approved',
  };
  return overrides[phase] || phase;
}

// ── Input factory ───────────────────────────────────────────────────────────

function makeComparisonInput(
  ta: string,
  mod: string,
  phase: string,
  indication?: string
): CalculationInput {
  const therapeuticArea = ta as TherapeuticArea;
  const isNeuro = ta === 'neurology';
  const isMetabolic = ta === 'metabolic';
  const isImmunology = ta === 'immunology';
  const isCardio = ta === 'cardiovascular';
  const isInfectious = ta === 'infectiousDisease';
  const isOphtho = ta === 'ophthalmology';
  const isRare = ta === 'rareDisease';
  const isHeme = ta === 'hematology';
  const isDerm = ta === 'dermatology';
  const isGI = ta === 'gastroenterology';

  const base: CalculationInput = {
    therapeuticArea,
    phase: phase as Phase,
    modality: mod as Modality,
    indication: (indication || DEFAULT_INDICATION[ta] || 'lung_nsclc') as Indication,
    territory: 'global',
    biomarker: 'unselected',
    lineOfTherapy: '2L',
    treatmentApproach: isNeuro ? 'diseaseModifying' : 'symptomatic',
    combinationPotential: 'some',
    competitivePosition: 'racing',
    dataQuality: 'promising',
    regulatoryDesignations: {
      breakthrough: false,
      fastTrack: false,
      orphan: isRare,
      prime: false,
    },
  };

  if (isNeuro) {
    base.bbbPenetration = 'promisingPreclinical';
    base.diseaseProgression = 'moderateProgressive';
    base.biomarkerValidation = 'exploratory';
  }
  if (isMetabolic) {
    base.mechanismDifferentiation = mod.includes('incretin') || mod === 'glp1Agonist' ? 'incretinBased' : 'nonIncretin';
    base.weightLossEfficacy = 'competitiveEfficacy';
    base.routeOfAdministration = mod === 'oralPeptide' ? 'oral' : 'injectable';
    base.comorbidityBreadth = 'obesityPrimary';
    base.metabolicTreatmentApproach = 'chronicWeightMgmt';
  }
  if (isImmunology) {
    base.immuneResetPotential = mod.includes('carT') ? 'curativeIntent' : 'chronicTreatment';
    base.targetSpecificity = 'pathwayTargeted';
    base.diseaseSeverity = 'moderateSevere';
    base.treatmentGoal = 'remissionInduction';
  }
  if (isCardio) {
    base.cvOutcomeBenefit = 'hospitalizationReduction';
    base.cvTrialEndpoint = 'maceEndpoint';
    base.cvPopulationRisk = 'highRisk';
  }
  if (isInfectious) {
    base.resistanceProfile = 'novelTarget';
    base.infectionChronicity = 'chronic';
    base.publicHealthPriority = 'standard';
  }
  if (isOphtho) {
    base.ocularDelivery = mod === 'topicalOphthalmic' ? 'topical' : 'intravitreal';
    base.treatmentDurability = 'extendedDuration';
    base.visionImpact = 'visionThreatening';
  }
  if (isRare) {
    base.orphanDesignation = 'fda_orphan';
    base.patientPopulationSize = 'rare_1k_10k';
    base.geneticBasis = 'monogenic_validated';
  }
  if (isHeme) {
    base.hemeLineage = 'lymphoid';
    base.transplantEligibility = 'transplant_eligible';
    base.mrdStatus = 'standard_response';
  }
  if (isDerm) {
    base.skinSeverity = 'moderate';
    base.chronicityProfile = 'chronic_relapsing';
    base.topicalVsSystemic = 'systemic_only';
  }
  if (isGI) {
    base.giSegment = 'colonic';
    base.biologicExperience = 'biologic_naive';
    base.endoscopicEndpoint = 'endoscopic_remission';
  }

  return base;
}

// ── Type A: Modality vs Modality (within same TA) ───────────────────────────

interface ModalityPairDef {
  ta: string;
  modA: string;
  modB: string;
}

const MODALITY_PAIRS: ModalityPairDef[] = [
  // Oncology
  { ta: 'oncology', modA: 'adc', modB: 'bispecific' },
  { ta: 'oncology', modA: 'smallMolecule', modB: 'mab' },
  { ta: 'oncology', modA: 'adc', modB: 'carT_heme' },
  { ta: 'oncology', modA: 'smallMolecule', modB: 'adc' },
  { ta: 'oncology', modA: 'bispecific', modB: 'carT_heme' },
  { ta: 'oncology', modA: 'radiopharmaceutical', modB: 'adc' },
  { ta: 'oncology', modA: 'protac', modB: 'smallMolecule' },
  { ta: 'oncology', modA: 'mab', modB: 'bispecific' },
  { ta: 'oncology', modA: 'geneTherapy', modB: 'carT_solid' },
  { ta: 'oncology', modA: 'rnai', modB: 'aso' },
  { ta: 'oncology', modA: 'therapeuticVaccine', modB: 'mab' },
  { ta: 'oncology', modA: 'molecularGlue', modB: 'protac' },
  { ta: 'oncology', modA: 'adc', modB: 'radiopharmaceutical' },
  { ta: 'oncology', modA: 'carT_heme', modB: 'carT_solid' },
  { ta: 'oncology', modA: 'mab', modB: 'adc' },
  { ta: 'oncology', modA: 'bispecific', modB: 'tCellEngager' },
  { ta: 'oncology', modA: 'smallMolecule', modB: 'protac' },
  { ta: 'oncology', modA: 'oncolyticVirus', modB: 'therapeuticVaccine' },
  { ta: 'oncology', modA: 'mrna', modB: 'therapeuticVaccine' },
  { ta: 'oncology', modA: 'peptide', modB: 'smallMolecule' },

  // Neurology
  { ta: 'neurology', modA: 'smallMolecule', modB: 'mab' },
  { ta: 'neurology', modA: 'aso', modB: 'geneTherapy' },
  { ta: 'neurology', modA: 'smallMolecule', modB: 'bbbPlatform' },
  { ta: 'neurology', modA: 'mab', modB: 'geneTherapy' },
  { ta: 'neurology', modA: 'psychedelic', modB: 'smallMolecule' },
  { ta: 'neurology', modA: 'ionChannel', modB: 'smallMolecule' },
  { ta: 'neurology', modA: 'tauTargeting', modB: 'mab' },
  { ta: 'neurology', modA: 'aso', modB: 'rnai' },
  { ta: 'neurology', modA: 'stemCell', modB: 'geneTherapy' },
  { ta: 'neurology', modA: 'smallMolecule', modB: 'aso' },
  { ta: 'neurology', modA: 'bbbPlatform', modB: 'geneTherapy' },
  { ta: 'neurology', modA: 'peptide', modB: 'mab' },
  { ta: 'neurology', modA: 'smallMolecule', modB: 'psychedelic' },
  { ta: 'neurology', modA: 'mab', modB: 'aso' },
  { ta: 'neurology', modA: 'geneTherapy', modB: 'rnai' },

  // Immunology
  { ta: 'immunology', modA: 'jakInhibitor', modB: 'tl1aInhibitor' },
  { ta: 'immunology', modA: 'mab', modB: 'bispecific' },
  { ta: 'immunology', modA: 'carT_autoimmune', modB: 'mab' },
  { ta: 'immunology', modA: 'fcrnAntagonist', modB: 'complementInhibitor' },
  { ta: 'immunology', modA: 'smallMolecule', modB: 'mab' },
  { ta: 'immunology', modA: 'jakInhibitor', modB: 'mab' },
  { ta: 'immunology', modA: 's1pModulator', modB: 'jakInhibitor' },
  { ta: 'immunology', modA: 'oralIntegrin', modB: 'tl1aInhibitor' },
  { ta: 'immunology', modA: 'carT_autoimmune', modB: 'carTreg' },
  { ta: 'immunology', modA: 'bispecific', modB: 'fcrnAntagonist' },
  { ta: 'immunology', modA: 'mab', modB: 'fcrnAntagonist' },
  { ta: 'immunology', modA: 'complementInhibitor', modB: 'mab' },
  { ta: 'immunology', modA: 'dualAntagonist', modB: 'mab' },
  { ta: 'immunology', modA: 'smallMolecule', modB: 'jakInhibitor' },
  { ta: 'immunology', modA: 'inVivoCarT', modB: 'carT_autoimmune' },

  // Metabolic
  { ta: 'metabolic', modA: 'glp1Agonist', modB: 'dualIncretin' },
  { ta: 'metabolic', modA: 'glp1Agonist', modB: 'oralPeptide' },
  { ta: 'metabolic', modA: 'dualIncretin', modB: 'tripleIncretin' },
  { ta: 'metabolic', modA: 'smallMolecule', modB: 'glp1Agonist' },
  { ta: 'metabolic', modA: 'sglt2Inhibitor', modB: 'glp1Agonist' },
  { ta: 'metabolic', modA: 'amylinAnalog', modB: 'glp1Agonist' },
  { ta: 'metabolic', modA: 'antiActivin', modB: 'glp1Agonist' },
  { ta: 'metabolic', modA: 'oralPeptide', modB: 'dualIncretin' },
  { ta: 'metabolic', modA: 'smallMolecule', modB: 'dualIncretin' },
  { ta: 'metabolic', modA: 'mab', modB: 'glp1Agonist' },
  { ta: 'metabolic', modA: 'microbiomeBased', modB: 'glp1Agonist' },
  { ta: 'metabolic', modA: 'geneTherapy', modB: 'smallMolecule' },
  { ta: 'metabolic', modA: 'tripleIncretin', modB: 'oralPeptide' },

  // Rare Disease
  { ta: 'rareDisease', modA: 'geneTherapy', modB: 'aso' },
  { ta: 'rareDisease', modA: 'geneTherapy', modB: 'smallMolecule' },
  { ta: 'rareDisease', modA: 'mab', modB: 'smallMolecule' },
  { ta: 'rareDisease', modA: 'cellTherapy', modB: 'geneTherapy' },
  { ta: 'rareDisease', modA: 'rnai', modB: 'aso' },
  { ta: 'rareDisease', modA: 'geneTherapy', modB: 'cellTherapy' },
  { ta: 'rareDisease', modA: 'peptide', modB: 'smallMolecule' },
];

function buildModalityVsModalityPage(def: ModalityPairDef): BenchmarkPageData {
  const { ta, modA, modB } = def;
  const taLabel = TA_LABELS[ta] || ta;
  const labelA = MODALITY_LABELS[modA] || modA;
  const labelB = MODALITY_LABELS[modB] || modB;

  const rA = calculateDealTerms(makeComparisonInput(ta, modA, 'phase2'));
  const rB = calculateDealTerms(makeComparisonInput(ta, modB, 'phase2'));

  const slug = `${taToSlug(ta)}-${modalityToSlug(modA)}-vs-${modalityToSlug(modB)}-deal-terms`;
  const title = `${labelA} vs ${labelB} Deal Terms Compared | ${taLabel} 2026 Licensing Benchmarks`;
  const h1 = `${labelA} vs ${labelB} — ${taLabel} Deal Terms Comparison`;
  const metaDescription = `Compare ${labelA.toLowerCase()} vs ${labelB.toLowerCase()} deal terms in ${taLabel.toLowerCase()}: ${labelA} median upfront ${formatCurrency(rA.terms.upfront.median)} vs ${labelB} ${formatCurrency(rB.terms.upfront.median)}. Side-by-side benchmarks from 2,500+ deals.`;

  const heroStats = [
    {
      label: `${labelA} Median Upfront`,
      value: formatCurrency(rA.terms.upfront.median),
      subtext: `Total: ${formatCurrency(rA.terms.totalDealValue.median)}`,
    },
    {
      label: `${labelB} Median Upfront`,
      value: formatCurrency(rB.terms.upfront.median),
      subtext: `Total: ${formatCurrency(rB.terms.totalDealValue.median)}`,
    },
    {
      label: `${labelA} Royalties`,
      value: `${rA.tieredRoyalties.base.low}%-${rA.tieredRoyalties.base.high}%`,
      subtext: `Tiered to ${rA.tieredRoyalties.highTier.high}%`,
    },
    {
      label: `${labelB} Royalties`,
      value: `${rB.tieredRoyalties.base.low}%-${rB.tieredRoyalties.base.high}%`,
      subtext: `Tiered to ${rB.tieredRoyalties.highTier.high}%`,
    },
  ];

  const contextParagraphs = [
    `In ${taLabel.toLowerCase()}, ${labelA} and ${labelB} represent two of the most actively transacted modalities. At Phase 2, ${labelA} deals carry a median total deal value of ${formatCurrency(rA.terms.totalDealValue.median)} with ${formatCurrency(rA.terms.upfront.median)} upfront, compared to ${formatCurrency(rB.terms.totalDealValue.median)} total value and ${formatCurrency(rB.terms.upfront.median)} upfront for ${labelB}. The valuation difference reflects distinct risk-reward profiles, manufacturing complexity, and competitive dynamics.`,
    `Milestone structures diverge between the two modalities. ${labelA} development milestones average ${formatCurrency(rA.terms.devMilestones.median)} versus ${formatCurrency(rB.terms.devMilestones.median)} for ${labelB}. Commercial milestones are ${formatCurrency(rA.terms.commMilestones.median)} for ${labelA} and ${formatCurrency(rB.terms.commMilestones.median)} for ${labelB}. Royalty rates range from ${rA.tieredRoyalties.base.low}%-${rA.tieredRoyalties.base.high}% for ${labelA} and ${rB.tieredRoyalties.base.low}%-${rB.tieredRoyalties.base.high}% for ${labelB}.`,
  ];

  const faqs = [
    {
      question: `How do ${labelA} and ${labelB} deal terms compare in ${taLabel.toLowerCase()}?`,
      answer: `${labelA} Phase 2 deals average ${formatCurrency(rA.terms.totalDealValue.median)} total deal value (${formatCurrency(rA.terms.upfront.median)} upfront), while ${labelB} deals average ${formatCurrency(rB.terms.totalDealValue.median)} (${formatCurrency(rB.terms.upfront.median)} upfront). The difference reflects modality-specific risk profiles, manufacturing considerations, and competitive positioning.`,
    },
    {
      question: `Which modality commands higher royalty rates: ${labelA} or ${labelB}?`,
      answer: `${labelA} base royalties range from ${rA.tieredRoyalties.base.low}% to ${rA.tieredRoyalties.base.high}%, while ${labelB} royalties range from ${rB.tieredRoyalties.base.low}% to ${rB.tieredRoyalties.base.high}%. High-tier escalation reaches ${rA.tieredRoyalties.highTier.high}% for ${labelA} and ${rB.tieredRoyalties.highTier.high}% for ${labelB}.`,
    },
    {
      question: `How do milestone structures differ between ${labelA} and ${labelB}?`,
      answer: `${labelA} deals allocate ${formatCurrency(rA.terms.devMilestones.median)} to development milestones vs ${formatCurrency(rB.terms.devMilestones.median)} for ${labelB}. Commercial milestones are ${formatCurrency(rA.terms.commMilestones.median)} (${labelA}) vs ${formatCurrency(rB.terms.commMilestones.median)} (${labelB}), reflecting different commercialization profiles and market expectations.`,
    },
  ];

  return {
    slug,
    title,
    metaDescription,
    h1,
    heroStats,
    contextParagraphs,
    calculatorPrefill: { therapeuticArea: ta, modality: modA, phase: 'phase2' },
    faqs,
    relatedPages: [
      { slug: `${taToSlug(ta)}-${modalityToSlug(modA)}-deal-benchmarks`, title: `${labelA} ${taLabel} Deals` },
      { slug: `${taToSlug(ta)}-${modalityToSlug(modB)}-deal-benchmarks`, title: `${labelB} ${taLabel} Deals` },
      { slug: `${taToSlug(ta)}-phase-2-deal-benchmarks`, title: `Phase 2 ${taLabel} Deals` },
    ],
    category: 'overview',
  };
}

// ── Type B: Phase vs Phase (within top TAs) ─────────────────────────────────

interface PhasePairDef {
  ta: string;
  phaseA: string;
  phaseB: string;
}

const PHASE_PAIRS: PhasePairDef[] = [
  // Oncology
  { ta: 'oncology', phaseA: 'preclinical', phaseB: 'phase1' },
  { ta: 'oncology', phaseA: 'phase1', phaseB: 'phase2' },
  { ta: 'oncology', phaseA: 'phase2', phaseB: 'phase3' },
  { ta: 'oncology', phaseA: 'phase3', phaseB: 'approved' },
  { ta: 'oncology', phaseA: 'preclinical', phaseB: 'phase2' },

  // Neurology
  { ta: 'neurology', phaseA: 'preclinical', phaseB: 'phase1' },
  { ta: 'neurology', phaseA: 'phase1', phaseB: 'phase2' },
  { ta: 'neurology', phaseA: 'phase2', phaseB: 'phase3' },
  { ta: 'neurology', phaseA: 'phase3', phaseB: 'approved' },
  { ta: 'neurology', phaseA: 'preclinical', phaseB: 'phase2' },

  // Immunology
  { ta: 'immunology', phaseA: 'preclinical', phaseB: 'phase1' },
  { ta: 'immunology', phaseA: 'phase1', phaseB: 'phase2' },
  { ta: 'immunology', phaseA: 'phase2', phaseB: 'phase3' },
  { ta: 'immunology', phaseA: 'phase3', phaseB: 'approved' },
  { ta: 'immunology', phaseA: 'preclinical', phaseB: 'phase2' },

  // Metabolic
  { ta: 'metabolic', phaseA: 'preclinical', phaseB: 'phase1' },
  { ta: 'metabolic', phaseA: 'phase1', phaseB: 'phase2' },
  { ta: 'metabolic', phaseA: 'phase2', phaseB: 'phase3' },
  { ta: 'metabolic', phaseA: 'phase3', phaseB: 'approved' },
  { ta: 'metabolic', phaseA: 'preclinical', phaseB: 'phase2' },

  // Rare Disease
  { ta: 'rareDisease', phaseA: 'preclinical', phaseB: 'phase1' },
  { ta: 'rareDisease', phaseA: 'phase1', phaseB: 'phase2' },
  { ta: 'rareDisease', phaseA: 'phase2', phaseB: 'phase3' },
  { ta: 'rareDisease', phaseA: 'phase3', phaseB: 'approved' },
  { ta: 'rareDisease', phaseA: 'preclinical', phaseB: 'phase2' },

  // Hematology
  { ta: 'hematology', phaseA: 'phase1', phaseB: 'phase2' },
  { ta: 'hematology', phaseA: 'phase2', phaseB: 'phase3' },

  // Dermatology
  { ta: 'dermatology', phaseA: 'phase1', phaseB: 'phase2' },
  { ta: 'dermatology', phaseA: 'phase2', phaseB: 'phase3' },

  // Gastroenterology
  { ta: 'gastroenterology', phaseA: 'phase1', phaseB: 'phase2' },
  { ta: 'gastroenterology', phaseA: 'phase2', phaseB: 'phase3' },

  // Cardiovascular
  { ta: 'cardiovascular', phaseA: 'phase1', phaseB: 'phase2' },
  { ta: 'cardiovascular', phaseA: 'phase2', phaseB: 'phase3' },

  // Infectious Disease
  { ta: 'infectiousDisease', phaseA: 'phase1', phaseB: 'phase2' },
  { ta: 'infectiousDisease', phaseA: 'phase2', phaseB: 'phase3' },

  // Ophthalmology
  { ta: 'ophthalmology', phaseA: 'phase1', phaseB: 'phase2' },
  { ta: 'ophthalmology', phaseA: 'phase2', phaseB: 'phase3' },
];

function getDefaultModForTA(ta: string): string {
  const map: Record<string, string> = {
    oncology: 'smallMolecule',
    neurology: 'smallMolecule',
    immunology: 'mab',
    metabolic: 'glp1Agonist',
    cardiovascular: 'smallMolecule',
    infectiousDisease: 'smallMolecule',
    ophthalmology: 'antiVegf',
    rareDisease: 'geneTherapy',
    hematology: 'smallMolecule',
    dermatology: 'smallMolecule',
    gastroenterology: 'mab',
  };
  return map[ta] || 'smallMolecule';
}

function buildPhaseVsPhasePage(def: PhasePairDef): BenchmarkPageData {
  const { ta, phaseA, phaseB } = def;
  const taLabel = TA_LABELS[ta] || ta;
  const labelA = PHASE_LABELS[phaseA] || phaseA;
  const labelB = PHASE_LABELS[phaseB] || phaseB;
  const defaultMod = getDefaultModForTA(ta);

  const rA = calculateDealTerms(makeComparisonInput(ta, defaultMod, phaseA));
  const rB = calculateDealTerms(makeComparisonInput(ta, defaultMod, phaseB));

  const premium = rA.terms.totalDealValue.median > 0
    ? Math.round(((rB.terms.totalDealValue.median - rA.terms.totalDealValue.median) / rA.terms.totalDealValue.median) * 100)
    : 0;

  const slug = `${taToSlug(ta)}-${phaseToSlug(phaseA)}-vs-${phaseToSlug(phaseB)}-deal-valuation`;
  const title = `${labelA} vs ${labelB} ${taLabel} Deal Valuation | 2026 Licensing Benchmarks`;
  const h1 = `${labelA} vs ${labelB} — ${taLabel} Deal Valuation Comparison`;
  const metaDescription = `Compare ${labelA} vs ${labelB} deal terms in ${taLabel.toLowerCase()}: ${labelB} commands a ${premium}% premium. Side-by-side upfronts, milestones, and royalty benchmarks.`;

  const heroStats = [
    {
      label: `${labelA} Median Upfront`,
      value: formatCurrency(rA.terms.upfront.median),
      subtext: `Total: ${formatCurrency(rA.terms.totalDealValue.median)}`,
    },
    {
      label: `${labelB} Median Upfront`,
      value: formatCurrency(rB.terms.upfront.median),
      subtext: `Total: ${formatCurrency(rB.terms.totalDealValue.median)}`,
    },
    {
      label: 'Stage Premium',
      value: `${premium}%`,
      subtext: `${labelB} premium over ${labelA}`,
    },
    {
      label: `${labelA} Royalties`,
      value: `${rA.tieredRoyalties.base.low}%-${rA.tieredRoyalties.base.high}%`,
      subtext: `vs ${labelB}: ${rB.tieredRoyalties.base.low}%-${rB.tieredRoyalties.base.high}%`,
    },
  ];

  const contextParagraphs = [
    `The ${labelA} to ${labelB} transition in ${taLabel.toLowerCase()} represents a significant value inflection point. ${labelB} deals carry a median total deal value of ${formatCurrency(rB.terms.totalDealValue.median)} compared to ${formatCurrency(rA.terms.totalDealValue.median)} at ${labelA}, a ${premium}% premium reflecting clinical de-risking. Upfront payments increase from ${formatCurrency(rA.terms.upfront.median)} to ${formatCurrency(rB.terms.upfront.median)}.`,
    `Deal structures shift as assets advance. ${labelA} deals allocate ${rA.dealRecommendation.upfrontPercent}% to upfront and ${rA.dealRecommendation.milestonePercent}% to milestones, while ${labelB} deals shift to ${rB.dealRecommendation.upfrontPercent}%/${rB.dealRecommendation.milestonePercent}%. Development milestones move from ${formatCurrency(rA.terms.devMilestones.median)} to ${formatCurrency(rB.terms.devMilestones.median)}, and royalty rates evolve from ${rA.tieredRoyalties.base.low}%-${rA.tieredRoyalties.base.high}% to ${rB.tieredRoyalties.base.low}%-${rB.tieredRoyalties.base.high}%.`,
  ];

  const faqs = [
    {
      question: `What is the deal value premium from ${labelA} to ${labelB} in ${taLabel.toLowerCase()}?`,
      answer: `${labelB} ${taLabel.toLowerCase()} deals command a ${premium}% premium over ${labelA} in total deal value (${formatCurrency(rB.terms.totalDealValue.median)} vs ${formatCurrency(rA.terms.totalDealValue.median)}). Upfronts increase from ${formatCurrency(rA.terms.upfront.median)} to ${formatCurrency(rB.terms.upfront.median)}, reflecting the de-risking value of clinical progression.`,
    },
    {
      question: `How do deal structures differ between ${labelA} and ${labelB} in ${taLabel.toLowerCase()}?`,
      answer: `${labelA} deals are more milestone-weighted (${rA.dealRecommendation.milestonePercent}% milestones), reflecting higher clinical risk. ${labelB} deals shift toward higher upfront allocations (${rB.dealRecommendation.upfrontPercent}% upfront) as clinical de-risking reduces the need for contingent milestone structures.`,
    },
    {
      question: `When is the optimal time to license a ${taLabel.toLowerCase()} asset?`,
      answer: `The optimal licensing window depends on strategic priorities. ${labelA} assets offer lower entry cost for licensees, while ${labelB} assets provide more certainty. The ${premium}% premium from ${labelA} to ${labelB} reflects the value created by clinical data, making the transition point critical for deal timing.`,
    },
  ];

  return {
    slug,
    title,
    metaDescription,
    h1,
    heroStats,
    contextParagraphs,
    calculatorPrefill: { therapeuticArea: ta, phase: phaseA },
    faqs,
    relatedPages: [
      { slug: `${taToSlug(ta)}-${phaseToSlug(phaseA)}-deal-benchmarks`, title: `${labelA} ${taLabel} Deals` },
      { slug: `${taToSlug(ta)}-${phaseToSlug(phaseB)}-deal-benchmarks`, title: `${labelB} ${taLabel} Deals` },
      { slug: `phase-2-deal-benchmarks`, title: 'Phase 2 Deal Benchmarks' },
    ],
    category: 'overview',
  };
}

// ── Type C: TA vs TA ────────────────────────────────────────────────────────

interface TAPairDef {
  taA: string;
  taB: string;
}

const TA_PAIRS: TAPairDef[] = [
  { taA: 'oncology', taB: 'neurology' },
  { taA: 'oncology', taB: 'immunology' },
  { taA: 'oncology', taB: 'metabolic' },
  { taA: 'oncology', taB: 'hematology' },
  { taA: 'oncology', taB: 'rareDisease' },
  { taA: 'oncology', taB: 'cardiovascular' },
  { taA: 'neurology', taB: 'immunology' },
  { taA: 'neurology', taB: 'metabolic' },
  { taA: 'neurology', taB: 'rareDisease' },
  { taA: 'neurology', taB: 'dermatology' },
  { taA: 'immunology', taB: 'dermatology' },
  { taA: 'immunology', taB: 'gastroenterology' },
  { taA: 'immunology', taB: 'metabolic' },
  { taA: 'immunology', taB: 'rareDisease' },
  { taA: 'metabolic', taB: 'cardiovascular' },
  { taA: 'metabolic', taB: 'rareDisease' },
  { taA: 'rareDisease', taB: 'hematology' },
  { taA: 'rareDisease', taB: 'ophthalmology' },
  { taA: 'hematology', taB: 'immunology' },
  { taA: 'dermatology', taB: 'gastroenterology' },
  { taA: 'cardiovascular', taB: 'metabolic' },
  { taA: 'infectiousDisease', taB: 'oncology' },
  { taA: 'ophthalmology', taB: 'rareDisease' },
  { taA: 'hematology', taB: 'oncology' },
  { taA: 'gastroenterology', taB: 'immunology' },
  { taA: 'dermatology', taB: 'immunology' },
  { taA: 'neurology', taB: 'cardiovascular' },
  { taA: 'metabolic', taB: 'gastroenterology' },
  { taA: 'oncology', taB: 'infectiousDisease' },
  { taA: 'oncology', taB: 'dermatology' },
  { taA: 'oncology', taB: 'gastroenterology' },
  { taA: 'oncology', taB: 'ophthalmology' },
  { taA: 'neurology', taB: 'hematology' },
  { taA: 'immunology', taB: 'ophthalmology' },
  { taA: 'immunology', taB: 'infectiousDisease' },
  { taA: 'cardiovascular', taB: 'infectiousDisease' },
  { taA: 'metabolic', taB: 'ophthalmology' },
  { taA: 'rareDisease', taB: 'dermatology' },
  { taA: 'hematology', taB: 'dermatology' },
  { taA: 'gastroenterology', taB: 'metabolic' },
  { taA: 'cardiovascular', taB: 'hematology' },
  { taA: 'immunology', taB: 'cardiovascular' },
  { taA: 'rareDisease', taB: 'cardiovascular' },
  { taA: 'infectiousDisease', taB: 'neurology' },
  { taA: 'rareDisease', taB: 'gastroenterology' },
  { taA: 'ophthalmology', taB: 'neurology' },
  { taA: 'dermatology', taB: 'cardiovascular' },
  { taA: 'infectiousDisease', taB: 'metabolic' },
  { taA: 'hematology', taB: 'gastroenterology' },
  { taA: 'ophthalmology', taB: 'dermatology' },
];

function buildTAVsTAPage(def: TAPairDef): BenchmarkPageData {
  const { taA, taB } = def;
  const labelA = TA_LABELS[taA] || taA;
  const labelB = TA_LABELS[taB] || taB;
  const modA = getDefaultModForTA(taA);
  const modB = getDefaultModForTA(taB);

  const rA = calculateDealTerms(makeComparisonInput(taA, modA, 'phase2'));
  const rB = calculateDealTerms(makeComparisonInput(taB, modB, 'phase2'));

  const slug = `${taToSlug(taA)}-vs-${taToSlug(taB)}-deal-benchmarks`;
  const title = `${labelA} vs ${labelB} Deal Benchmarks | 2026 Licensing Comparison`;
  const h1 = `${labelA} vs ${labelB} — Deal Terms Comparison`;
  const metaDescription = `Compare ${labelA.toLowerCase()} vs ${labelB.toLowerCase()} licensing deal terms: ${labelA} median upfront ${formatCurrency(rA.terms.upfront.median)} vs ${labelB} ${formatCurrency(rB.terms.upfront.median)}. Side-by-side TA benchmarks from 2,500+ deals.`;

  const heroStats = [
    {
      label: `${labelA} Median Upfront`,
      value: formatCurrency(rA.terms.upfront.median),
      subtext: `Total: ${formatCurrency(rA.terms.totalDealValue.median)}`,
    },
    {
      label: `${labelB} Median Upfront`,
      value: formatCurrency(rB.terms.upfront.median),
      subtext: `Total: ${formatCurrency(rB.terms.totalDealValue.median)}`,
    },
    {
      label: `${labelA} Royalties`,
      value: `${rA.tieredRoyalties.base.low}%-${rA.tieredRoyalties.base.high}%`,
      subtext: `Tiered to ${rA.tieredRoyalties.highTier.high}%`,
    },
    {
      label: `${labelB} Royalties`,
      value: `${rB.tieredRoyalties.base.low}%-${rB.tieredRoyalties.base.high}%`,
      subtext: `Tiered to ${rB.tieredRoyalties.highTier.high}%`,
    },
  ];

  const contextParagraphs = [
    `${labelA} and ${labelB} represent distinct licensing landscapes with different risk-reward dynamics. Phase 2 ${labelA.toLowerCase()} deals carry a median total deal value of ${formatCurrency(rA.terms.totalDealValue.median)} with ${formatCurrency(rA.terms.upfront.median)} upfront, compared to ${formatCurrency(rB.terms.totalDealValue.median)} total value and ${formatCurrency(rB.terms.upfront.median)} upfront for ${labelB.toLowerCase()}. The differences reflect divergent clinical development timelines, regulatory pathways, and addressable market sizes.`,
    `Deal structures differ across therapeutic areas. ${labelA} deals allocate ${rA.dealRecommendation.upfrontPercent}% to upfront and ${rA.dealRecommendation.milestonePercent}% to milestones, while ${labelB} deals split ${rB.dealRecommendation.upfrontPercent}%/${rB.dealRecommendation.milestonePercent}%. Development milestones are ${formatCurrency(rA.terms.devMilestones.median)} for ${labelA.toLowerCase()} versus ${formatCurrency(rB.terms.devMilestones.median)} for ${labelB.toLowerCase()}, reflecting the different clinical trial designs and approval standards in each area.`,
  ];

  const faqs = [
    {
      question: `How do ${labelA.toLowerCase()} and ${labelB.toLowerCase()} deal terms compare?`,
      answer: `${labelA} Phase 2 deals average ${formatCurrency(rA.terms.totalDealValue.median)} total value (${formatCurrency(rA.terms.upfront.median)} upfront), while ${labelB} deals average ${formatCurrency(rB.terms.totalDealValue.median)} (${formatCurrency(rB.terms.upfront.median)} upfront). The differences are driven by addressable market size, clinical development complexity, and regulatory pathway characteristics.`,
    },
    {
      question: `Which therapeutic area commands higher royalty rates: ${labelA} or ${labelB}?`,
      answer: `${labelA} base royalties range from ${rA.tieredRoyalties.base.low}% to ${rA.tieredRoyalties.base.high}%, while ${labelB} royalties range from ${rB.tieredRoyalties.base.low}% to ${rB.tieredRoyalties.base.high}%. Royalty rates reflect pricing power, competitive dynamics, and patent protection characteristics specific to each therapeutic area.`,
    },
    {
      question: `What drives the deal value differences between ${labelA.toLowerCase()} and ${labelB.toLowerCase()}?`,
      answer: `Key factors include addressable patient population size, clinical trial costs and timelines, regulatory pathway complexity, pricing and reimbursement dynamics, and competitive landscape density. ${labelA} and ${labelB} each have unique value drivers that shape deal economics.`,
    },
  ];

  return {
    slug,
    title,
    metaDescription,
    h1,
    heroStats,
    contextParagraphs,
    calculatorPrefill: { therapeuticArea: taA, phase: 'phase2' },
    faqs,
    relatedPages: [
      { slug: `${taToSlug(taA)}-deal-benchmarks`, title: `${labelA} Deal Overview` },
      { slug: `${taToSlug(taB)}-deal-benchmarks`, title: `${labelB} Deal Overview` },
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
    ],
    category: 'overview',
  };
}

// ── Deduplication helper ────────────────────────────────────────────────────

function deduplicateBySlug(pages: BenchmarkPageData[]): BenchmarkPageData[] {
  const seen = new Set<string>();
  return pages.filter((p) => {
    if (seen.has(p.slug)) return false;
    seen.add(p.slug);
    return true;
  });
}

// ── Main export ─────────────────────────────────────────────────────────────

let _cache: BenchmarkPageData[] | null = null;

export function getComparisonBenchmarkPages(): BenchmarkPageData[] {
  if (_cache) return _cache;

  const pages: BenchmarkPageData[] = [];

  // Type A: Modality vs Modality (within same TA)
  for (const def of MODALITY_PAIRS) {
    pages.push(buildModalityVsModalityPage(def));
  }

  // Type B: Phase vs Phase (within top TAs)
  for (const def of PHASE_PAIRS) {
    pages.push(buildPhaseVsPhasePage(def));
  }

  // Type C: TA vs TA
  for (const def of TA_PAIRS) {
    pages.push(buildTAVsTAPage(def));
  }

  _cache = deduplicateBySlug(pages);
  return _cache;
}
