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

// ── TA × Modality mapping ────────────────────────────────────────────────────
// Only clinically relevant combinations are included.

const TA_MODALITY_MAP: Record<string, string[]> = {
  oncology: [
    'smallMolecule', 'mab', 'adc', 'bispecific', 'carT_heme', 'carT_solid',
    'geneTherapy', 'radiopharmaceutical', 'protac', 'molecularGlue',
    'therapeuticVaccine', 'oncolyticVirus', 'tCellEngager', 'peptide', 'rnai',
  ],
  neurology: [
    'smallMolecule', 'mab', 'geneTherapy', 'aso', 'bbbPlatform', 'psychedelic',
    'ionChannel', 'tauTargeting', 'stemCell', 'peptide', 'rnai',
  ],
  immunology: [
    'smallMolecule', 'mab', 'bispecific', 'carT_autoimmune', 'inVivoCarT',
    'carTreg', 'fcrnAntagonist', 'complementInhibitor', 'jakInhibitor',
    's1pModulator', 'oralIntegrin', 'dualAntagonist', 'tl1aInhibitor', 'peptide',
  ],
  metabolic: [
    'smallMolecule', 'glp1Agonist', 'dualIncretin', 'tripleIncretin',
    'sglt2Inhibitor', 'amylinAnalog', 'oralPeptide', 'antiActivin',
    'microbiomeBased', 'peptide', 'mab', 'geneTherapy',
  ],
  cardiovascular: [
    'smallMolecule', 'mab', 'myosinInhibitor', 'anticoagulantNovel',
    'rnaCardio', 'pcsk9Targeting', 'peptide', 'geneTherapy', 'rnai',
  ],
  infectiousDisease: [
    'smallMolecule', 'mab', 'antiviral', 'antibioticNovel',
    'vaccinePreventive', 'phageTherapy', 'mrna', 'peptide',
  ],
  ophthalmology: [
    'smallMolecule', 'mab', 'antiVegf', 'geneTherapyOcular',
    'intravitreal', 'topicalOphthalmic', 'rnai',
  ],
  rareDisease: [
    'geneTherapy', 'smallMolecule', 'mab', 'aso', 'rnai',
    'cellTherapy', 'peptide', 'oligonucleotide',
  ],
  hematology: [
    'carT_heme', 'bispecific', 'smallMolecule', 'mab', 'geneTherapy',
    'cellTherapy', 'rnai', 'aso',
  ],
  dermatology: [
    'smallMolecule', 'mab', 'jakInhibitor', 'peptide', 'topicalOphthalmic',
  ],
  gastroenterology: [
    'smallMolecule', 'mab', 'oralIntegrin', 'jakInhibitor', 's1pModulator',
    'tl1aInhibitor', 'peptide', 'microbiomeBased',
  ],
  womensHealth: [
    'smallMolecule', 'mab', 'peptide', 'geneTherapy',
  ],
};

// ── Human-readable labels ────────────────────────────────────────────────────

const MODALITY_LABELS: Record<string, string> = {
  smallMolecule: 'Small Molecule',
  mab: 'Monoclonal Antibody',
  adc: 'ADC (Antibody-Drug Conjugate)',
  bispecific: 'Bispecific Antibody',
  carT_heme: 'CAR-T (Hematologic)',
  carT_solid: 'CAR-T (Solid Tumor)',
  carT_autoimmune: 'CAR-T (Autoimmune)',
  inVivoCarT: 'In Vivo CAR-T',
  carTreg: 'CAR-Treg',
  geneTherapy: 'Gene Therapy',
  radiopharmaceutical: 'Radiopharmaceutical',
  protac: 'PROTAC Degrader',
  molecularGlue: 'Molecular Glue',
  therapeuticVaccine: 'Therapeutic Vaccine',
  oncolyticVirus: 'Oncolytic Virus',
  tCellEngager: 'T-Cell Engager',
  peptide: 'Peptide Therapeutic',
  rnai: 'RNAi / siRNA',
  aso: 'Antisense Oligonucleotide (ASO)',
  bbbPlatform: 'BBB Platform',
  psychedelic: 'Psychedelic-Derived',
  ionChannel: 'Ion Channel Modulator',
  tauTargeting: 'Tau-Targeting',
  stemCell: 'Stem Cell Therapy',
  cellTherapy: 'Cell Therapy',
  oligonucleotide: 'Oligonucleotide',
  fcrnAntagonist: 'FcRn Antagonist',
  complementInhibitor: 'Complement Inhibitor',
  jakInhibitor: 'JAK Inhibitor',
  s1pModulator: 'S1P Modulator',
  oralIntegrin: 'Oral Integrin',
  dualAntagonist: 'Dual Antagonist',
  tl1aInhibitor: 'TL1A Inhibitor',
  glp1Agonist: 'GLP-1 Agonist',
  dualIncretin: 'Dual Incretin',
  tripleIncretin: 'Triple Incretin',
  sglt2Inhibitor: 'SGLT2 Inhibitor',
  amylinAnalog: 'Amylin Analog',
  oralPeptide: 'Oral Peptide',
  antiActivin: 'Anti-Activin',
  microbiomeBased: 'Microbiome-Based',
  myosinInhibitor: 'Myosin Inhibitor',
  anticoagulantNovel: 'Novel Anticoagulant',
  rnaCardio: 'RNA Cardiovascular',
  pcsk9Targeting: 'PCSK9-Targeting',
  antiviral: 'Antiviral',
  antibioticNovel: 'Novel Antibiotic',
  vaccinePreventive: 'Preventive Vaccine',
  phageTherapy: 'Phage Therapy',
  mrna: 'mRNA Therapeutic',
  antiVegf: 'Anti-VEGF',
  geneTherapyOcular: 'Gene Therapy (Ocular)',
  intravitreal: 'Intravitreal',
  topicalOphthalmic: 'Topical Ophthalmic',
};

const TA_LABELS: Record<string, string> = {
  oncology: 'Oncology',
  neurology: 'Neurology',
  immunology: 'Immunology & Autoimmune',
  metabolic: 'Metabolic & Obesity',
  cardiovascular: 'Cardiovascular',
  infectiousDisease: 'Infectious Disease',
  ophthalmology: 'Ophthalmology',
  rareDisease: 'Rare Disease',
  hematology: 'Hematology',
  dermatology: 'Dermatology',
  gastroenterology: 'Gastroenterology',
  womensHealth: "Women's Health",
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

// ── Default indication per TA ────────────────────────────────────────────────
// These are the most representative/largest-market indications for each TA.

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
  womensHealth: 'endometriosis',
};

// ── Context paragraph templates per TA ───────────────────────────────────────
// Provides 2-3 TA-specific landscape sentences to interpolate modality data into.

const TA_LANDSCAPE: Record<string, { competition: string; trend: string }> = {
  oncology: {
    competition: 'high competitive intensity with numerous active programs and a rapidly evolving standard of care',
    trend: 'ADCs, bispecifics, and radiopharmaceuticals continue to drive premium valuations across solid and hematologic tumors',
  },
  neurology: {
    competition: 'moderate competitive intensity with significant unmet need in neurodegenerative indications',
    trend: 'disease-modifying therapies and novel CNS delivery platforms are attracting increasing licensee interest following breakthroughs in amyloid-targeted approaches',
  },
  immunology: {
    competition: 'high competitive intensity, particularly in inflammatory bowel disease and autoimmune conditions',
    trend: 'CAR-T for autoimmune diseases, TL1A inhibitors, and next-generation targeted therapies are reshaping the licensing landscape',
  },
  metabolic: {
    competition: 'extremely high competitive intensity driven by the GLP-1 revolution and massive obesity market opportunity',
    trend: 'oral formulations, dual/triple incretins, and muscle-sparing approaches command unprecedented deal valuations',
  },
  cardiovascular: {
    competition: 'moderate competitive intensity with renewed interest in novel mechanisms and genetic targets',
    trend: 'RNA-based therapies, PCSK9 approaches, and novel anticoagulants are driving a resurgence in cardiovascular deal activity',
  },
  infectiousDisease: {
    competition: 'variable competitive intensity across pathogen types, with high activity in antiviral and AMR spaces',
    trend: 'mRNA platforms, novel antibiotics addressing resistance, and pandemic preparedness assets sustain strong licensee demand',
  },
  ophthalmology: {
    competition: 'moderate competitive intensity concentrated in retinal disease and dry eye',
    trend: 'gene therapies for inherited retinal diseases, extended-duration intravitreal agents, and topical biologics are expanding the opportunity set',
  },
  rareDisease: {
    competition: 'limited competitive intensity per indication but growing platform competition',
    trend: 'gene therapies and oligonucleotide-based approaches are transforming treatment paradigms, with orphan designations enabling premium pricing and accelerated regulatory paths',
  },
  hematology: {
    competition: 'high competitive intensity in lymphoma and myeloma with established treatment paradigms',
    trend: 'bispecific antibodies and next-generation cell therapies are displacing traditional chemotherapy combinations',
  },
  dermatology: {
    competition: 'growing competitive intensity as biologics reshape treatment of moderate-to-severe skin diseases',
    trend: 'JAK inhibitors, IL-targeted biologics, and novel topical approaches are expanding beyond psoriasis into atopic dermatitis and other indications',
  },
  gastroenterology: {
    competition: 'moderate-to-high competitive intensity concentrated in IBD and eosinophilic GI disorders',
    trend: 'TL1A inhibitors, gut-selective integrins, and S1P modulators are broadening the therapeutic toolkit beyond TNF and integrin blockade',
  },
  womensHealth: {
    competition: 'moderate competitive intensity with significant historical underinvestment creating unmet need',
    trend: 'novel hormonal approaches, non-hormonal alternatives for menopause, and precision medicine in endometriosis are driving renewed deal-making activity',
  },
};

// ── Slug-safe modality keys ──────────────────────────────────────────────────
// Convert camelCase modality to URL-safe slug segments.

function modalityToSlug(mod: string): string {
  const overrides: Record<string, string> = {
    smallMolecule: 'small-molecule',
    mab: 'monoclonal-antibody',
    adc: 'adc',
    bispecific: 'bispecific-antibody',
    carT_heme: 'car-t-heme',
    carT_solid: 'car-t-solid-tumor',
    carT_autoimmune: 'car-t-autoimmune',
    inVivoCarT: 'in-vivo-car-t',
    carTreg: 'car-treg',
    geneTherapy: 'gene-therapy',
    radiopharmaceutical: 'radiopharmaceutical',
    protac: 'protac',
    molecularGlue: 'molecular-glue',
    therapeuticVaccine: 'therapeutic-vaccine',
    oncolyticVirus: 'oncolytic-virus',
    tCellEngager: 't-cell-engager',
    peptide: 'peptide',
    rnai: 'rnai-sirna',
    aso: 'aso',
    bbbPlatform: 'bbb-platform',
    psychedelic: 'psychedelic',
    ionChannel: 'ion-channel',
    tauTargeting: 'tau-targeting',
    stemCell: 'stem-cell',
    cellTherapy: 'cell-therapy',
    oligonucleotide: 'oligonucleotide',
    fcrnAntagonist: 'fcrn-antagonist',
    complementInhibitor: 'complement-inhibitor',
    jakInhibitor: 'jak-inhibitor',
    s1pModulator: 's1p-modulator',
    oralIntegrin: 'oral-integrin',
    dualAntagonist: 'dual-antagonist',
    tl1aInhibitor: 'tl1a-inhibitor',
    glp1Agonist: 'glp1-agonist',
    dualIncretin: 'dual-incretin',
    tripleIncretin: 'triple-incretin',
    sglt2Inhibitor: 'sglt2-inhibitor',
    amylinAnalog: 'amylin-analog',
    oralPeptide: 'oral-peptide',
    antiActivin: 'anti-activin',
    microbiomeBased: 'microbiome',
    myosinInhibitor: 'myosin-inhibitor',
    anticoagulantNovel: 'novel-anticoagulant',
    rnaCardio: 'rna-cardiovascular',
    pcsk9Targeting: 'pcsk9',
    antiviral: 'antiviral',
    antibioticNovel: 'novel-antibiotic',
    vaccinePreventive: 'preventive-vaccine',
    phageTherapy: 'phage-therapy',
    mrna: 'mrna',
    antiVegf: 'anti-vegf',
    geneTherapyOcular: 'gene-therapy-ocular',
    intravitreal: 'intravitreal',
    topicalOphthalmic: 'topical-ophthalmic',
  };
  return overrides[mod] || mod.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
}

function taToSlug(ta: string): string {
  const overrides: Record<string, string> = {
    oncology: 'oncology',
    neurology: 'neurology',
    immunology: 'immunology',
    metabolic: 'metabolic',
    cardiovascular: 'cardiovascular',
    infectiousDisease: 'infectious-disease',
    ophthalmology: 'ophthalmology',
    rareDisease: 'rare-disease',
    hematology: 'hematology',
    dermatology: 'dermatology',
    gastroenterology: 'gastroenterology',
    womensHealth: 'womens-health',
  };
  return overrides[ta] || ta.replace(/([A-Z])/g, '-$1').toLowerCase();
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

// ── Input factory ────────────────────────────────────────────────────────────

function makeGeneratedInput(ta: string, mod: string, phase: string): CalculationInput {
  const therapeuticArea = ta as TherapeuticArea;
  const isNeuro = ta === 'neurology';
  const isMetabolic = ta === 'metabolic';
  const isImmunology = ta === 'immunology';
  const isCardio = ta === 'cardiovascular';
  const isInfectious = ta === 'infectiousDisease';
  const isOphtho = ta === 'ophthalmology';
  const isWomens = ta === 'womensHealth';
  const isRare = ta === 'rareDisease';
  const isHeme = ta === 'hematology';
  const isDerm = ta === 'dermatology';
  const isGI = ta === 'gastroenterology';

  const base: CalculationInput = {
    therapeuticArea,
    phase: phase as Phase,
    modality: mod as Modality,
    indication: DEFAULT_INDICATION[ta] as Indication,
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

  // TA-specific optional fields
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
  if (isWomens) {
    base.whTargetPopulation = 'reproductiveAge';
    base.whUnmetNeed = 'inadequateOptions';
    base.whRegulatory = 'standardPathway';
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
    base.topicalVsSystemic = mod === 'topicalOphthalmic' ? 'topical_only' : 'systemic_only';
  }
  if (isGI) {
    base.giSegment = 'colonic';
    base.biologicExperience = 'biologic_naive';
    base.endoscopicEndpoint = 'endoscopic_remission';
  }

  return base;
}

// ── Hero stats builder ───────────────────────────────────────────────────────

function buildHeroStats(result: ReturnType<typeof calculateDealTerms>) {
  return [
    {
      label: 'Median Upfront',
      value: formatCurrency(result.terms.upfront.median),
      subtext: `Range: ${formatCurrency(result.terms.upfront.low)} - ${formatCurrency(result.terms.upfront.high)}`,
    },
    {
      label: 'Total Deal Value',
      value: formatCurrency(result.terms.totalDealValue.median),
      subtext: `Range: ${formatCurrency(result.terms.totalDealValue.low)} - ${formatCurrency(result.terms.totalDealValue.high)}`,
    },
    {
      label: 'Royalty Rate',
      value: `${result.tieredRoyalties.base.low}% - ${result.tieredRoyalties.base.high}%`,
      subtext: `Tiered up to ${result.tieredRoyalties.highTier.high}%`,
    },
    {
      label: 'Dev Milestones',
      value: formatCurrency(result.terms.devMilestones.median),
      subtext: `Range: ${formatCurrency(result.terms.devMilestones.low)} - ${formatCurrency(result.terms.devMilestones.high)}`,
    },
  ];
}

// ── Related pages picker ─────────────────────────────────────────────────────
// Picks 3-4 related pages from the same TA or the same modality.

function pickRelatedPages(
  ta: string,
  mod: string,
  allSlugs: { slug: string; ta: string; mod: string }[]
): { slug: string; title: string }[] {
  const related: { slug: string; title: string }[] = [];

  // Same TA, different modality
  const sameTA = allSlugs.filter((s) => s.ta === ta && s.mod !== mod);
  for (let i = 0; i < Math.min(2, sameTA.length); i++) {
    const s = sameTA[i];
    related.push({
      slug: s.slug,
      title: `${MODALITY_LABELS[s.mod] || s.mod} in ${TA_LABELS[s.ta] || s.ta}`,
    });
  }

  // Same modality, different TA
  const sameMod = allSlugs.filter((s) => s.mod === mod && s.ta !== ta);
  for (let i = 0; i < Math.min(2, sameMod.length); i++) {
    const s = sameMod[i];
    related.push({
      slug: s.slug,
      title: `${MODALITY_LABELS[s.mod] || s.mod} in ${TA_LABELS[s.ta] || s.ta}`,
    });
  }

  return related.slice(0, 4);
}

// ── Page generators ──────────────────────────────────────────────────────────

function generateTAModalityPage(
  ta: string,
  mod: string,
  allSlugs: { slug: string; ta: string; mod: string }[]
): BenchmarkPageData {
  const slug = `${taToSlug(ta)}-${modalityToSlug(mod)}-deal-benchmarks`;
  const taLabel = TA_LABELS[ta] || ta;
  const modLabel = MODALITY_LABELS[mod] || mod;
  const landscape = TA_LANDSCAPE[ta] || { competition: 'competitive market dynamics', trend: 'evolving treatment paradigms' };

  const input = makeGeneratedInput(ta, mod, 'phase2');
  const r = calculateDealTerms(input);

  const title = `${modLabel} ${taLabel} Deal Benchmarks 2026 | Licensing Terms & Valuation`;
  const h1 = `${modLabel} Deal Benchmarks in ${taLabel}`;
  const metaDescription = `Comprehensive ${modLabel.toLowerCase()} licensing and acquisition deal benchmarks for ${taLabel.toLowerCase()}. Median upfront ${formatCurrency(r.terms.upfront.median)}, total deal value ${formatCurrency(r.terms.totalDealValue.median)}, and royalty rates from 2,500+ verified deals.`;

  const contextParagraphs = [
    `${modLabel} therapies in ${taLabel.toLowerCase()} have seen significant M&A and licensing activity in recent years. Based on analysis of 2,500+ verified transactions, the median upfront payment for a Phase 2 ${modLabel.toLowerCase()} asset in ${taLabel.toLowerCase()} is ${formatCurrency(r.terms.upfront.median)}, with total deal values reaching ${formatCurrency(r.terms.totalDealValue.median)}. Development milestones average ${formatCurrency(r.terms.devMilestones.median)}, while regulatory milestones contribute ${formatCurrency(r.terms.regMilestones.median)}.`,
    `The ${taLabel.toLowerCase()} ${modLabel.toLowerCase()} landscape is characterized by ${landscape.competition}. ${landscape.trend.charAt(0).toUpperCase() + landscape.trend.slice(1)}. The recommended deal structure allocates approximately ${r.dealRecommendation.upfrontPercent}% to upfront payments and ${r.dealRecommendation.milestonePercent}% to milestones, reflecting the risk-reward profile at the Phase 2 stage.`,
    `Royalty rates for ${modLabel.toLowerCase()} ${taLabel.toLowerCase()} deals range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}% at the base tier, with tiered escalation reaching ${r.tieredRoyalties.highTier.low}%-${r.tieredRoyalties.highTier.high}% on blockbuster sales. Commercial milestones averaging ${formatCurrency(r.terms.commMilestones.median)} further reward successful market penetration.`,
  ];

  const faqs = [
    {
      question: `What is the typical upfront for a ${modLabel.toLowerCase()} ${taLabel.toLowerCase()} licensing deal?`,
      answer: `Based on our analysis, Phase 2 ${modLabel.toLowerCase()} licensing deals in ${taLabel.toLowerCase()} average ${formatCurrency(r.terms.upfront.median)} in upfront payments, with a range of ${formatCurrency(r.terms.upfront.low)} to ${formatCurrency(r.terms.upfront.high)} depending on data quality, competitive positioning, and territorial scope.`,
    },
    {
      question: `What is the total deal value for ${modLabel.toLowerCase()} ${taLabel.toLowerCase()} transactions?`,
      answer: `The median total deal value for Phase 2 ${modLabel.toLowerCase()} assets in ${taLabel.toLowerCase()} is ${formatCurrency(r.terms.totalDealValue.median)}, ranging from ${formatCurrency(r.terms.totalDealValue.low)} to ${formatCurrency(r.terms.totalDealValue.high)}. This includes development milestones (${formatCurrency(r.terms.devMilestones.median)}), regulatory milestones (${formatCurrency(r.terms.regMilestones.median)}), and commercial milestones (${formatCurrency(r.terms.commMilestones.median)}).`,
    },
    {
      question: `What royalty rates are standard for ${modLabel.toLowerCase()} deals in ${taLabel.toLowerCase()}?`,
      answer: `Base royalty rates for ${modLabel.toLowerCase()} ${taLabel.toLowerCase()} transactions range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}%, with tiered escalations reaching ${r.tieredRoyalties.highTier.low}%-${r.tieredRoyalties.highTier.high}% on peak sales. Rates are influenced by mechanism differentiation, competitive landscape, and territorial scope.`,
    },
    {
      question: `How are milestones structured in ${modLabel.toLowerCase()} ${taLabel.toLowerCase()} deals?`,
      answer: `${modLabel} ${taLabel.toLowerCase()} deals allocate approximately ${r.dealRecommendation.milestonePercent}% of total deal value to milestones. Development milestones (${formatCurrency(r.terms.devMilestones.median)}) make up the largest share, followed by commercial milestones (${formatCurrency(r.terms.commMilestones.median)}) and regulatory milestones (${formatCurrency(r.terms.regMilestones.median)}).`,
    },
  ];

  return {
    slug,
    title,
    metaDescription,
    h1,
    heroStats: buildHeroStats(r),
    contextParagraphs,
    calculatorPrefill: { therapeuticArea: ta, modality: mod },
    faqs,
    relatedPages: pickRelatedPages(ta, mod, allSlugs),
    category: 'modality',
  };
}

function generateTAPhasePage(
  ta: string,
  phase: string,
  allPhaseSlugs: { slug: string; ta: string; phase: string }[]
): BenchmarkPageData {
  const slug = `${taToSlug(ta)}-${phaseToSlug(phase)}-deal-benchmarks`;
  const taLabel = TA_LABELS[ta] || ta;
  const phaseLabel = PHASE_LABELS[phase] || phase;
  const landscape = TA_LANDSCAPE[ta] || { competition: 'competitive market dynamics', trend: 'evolving treatment paradigms' };

  // Use default modality for the TA
  const defaultMod = (TA_MODALITY_MAP[ta] || ['smallMolecule'])[0];
  const input = makeGeneratedInput(ta, defaultMod, phase);
  const r = calculateDealTerms(input);

  const title = `${phaseLabel} ${taLabel} Deal Benchmarks 2026 | Stage-Specific Licensing Terms`;
  const h1 = `${phaseLabel} ${taLabel} Deal Benchmarks`;
  const metaDescription = `${phaseLabel} ${taLabel.toLowerCase()} licensing deal benchmarks: median upfront ${formatCurrency(r.terms.upfront.median)}, total deal value ${formatCurrency(r.terms.totalDealValue.median)}, and royalty rates. Data from 2,500+ verified transactions.`;

  const isEarly = ['preclinical', 'phase1', 'phase1_2'].includes(phase);
  const isLate = ['phase3', 'approved'].includes(phase);
  const stageCharacteristic = isEarly
    ? 'heavily milestone-weighted, reflecting the significant clinical risk ahead'
    : isLate
      ? 'shifted toward higher upfront allocations, reflecting reduced regulatory risk and near-term commercial potential'
      : 'balanced between upfront and milestone payments, reflecting the proof-of-concept inflection';

  const contextParagraphs = [
    `${phaseLabel} ${taLabel.toLowerCase()} licensing deals carry a median total deal value of ${formatCurrency(r.terms.totalDealValue.median)}, with upfront payments ranging from ${formatCurrency(r.terms.upfront.low)} to ${formatCurrency(r.terms.upfront.high)}. At this stage, deal structures are ${stageCharacteristic}. The recommended split allocates ${r.dealRecommendation.upfrontPercent}% to upfront and ${r.dealRecommendation.milestonePercent}% to milestones.`,
    `The ${taLabel.toLowerCase()} landscape at the ${phaseLabel.toLowerCase()} stage is characterized by ${landscape.competition}. Development milestones average ${formatCurrency(r.terms.devMilestones.median)}, regulatory milestones contribute ${formatCurrency(r.terms.regMilestones.median)}, and commercial milestones reach ${formatCurrency(r.terms.commMilestones.median)}. ${landscape.trend.charAt(0).toUpperCase() + landscape.trend.slice(1)}.`,
    `Royalty rates for ${phaseLabel.toLowerCase()} ${taLabel.toLowerCase()} deals range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}% at the base tier, with high-tier escalation to ${r.tieredRoyalties.highTier.high}%. ${isEarly ? 'Earlier-stage royalties are at the lower end of industry ranges, reflecting higher clinical risk.' : isLate ? 'The reduced risk profile at this stage justifies higher fixed royalty commitments.' : 'Mid-stage royalties reflect the balance of de-risking achieved and remaining development investment.'}`,
  ];

  const faqs = [
    {
      question: `What is the average upfront payment for ${phaseLabel.toLowerCase()} ${taLabel.toLowerCase()} deals?`,
      answer: `${phaseLabel} ${taLabel.toLowerCase()} deals average ${formatCurrency(r.terms.upfront.median)} in upfront payments, ranging from ${formatCurrency(r.terms.upfront.low)} to ${formatCurrency(r.terms.upfront.high)}. The upfront allocation of ${r.dealRecommendation.upfrontPercent}% of total deal value reflects the clinical stage risk profile.`,
    },
    {
      question: `How are ${phaseLabel.toLowerCase()} ${taLabel.toLowerCase()} deal milestones structured?`,
      answer: `Milestones account for approximately ${r.dealRecommendation.milestonePercent}% of total deal value. Development milestones (${formatCurrency(r.terms.devMilestones.median)}) represent the largest component, followed by commercial milestones (${formatCurrency(r.terms.commMilestones.median)}) and regulatory milestones (${formatCurrency(r.terms.regMilestones.median)}).`,
    },
    {
      question: `What royalty rates are typical for ${phaseLabel.toLowerCase()} ${taLabel.toLowerCase()} licensing?`,
      answer: `Base royalty rates range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}%, with tiered escalation to ${r.tieredRoyalties.highTier.low}%-${r.tieredRoyalties.highTier.high}% on peak sales. Rates are influenced by modality, competitive positioning, and territorial scope.`,
    },
  ];

  // Related: same TA different phase + same phase different TA
  const related: { slug: string; title: string }[] = [];
  const sameTA = allPhaseSlugs.filter((s) => s.ta === ta && s.phase !== phase);
  for (let i = 0; i < Math.min(2, sameTA.length); i++) {
    const s = sameTA[i];
    related.push({
      slug: s.slug,
      title: `${PHASE_LABELS[s.phase] || s.phase} ${TA_LABELS[s.ta] || s.ta} Deals`,
    });
  }
  const samePhase = allPhaseSlugs.filter((s) => s.phase === phase && s.ta !== ta);
  for (let i = 0; i < Math.min(2, samePhase.length); i++) {
    const s = samePhase[i];
    related.push({
      slug: s.slug,
      title: `${PHASE_LABELS[s.phase] || s.phase} ${TA_LABELS[s.ta] || s.ta} Deals`,
    });
  }

  return {
    slug,
    title,
    metaDescription,
    h1,
    heroStats: buildHeroStats(r),
    contextParagraphs,
    calculatorPrefill: { therapeuticArea: ta, phase },
    faqs,
    relatedPages: related.slice(0, 4),
    category: 'phase',
  };
}

// ── Main export ──────────────────────────────────────────────────────────────

let _cache: BenchmarkPageData[] | null = null;

export function getGeneratedBenchmarkPages(): BenchmarkPageData[] {
  if (_cache) return _cache;

  const pages: BenchmarkPageData[] = [];

  // ── 1. TA x Modality pages ───────────────────────────────────────────────
  // Pre-compute slug index for related-page linking
  const modalitySlugs: { slug: string; ta: string; mod: string }[] = [];
  for (const [ta, mods] of Object.entries(TA_MODALITY_MAP)) {
    for (const mod of mods) {
      modalitySlugs.push({
        slug: `${taToSlug(ta)}-${modalityToSlug(mod)}-deal-benchmarks`,
        ta,
        mod,
      });
    }
  }

  for (const [ta, mods] of Object.entries(TA_MODALITY_MAP)) {
    for (const mod of mods) {
      pages.push(generateTAModalityPage(ta, mod, modalitySlugs));
    }
  }

  // ── 2. TA x Phase pages (top 5 TAs) ──────────────────────────────────────
  const PHASE_TAS = ['oncology', 'neurology', 'immunology', 'metabolic', 'rareDisease'];
  const PHASES = ['preclinical', 'phase1', 'phase1_2', 'phase2', 'phase2_3', 'phase3', 'approved'];

  const phaseSlugs: { slug: string; ta: string; phase: string }[] = [];
  for (const ta of PHASE_TAS) {
    for (const phase of PHASES) {
      phaseSlugs.push({
        slug: `${taToSlug(ta)}-${phaseToSlug(phase)}-deal-benchmarks`,
        ta,
        phase,
      });
    }
  }

  for (const ta of PHASE_TAS) {
    for (const phase of PHASES) {
      pages.push(generateTAPhasePage(ta, phase, phaseSlugs));
    }
  }

  _cache = pages;
  return pages;
}
