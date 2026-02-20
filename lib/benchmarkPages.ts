import {
  calculateDealTerms,
  formatCurrency,
  type CalculationInput,
  type Phase,
  type Modality,
  type Indication,
  type TherapeuticArea,
} from './calculations';

export interface BenchmarkPageData {
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  heroStats: { label: string; value: string; subtext: string }[];
  contextParagraphs: string[];
  calculatorPrefill: { phase?: string; modality?: string; indication?: string; therapeuticArea?: string };
  faqs: { question: string; answer: string }[];
  relatedPages: { slug: string; title: string }[];
  category: 'modality' | 'indication' | 'phase' | 'overview';
}

// Default input factory for generating benchmark data
function makeInput(overrides: Partial<CalculationInput>): CalculationInput {
  const therapeuticArea: TherapeuticArea = overrides.therapeuticArea ?? 'oncology';
  const isNeuro = therapeuticArea === 'neurology';
  const isMetabolic = therapeuticArea === 'metabolic';

  return {
    therapeuticArea,
    phase: overrides.phase ?? 'phase2',
    modality: overrides.modality ?? (isMetabolic ? 'glp1Agonist' : 'smallMolecule'),
    indication: overrides.indication ?? (isMetabolic ? 'obesity' : isNeuro ? 'alzheimers' : 'lung_nsclc'),
    territory: overrides.territory ?? 'global',
    biomarker: overrides.biomarker ?? 'unselected',
    lineOfTherapy: overrides.lineOfTherapy ?? '2L',
    treatmentApproach: overrides.treatmentApproach ?? (isNeuro ? 'diseaseModifying' : 'symptomatic'),
    combinationPotential: overrides.combinationPotential ?? 'some',
    competitivePosition: overrides.competitivePosition ?? 'racing',
    dataQuality: overrides.dataQuality ?? 'promising',
    regulatoryDesignations: overrides.regulatoryDesignations ?? {
      breakthrough: false,
      fastTrack: false,
      orphan: false,
      prime: false,
    },
    ...(isNeuro
      ? {
          bbbPenetration: overrides.bbbPenetration ?? 'promisingPreclinical',
          diseaseProgression: overrides.diseaseProgression ?? 'moderateProgressive',
          biomarkerValidation: overrides.biomarkerValidation ?? 'exploratory',
        }
      : {}),
    ...(isMetabolic
      ? {
          mechanismDifferentiation: overrides.mechanismDifferentiation ?? 'incretinBased',
          weightLossEfficacy: overrides.weightLossEfficacy ?? 'competitiveEfficacy',
          routeOfAdministration: overrides.routeOfAdministration ?? 'injectable',
          comorbidityBreadth: overrides.comorbidityBreadth ?? 'obesityPrimary',
          metabolicTreatmentApproach: overrides.metabolicTreatmentApproach ?? 'chronicWeightMgmt',
        }
      : {}),
  };
}

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

// ── Page definitions ──────────────────────────────────────────────────────────

function buildADCPage(): BenchmarkPageData {
  const input = makeInput({ modality: 'adc' as Modality, phase: 'phase2', indication: 'breast_tnbc' as Indication });
  const r = calculateDealTerms(input);
  return {
    slug: 'adc-deal-benchmarks',
    title: 'ADC Licensing Deal Benchmarks 2026 | Antibody-Drug Conjugate Terms',
    metaDescription: `ADC licensing deals average ${formatCurrency(r.terms.totalDealValue.median)} total value with ${formatCurrency(r.terms.upfront.median)} upfront at Phase 2. Explore benchmark deal terms for antibody-drug conjugates.`,
    h1: 'ADC Licensing Deal Benchmarks',
    heroStats: buildHeroStats(r),
    contextParagraphs: [
      `Antibody-drug conjugates remain one of the hottest modalities in oncology licensing. Phase 2 ADC deals command a median total deal value of ${formatCurrency(r.terms.totalDealValue.median)}, with upfront payments ranging from ${formatCurrency(r.terms.upfront.low)} to ${formatCurrency(r.terms.upfront.high)}. The premium reflects strong clinical validation from approved ADCs and a deep pipeline of next-generation linker-payload combinations.`,
      `Milestone structures in ADC deals are typically front-loaded toward development milestones (${formatCurrency(r.terms.devMilestones.median)} median) because of the technical risk around linker stability, payload potency, and therapeutic index optimization. Regulatory milestones add ${formatCurrency(r.terms.regMilestones.median)} on average, while commercial milestones can reach ${formatCurrency(r.terms.commMilestones.median)}.`,
      `Royalty rates for ADC licensing transactions typically fall between ${r.tieredRoyalties.base.low}% and ${r.tieredRoyalties.base.high}% at the base tier, escalating to ${r.tieredRoyalties.highTier.low}%-${r.tieredRoyalties.highTier.high}% on blockbuster sales. The ${r.dealRecommendation.upfrontPercent}% upfront / ${r.dealRecommendation.milestonePercent}% milestone split is standard for Phase 2 ADC assets with competitive differentiation.`,
    ],
    calculatorPrefill: { phase: 'phase2', modality: 'adc' },
    faqs: [
      {
        question: 'What is the average upfront payment for an ADC licensing deal?',
        answer: `Based on our analysis, Phase 2 ADC licensing deals average ${formatCurrency(r.terms.upfront.median)} in upfront payments, with a range of ${formatCurrency(r.terms.upfront.low)} to ${formatCurrency(r.terms.upfront.high)} depending on target validation, payload novelty, and competitive positioning.`,
      },
      {
        question: 'How are ADC deal milestones typically structured?',
        answer: `ADC deals allocate approximately ${r.dealRecommendation.milestonePercent}% of total deal value to milestones. Development milestones (${formatCurrency(r.terms.devMilestones.median)}) make up the largest share, followed by commercial milestones (${formatCurrency(r.terms.commMilestones.median)}) and regulatory milestones (${formatCurrency(r.terms.regMilestones.median)}).`,
      },
      {
        question: 'What royalty rates are standard for ADC out-licensing?',
        answer: `Base royalty rates for ADC transactions range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}%, with tiered escalations reaching ${r.tieredRoyalties.highTier.low}%-${r.tieredRoyalties.highTier.high}% on peak sales exceeding $1 billion. Rates are influenced by target novelty, competitive landscape, and territorial scope.`,
      },
      {
        question: 'How do ADC deal terms compare to other modalities?',
        answer: 'ADC licensing deals typically command a premium over standard monoclonal antibodies due to the added complexity of linker-payload technology and the demonstrated blockbuster potential of approved ADCs. Total deal values tend to be 20-40% higher than naked antibody deals at equivalent clinical stages.',
      },
    ],
    relatedPages: [
      { slug: 'bispecific-antibody-deal-benchmarks', title: 'Bispecific Antibody Deals' },
      { slug: 'breast-cancer-deal-benchmarks', title: 'Breast Cancer Deal Benchmarks' },
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
      { slug: 'oncology-deal-benchmarks-2026', title: 'Oncology Deal Overview 2026' },
    ],
    category: 'modality',
  };
}

function buildCARTPage(): BenchmarkPageData {
  const input = makeInput({ modality: 'carT_heme' as Modality, phase: 'phase1', indication: 'dlbcl' as Indication });
  const r = calculateDealTerms(input);
  return {
    slug: 'car-t-deal-benchmarks',
    title: 'CAR-T Cell Therapy Licensing Deal Benchmarks 2026 | Hematologic CAR-T Terms',
    metaDescription: `CAR-T licensing deals average ${formatCurrency(r.terms.totalDealValue.median)} total value at Phase 1. Benchmark upfront payments, milestones, and royalties for hematologic CAR-T cell therapies.`,
    h1: 'CAR-T Cell Therapy Deal Benchmarks',
    heroStats: buildHeroStats(r),
    contextParagraphs: [
      `CAR-T cell therapy continues to drive some of the most substantial licensing transactions in hematologic oncology. Phase 1 CAR-T deals carry a median total deal value of ${formatCurrency(r.terms.totalDealValue.median)}, reflecting the transformative clinical potential and high manufacturing complexity of engineered cell therapies. Upfront payments range from ${formatCurrency(r.terms.upfront.low)} to ${formatCurrency(r.terms.upfront.high)}.`,
      `Given the early clinical stage, CAR-T deal structures are heavily milestone-weighted. Development milestones average ${formatCurrency(r.terms.devMilestones.median)}, reflecting the significant clinical de-risking required around cytokine release syndrome management, persistence, and manufacturing scalability. Commercial milestones of ${formatCurrency(r.terms.commMilestones.median)} reward the path to blockbuster status.`,
      `Royalty structures for CAR-T deals start at ${r.tieredRoyalties.base.low}%-${r.tieredRoyalties.base.high}% base rates, with escalation tiers reaching ${r.tieredRoyalties.highTier.high}%. The manufacturing economics of autologous versus allogeneic approaches significantly influence deal terms, with allogeneic platforms often commanding higher total deal values due to broader commercial potential.`,
    ],
    calculatorPrefill: { phase: 'phase1', modality: 'carT_heme' },
    faqs: [
      {
        question: 'What are typical deal terms for a Phase 1 CAR-T licensing agreement?',
        answer: `Phase 1 CAR-T deals typically feature ${formatCurrency(r.terms.upfront.median)} median upfront payments with total deal values reaching ${formatCurrency(r.terms.totalDealValue.median)}. The milestone-heavy structure (${r.dealRecommendation.milestonePercent}% milestones) reflects the early clinical stage and high de-risking potential.`,
      },
      {
        question: 'How do hematologic CAR-T deals differ from solid tumor CAR-T deals?',
        answer: 'Hematologic CAR-T deals generally command higher valuations than solid tumor CAR-T due to established clinical proof of concept and approved products in heme malignancies. Solid tumor CAR-T remains earlier stage with greater technical risk around tumor microenvironment penetration and T-cell exhaustion.',
      },
      {
        question: 'What royalty rates are common in CAR-T licensing deals?',
        answer: `CAR-T base royalty rates range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}%, with tiered escalation up to ${r.tieredRoyalties.highTier.high}%. The rates account for the unique manufacturing cost structure and pricing dynamics of cell therapies.`,
      },
      {
        question: 'What drives upfront payment size in CAR-T deals?',
        answer: 'Key factors influencing CAR-T upfront payments include target antigen validation, manufacturing platform maturity (autologous vs. allogeneic), clinical data quality, and competitive landscape density. First-in-class targets or novel constructs with safety advantages command the highest premiums.',
      },
    ],
    relatedPages: [
      { slug: 'gene-therapy-deal-benchmarks', title: 'Gene Therapy Deals' },
      { slug: 'multiple-myeloma-deal-terms', title: 'Multiple Myeloma Deals' },
      { slug: 'preclinical-licensing-benchmarks', title: 'Preclinical Deal Benchmarks' },
      { slug: 'oncology-deal-benchmarks-2026', title: 'Oncology Deal Overview 2026' },
    ],
    category: 'modality',
  };
}

function buildBispecificPage(): BenchmarkPageData {
  const input = makeInput({ modality: 'bispecific' as Modality, phase: 'phase2', indication: 'lung_nsclc' as Indication });
  const r = calculateDealTerms(input);
  return {
    slug: 'bispecific-antibody-deal-benchmarks',
    title: 'Bispecific Antibody Licensing Deal Benchmarks 2026 | T-cell Engager Terms',
    metaDescription: `Bispecific antibody licensing deals average ${formatCurrency(r.terms.totalDealValue.median)} total value at Phase 2. Benchmark upfronts, milestones, and royalties for bispecific deals.`,
    h1: 'Bispecific Antibody Deal Benchmarks',
    heroStats: buildHeroStats(r),
    contextParagraphs: [
      `Bispecific antibodies represent one of the most actively transacted modalities in oncology licensing. Phase 2 bispecific deals achieve a median total deal value of ${formatCurrency(r.terms.totalDealValue.median)}, with upfront payments between ${formatCurrency(r.terms.upfront.low)} and ${formatCurrency(r.terms.upfront.high)}. The modality's versatility across T-cell engagement, dual checkpoint blockade, and receptor crosslinking drives strong licensee interest.`,
      `Milestone allocations in bispecific transactions reflect a balanced risk profile. Development milestones average ${formatCurrency(r.terms.devMilestones.median)}, while regulatory and commercial milestones contribute ${formatCurrency(r.terms.regMilestones.median)} and ${formatCurrency(r.terms.commMilestones.median)}, respectively. The overall deal recommendation splits at approximately ${r.dealRecommendation.upfrontPercent}% upfront and ${r.dealRecommendation.milestonePercent}% milestones.`,
      `Royalty rates for bispecific licensing deals range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}% at the base tier, with escalation to ${r.tieredRoyalties.highTier.high}% on high-volume sales. Bispecifics with novel mechanisms (e.g., tumor-conditional activation or half-life extension) tend to attract premium terms relative to conventional T-cell engagers.`,
    ],
    calculatorPrefill: { phase: 'phase2', modality: 'bispecific' },
    faqs: [
      {
        question: 'What is the median total deal value for bispecific antibody licensing?',
        answer: `Phase 2 bispecific antibody deals have a median total deal value of ${formatCurrency(r.terms.totalDealValue.median)}, ranging from ${formatCurrency(r.terms.totalDealValue.low)} to ${formatCurrency(r.terms.totalDealValue.high)} depending on mechanism novelty, target validation, and competitive positioning.`,
      },
      {
        question: 'How do bispecific deal terms compare to standard monoclonal antibodies?',
        answer: 'Bispecific antibody deals typically command a premium over standard monoclonal antibodies due to the dual-mechanism advantage, broader combination potential, and increasing regulatory acceptance. Total deal values for bispecifics are generally 15-30% higher than comparable naked antibody transactions.',
      },
      {
        question: 'What factors influence bispecific antibody deal valuations?',
        answer: 'Key valuation drivers include mechanism type (T-cell engagement vs. dual pathway blockade), manufacturing complexity, half-life profile, safety data, and competitive density in the target space. First-in-class bispecifics with differentiated safety profiles command the highest premiums.',
      },
      {
        question: 'What royalty rates are typical for bispecific deals?',
        answer: `Bispecific royalty rates start at ${r.tieredRoyalties.base.low}%-${r.tieredRoyalties.base.high}% base, escalating to ${r.tieredRoyalties.highTier.low}%-${r.tieredRoyalties.highTier.high}% at the highest sales tier. Rates are influenced by manufacturing cost sharing agreements and co-promotion rights.`,
      },
    ],
    relatedPages: [
      { slug: 'adc-deal-benchmarks', title: 'ADC Deal Benchmarks' },
      { slug: 'lung-nsclc-licensing-terms', title: 'Lung NSCLC Deal Terms' },
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
      { slug: 'oncology-deal-benchmarks-2026', title: 'Oncology Deal Overview 2026' },
    ],
    category: 'modality',
  };
}

function buildRadiopharmaPage(): BenchmarkPageData {
  const input = makeInput({ modality: 'radiopharmaceutical' as Modality, phase: 'phase1', indication: 'prostate' as Indication });
  const r = calculateDealTerms(input);
  return {
    slug: 'radiopharmaceutical-deal-benchmarks',
    title: 'Radiopharmaceutical Licensing Deal Benchmarks 2026 | RPT Deal Terms',
    metaDescription: `Radiopharmaceutical deals average ${formatCurrency(r.terms.totalDealValue.median)} total value at Phase 1. Explore upfront payments, milestones, and royalty benchmarks for RPT licensing.`,
    h1: 'Radiopharmaceutical Deal Benchmarks',
    heroStats: buildHeroStats(r),
    contextParagraphs: [
      `Radiopharmaceuticals have emerged as one of the fastest-growing modalities in oncology deal-making. Phase 1 radiopharmaceutical deals carry a median total deal value of ${formatCurrency(r.terms.totalDealValue.median)}, with upfronts averaging ${formatCurrency(r.terms.upfront.median)}. The significant premium reflects constrained supply of radioisotopes, specialized manufacturing requirements, and the theranostic potential that enables patient selection via companion diagnostics.`,
      `The milestone structure for radiopharmaceutical deals allocates ${formatCurrency(r.terms.devMilestones.median)} to development milestones, recognizing the significant de-risking needed around dosimetry, manufacturing scale-up, and supply chain security for isotopes such as actinium-225 and lutetium-177. Commercial milestones of ${formatCurrency(r.terms.commMilestones.median)} reward the blockbuster trajectory demonstrated by approved RPTs.`,
      `Royalty rates range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}%, with high-tier escalation to ${r.tieredRoyalties.highTier.high}%. The constrained competitive landscape and high barriers to entry for radiopharmaceutical manufacturing give licensors strong negotiating leverage in these transactions.`,
    ],
    calculatorPrefill: { phase: 'phase1', modality: 'radiopharmaceutical' },
    faqs: [
      {
        question: 'Why are radiopharmaceutical deals so highly valued?',
        answer: `Radiopharmaceutical deals command premium valuations (${formatCurrency(r.terms.totalDealValue.median)} median total value at Phase 1) due to constrained isotope supply, specialized manufacturing barriers, theranostic patient selection advantages, and demonstrated blockbuster potential from approved agents like Pluvicto.`,
      },
      {
        question: 'What are the key risk factors in radiopharmaceutical licensing?',
        answer: 'Primary risk factors include isotope supply security (particularly for alpha emitters), manufacturing scalability, dosimetry optimization, and regulatory pathway complexity for combination radioligand therapies. These risks are reflected in the milestone-heavy deal structures.',
      },
      {
        question: 'How do radiopharmaceutical royalty rates compare to other modalities?',
        answer: `Base royalty rates of ${r.tieredRoyalties.base.low}%-${r.tieredRoyalties.base.high}% for RPTs are at the higher end of oncology modalities, reflecting high barriers to entry and limited competition. The manufacturing complexity and isotope supply constraints give licensors significant leverage.`,
      },
      {
        question: 'What milestone structure is typical for RPT deals?',
        answer: `RPT deals allocate roughly ${r.dealRecommendation.milestonePercent}% to milestones. Development milestones (${formatCurrency(r.terms.devMilestones.median)}) dominate the structure, with additional regulatory (${formatCurrency(r.terms.regMilestones.median)}) and commercial (${formatCurrency(r.terms.commMilestones.median)}) payments.`,
      },
    ],
    relatedPages: [
      { slug: 'small-molecule-deal-benchmarks', title: 'Small Molecule Deals' },
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
      { slug: 'preclinical-licensing-benchmarks', title: 'Preclinical Deal Benchmarks' },
      { slug: 'oncology-deal-benchmarks-2026', title: 'Oncology Deal Overview 2026' },
    ],
    category: 'modality',
  };
}

function buildGeneTherapyPage(): BenchmarkPageData {
  const input = makeInput({ modality: 'geneTherapy' as Modality, phase: 'phase1', indication: 'lung_nsclc' as Indication });
  const r = calculateDealTerms(input);
  return {
    slug: 'gene-therapy-deal-benchmarks',
    title: 'Gene Therapy Licensing Deal Benchmarks 2026 | Gene Editing Deal Terms',
    metaDescription: `Gene therapy licensing deals average ${formatCurrency(r.terms.totalDealValue.median)} total value at Phase 1. Benchmark upfronts, milestones, and royalty rates for gene therapy and gene editing deals.`,
    h1: 'Gene Therapy & Gene Editing Deal Benchmarks',
    heroStats: buildHeroStats(r),
    contextParagraphs: [
      `Gene therapy and gene editing platforms are attracting transformative licensing deals across oncology and rare disease. Phase 1 gene therapy deals carry a median total deal value of ${formatCurrency(r.terms.totalDealValue.median)}, with upfront payments ranging from ${formatCurrency(r.terms.upfront.low)} to ${formatCurrency(r.terms.upfront.high)}. The high valuations reflect the one-time curative potential and breakthrough therapy designations frequently granted to these approaches.`,
      `Development milestones account for ${formatCurrency(r.terms.devMilestones.median)} in a typical gene therapy deal, reflecting the extensive clinical de-risking required around durability of expression, immunogenicity management, and manufacturing consistency of viral vectors. Regulatory milestones (${formatCurrency(r.terms.regMilestones.median)}) and commercial milestones (${formatCurrency(r.terms.commMilestones.median)}) complete the value stack.`,
      `Royalty rates for gene therapy span ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}% at the base tier. The unique pricing dynamics of curative one-time therapies -- often priced at $1M+ per patient -- create distinctive commercial milestone structures where sales thresholds must account for small patient populations but high per-patient revenue.`,
    ],
    calculatorPrefill: { phase: 'phase1', modality: 'geneTherapy' },
    faqs: [
      {
        question: 'What are typical deal terms for gene therapy licensing?',
        answer: `Phase 1 gene therapy deals average ${formatCurrency(r.terms.upfront.median)} upfront with ${formatCurrency(r.terms.totalDealValue.median)} total deal value. The ${r.dealRecommendation.upfrontPercent}/${r.dealRecommendation.milestonePercent} upfront/milestone split reflects early-stage risk and the high de-risking potential of successful clinical data.`,
      },
      {
        question: 'How do gene editing deals differ from AAV gene therapy deals?',
        answer: 'Gene editing platforms (CRISPR, base editing, prime editing) often command platform premiums due to their programmable nature and potential for multiple indications. AAV-based gene therapies are more established clinically but face challenges with re-dosing and manufacturing. Both carry similar total deal values at equivalent stages.',
      },
      {
        question: 'What risks affect gene therapy deal valuations?',
        answer: 'Key risks include durability of gene expression, immunogenicity of viral vectors, manufacturing scalability and consistency, high treatment costs creating payer resistance, and competition from emerging editing technologies. These risks are balanced by the curative potential and frequent breakthrough therapy designations.',
      },
      {
        question: 'What royalty structures are used in gene therapy deals?',
        answer: `Gene therapy royalties range from ${r.tieredRoyalties.base.low}%-${r.tieredRoyalties.base.high}% base, escalating to ${r.tieredRoyalties.highTier.high}%. The one-time treatment model means commercial milestones are often structured around patient counts rather than traditional revenue thresholds.`,
      },
    ],
    relatedPages: [
      { slug: 'car-t-deal-benchmarks', title: 'CAR-T Cell Therapy Deals' },
      { slug: 'preclinical-licensing-benchmarks', title: 'Preclinical Deal Benchmarks' },
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
      { slug: 'oncology-deal-benchmarks-2026', title: 'Oncology Deal Overview 2026' },
    ],
    category: 'modality',
  };
}

function buildSmallMoleculePage(): BenchmarkPageData {
  const input = makeInput({ modality: 'smallMolecule' as Modality, phase: 'phase2', indication: 'lung_nsclc' as Indication });
  const r = calculateDealTerms(input);
  return {
    slug: 'small-molecule-deal-benchmarks',
    title: 'Small Molecule Licensing Deal Benchmarks 2026 | Pharma Deal Terms',
    metaDescription: `Small molecule licensing deals average ${formatCurrency(r.terms.totalDealValue.median)} total value at Phase 2. Comprehensive benchmarks for upfronts, milestones, and royalties.`,
    h1: 'Small Molecule Licensing Deal Benchmarks',
    heroStats: buildHeroStats(r),
    contextParagraphs: [
      `Small molecules remain the most frequently transacted modality in biopharma licensing. Phase 2 small molecule deals carry a median total deal value of ${formatCurrency(r.terms.totalDealValue.median)}, with upfront payments ranging from ${formatCurrency(r.terms.upfront.low)} to ${formatCurrency(r.terms.upfront.high)}. While biologics have captured headlines, small molecules continue to dominate deal volume due to established manufacturing, oral bioavailability, and favorable cost of goods.`,
      `Milestone structures in small molecule deals reflect a mature transactional landscape. Development milestones average ${formatCurrency(r.terms.devMilestones.median)}, regulatory milestones contribute ${formatCurrency(r.terms.regMilestones.median)}, and commercial milestones reach ${formatCurrency(r.terms.commMilestones.median)}. The recommended split of ${r.dealRecommendation.upfrontPercent}% upfront and ${r.dealRecommendation.milestonePercent}% milestones aligns with established market norms.`,
      `Royalty rates for small molecule out-licensing range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}%, with tiered escalation to ${r.tieredRoyalties.highTier.high}%. Competition from generic entry at patent expiry is factored into royalty term negotiations, making intellectual property strength and lifecycle management key valuation drivers.`,
    ],
    calculatorPrefill: { phase: 'phase2', modality: 'smallMolecule' },
    faqs: [
      {
        question: 'How are small molecule licensing deals valued in 2026?',
        answer: `Phase 2 small molecule deals average ${formatCurrency(r.terms.totalDealValue.median)} in total deal value, with ${formatCurrency(r.terms.upfront.median)} median upfront. Valuations depend heavily on target novelty, competitive landscape, oral bioavailability advantages, and patent estate strength.`,
      },
      {
        question: 'What drives premium valuations for small molecule assets?',
        answer: 'Key premium drivers include first-in-class mechanism, oral administration (versus injectable alternatives), demonstrated selectivity or safety advantages, strong IP position with composition-of-matter patents, and combinability with existing standards of care.',
      },
      {
        question: 'How do small molecule royalties compare to biologic royalties?',
        answer: `Small molecule base royalties of ${r.tieredRoyalties.base.low}%-${r.tieredRoyalties.base.high}% tend to be slightly lower than biologic royalties due to the impact of generic competition at patent expiry. However, small molecules often compensate with higher commercial milestones tied to broader market adoption.`,
      },
      {
        question: 'What milestone structure is standard for small molecule deals?',
        answer: `A typical Phase 2 small molecule deal allocates ${formatCurrency(r.terms.devMilestones.median)} to development milestones, ${formatCurrency(r.terms.regMilestones.median)} to regulatory milestones, and ${formatCurrency(r.terms.commMilestones.median)} to commercial milestones, for a total milestone pool of approximately ${formatCurrency(r.terms.totalDealValue.median - r.terms.upfront.median)}.`,
      },
    ],
    relatedPages: [
      { slug: 'adc-deal-benchmarks', title: 'ADC Deal Benchmarks' },
      { slug: 'lung-nsclc-licensing-terms', title: 'Lung NSCLC Deal Terms' },
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
      { slug: 'oncology-deal-benchmarks-2026', title: 'Oncology Deal Overview 2026' },
    ],
    category: 'modality',
  };
}

function buildLungNSCLCPage(): BenchmarkPageData {
  const input = makeInput({ indication: 'lung_nsclc' as Indication, phase: 'phase2', modality: 'smallMolecule' as Modality });
  const r = calculateDealTerms(input);
  return {
    slug: 'lung-nsclc-licensing-terms',
    title: 'Lung Cancer (NSCLC) Licensing Deal Benchmarks 2026 | Deal Terms',
    metaDescription: `NSCLC licensing deals average ${formatCurrency(r.terms.totalDealValue.median)} total value at Phase 2. Benchmark deal terms for non-small cell lung cancer licensing agreements.`,
    h1: 'Lung Cancer (NSCLC) Licensing Deal Benchmarks',
    heroStats: buildHeroStats(r),
    contextParagraphs: [
      `Non-small cell lung cancer remains the single largest indication by licensing deal volume in oncology. Phase 2 NSCLC deals carry a median total deal value of ${formatCurrency(r.terms.totalDealValue.median)}, with upfronts averaging ${formatCurrency(r.terms.upfront.median)}. The enormous addressable market -- over 230,000 new US cases annually -- sustains strong licensee demand despite an increasingly crowded competitive landscape.`,
      `Deal structures in NSCLC reflect the high commercial ceiling and well-defined regulatory pathways. Development milestones average ${formatCurrency(r.terms.devMilestones.median)}, with regulatory milestones of ${formatCurrency(r.terms.regMilestones.median)} and commercial milestones reaching ${formatCurrency(r.terms.commMilestones.median)}. The ${r.dealRecommendation.upfrontPercent}/${r.dealRecommendation.milestonePercent} upfront/milestone split balances early-stage risk with blockbuster upside.`,
      `Royalty rates for NSCLC licensing deals range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}%, with tiered escalation to ${r.tieredRoyalties.highTier.high}%. Assets targeting specific driver mutations (KRAS G12C, EGFR exon 20, MET amplification) command premium terms, while IO-combination approaches face increasing competitive pressure.`,
    ],
    calculatorPrefill: { phase: 'phase2', indication: 'lung_nsclc' },
    faqs: [
      {
        question: 'What are typical deal terms for NSCLC licensing agreements?',
        answer: `Phase 2 NSCLC deals average ${formatCurrency(r.terms.upfront.median)} upfront with ${formatCurrency(r.terms.totalDealValue.median)} total deal value. Valuations are driven by the enormous addressable market, clear regulatory pathways, and line-of-therapy positioning.`,
      },
      {
        question: 'How does biomarker selection affect NSCLC deal terms?',
        answer: 'Biomarker-selected NSCLC assets (targeting specific mutations) command 10-20% premium in deal terms over broad/unselected approaches. The clearer development path, smaller trial sizes, and higher response rates translate to favorable risk-adjusted economics for licensees.',
      },
      {
        question: 'What competitive factors influence NSCLC deal valuations?',
        answer: 'Key factors include line-of-therapy positioning (1L vs. 2L+), mechanism differentiation from pembrolizumab and other IO agents, combinability with existing standards, and strength of biomarker-selection strategy. Assets targeting underserved molecular subsets command the highest premiums.',
      },
      {
        question: 'How do NSCLC royalty rates compare across modalities?',
        answer: `Base royalty rates of ${r.tieredRoyalties.base.low}%-${r.tieredRoyalties.base.high}% are consistent across modalities for NSCLC, though biologics and cell therapies may command slightly higher rates. The large addressable market supports aggressive commercial milestone structures.`,
      },
    ],
    relatedPages: [
      { slug: 'breast-cancer-deal-benchmarks', title: 'Breast Cancer Deal Benchmarks' },
      { slug: 'small-molecule-deal-benchmarks', title: 'Small Molecule Deals' },
      { slug: 'adc-deal-benchmarks', title: 'ADC Deal Benchmarks' },
      { slug: 'oncology-deal-benchmarks-2026', title: 'Oncology Deal Overview 2026' },
    ],
    category: 'indication',
  };
}

function buildBreastCancerPage(): BenchmarkPageData {
  const input = makeInput({ indication: 'breast_tnbc' as Indication, phase: 'phase2', modality: 'adc' as Modality });
  const r = calculateDealTerms(input);
  return {
    slug: 'breast-cancer-deal-benchmarks',
    title: 'Breast Cancer (TNBC) Licensing Deal Benchmarks 2026 | Deal Terms',
    metaDescription: `TNBC licensing deals average ${formatCurrency(r.terms.totalDealValue.median)} total value at Phase 2. Benchmark upfronts, milestones, and royalties for triple-negative breast cancer deals.`,
    h1: 'Breast Cancer (TNBC) Licensing Deal Benchmarks',
    heroStats: buildHeroStats(r),
    contextParagraphs: [
      `Triple-negative breast cancer remains one of the highest-value indication-modality combinations in oncology deal-making. Phase 2 TNBC deals, particularly for ADC approaches, carry a median total deal value of ${formatCurrency(r.terms.totalDealValue.median)} with upfront payments between ${formatCurrency(r.terms.upfront.low)} and ${formatCurrency(r.terms.upfront.high)}. The unmet medical need and proven ADC success (Enhertu, Trodelvy) sustain strong licensing demand.`,
      `Milestone structures for TNBC assets allocate ${formatCurrency(r.terms.devMilestones.median)} to development milestones, ${formatCurrency(r.terms.regMilestones.median)} to regulatory milestones, and ${formatCurrency(r.terms.commMilestones.median)} to commercial milestones. The ${r.dealRecommendation.upfrontPercent}% upfront / ${r.dealRecommendation.milestonePercent}% milestone split reflects the established clinical pathway and strong commercial precedent in breast cancer.`,
      `Royalty rates for TNBC licensing deals range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}% at the base tier. ADC-based TNBC assets command the highest royalty rates due to demonstrated blockbuster potential and differentiated mechanisms of action. Combination approaches with IO agents are increasingly valued.`,
    ],
    calculatorPrefill: { phase: 'phase2', indication: 'breast_tnbc', modality: 'adc' },
    faqs: [
      {
        question: 'What are benchmark deal terms for TNBC licensing?',
        answer: `Phase 2 TNBC deals average ${formatCurrency(r.terms.upfront.median)} upfront with ${formatCurrency(r.terms.totalDealValue.median)} total deal value. ADC-based approaches command the highest valuations, followed by bispecifics and novel small molecules targeting TNBC-specific vulnerabilities.`,
      },
      {
        question: 'How does the TNBC competitive landscape affect deal terms?',
        answer: 'The success of Enhertu and Trodelvy has validated TNBC as a high-value target space, but also increased competitive pressure. Differentiated mechanisms, superior safety profiles, or activity in ADC-refractory patients command significant deal premiums.',
      },
      {
        question: 'What modalities dominate TNBC licensing deals?',
        answer: 'ADCs lead TNBC deal volume and value, followed by bispecific antibodies and immunotherapy combinations. Novel payloads, topoisomerase inhibitor conjugates, and TROP2-targeting approaches are among the most actively licensed.',
      },
      {
        question: 'Are TNBC deal terms higher than other breast cancer subtypes?',
        answer: 'TNBC deals generally command higher upfronts and total deal values than HR+ or HER2+ breast cancer deals due to greater unmet need and less crowded competitive landscape. However, HER2+ ADC deals can rival TNBC valuations when targeting novel epitopes.',
      },
    ],
    relatedPages: [
      { slug: 'adc-deal-benchmarks', title: 'ADC Deal Benchmarks' },
      { slug: 'lung-nsclc-licensing-terms', title: 'Lung NSCLC Deal Terms' },
      { slug: 'bispecific-antibody-deal-benchmarks', title: 'Bispecific Antibody Deals' },
      { slug: 'oncology-deal-benchmarks-2026', title: 'Oncology Deal Overview 2026' },
    ],
    category: 'indication',
  };
}

function buildAlzheimersPage(): BenchmarkPageData {
  const input = makeInput({
    therapeuticArea: 'neurology',
    indication: 'alzheimers' as Indication,
    phase: 'phase2',
    modality: 'mab' as Modality,
    treatmentApproach: 'diseaseModifying',
    bbbPenetration: 'promisingPreclinical',
    diseaseProgression: 'slowProgressive',
    biomarkerValidation: 'exploratory',
  });
  const r = calculateDealTerms(input);
  return {
    slug: 'alzheimers-licensing-deals',
    title: "Alzheimer's Disease Licensing Deal Benchmarks 2026 | Neurology Deal Terms",
    metaDescription: `Alzheimer's licensing deals average ${formatCurrency(r.terms.totalDealValue.median)} total value at Phase 2. Benchmark deal terms for Alzheimer's disease-modifying and symptomatic therapies.`,
    h1: "Alzheimer's Disease Licensing Deal Benchmarks",
    heroStats: buildHeroStats(r),
    contextParagraphs: [
      `Alzheimer's disease licensing has undergone a renaissance following the approval of disease-modifying amyloid antibodies. Phase 2 Alzheimer's deals now carry a median total deal value of ${formatCurrency(r.terms.totalDealValue.median)}, with upfront payments between ${formatCurrency(r.terms.upfront.low)} and ${formatCurrency(r.terms.upfront.high)}. The enormous patient population (6+ million in the US alone) and validated disease-modification pathway support strong licensee interest.`,
      `Deal structures in Alzheimer's are heavily milestone-weighted, reflecting the extended clinical timelines (3-5 year pivotal trials) and complex endpoint requirements. Development milestones average ${formatCurrency(r.terms.devMilestones.median)}, while regulatory and commercial milestones contribute ${formatCurrency(r.terms.regMilestones.median)} and ${formatCurrency(r.terms.commMilestones.median)}, respectively.`,
      `Royalty rates for Alzheimer's deals range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}% at the base tier. Disease-modifying therapies command premium terms over symptomatic treatments, particularly those with demonstrated biomarker effects on amyloid or tau pathology. Blood-brain barrier penetration data is increasingly critical in valuation discussions.`,
    ],
    calculatorPrefill: { phase: 'phase2', indication: 'alzheimers', therapeuticArea: 'neurology' },
    faqs: [
      {
        question: "What are typical deal terms for Alzheimer's disease licensing?",
        answer: `Phase 2 Alzheimer's deals average ${formatCurrency(r.terms.upfront.median)} upfront with ${formatCurrency(r.terms.totalDealValue.median)} total deal value. The milestone-heavy structure reflects extended development timelines and the high commercial upside of the enormous addressable market.`,
      },
      {
        question: "How do disease-modifying vs. symptomatic Alzheimer's deals compare?",
        answer: "Disease-modifying Alzheimer's therapies command 30-50% higher total deal values than symptomatic treatments due to the massive commercial potential and growing payer acceptance. However, they carry higher clinical risk given the complexity of demonstrating cognitive benefit endpoints.",
      },
      {
        question: "What modalities are most active in Alzheimer's licensing?",
        answer: "Anti-amyloid and anti-tau antibodies lead in deal volume, followed by small molecule BACE inhibitors and tau aggregation inhibitors. Emerging modalities include ASOs targeting tau, gene therapies for APOE modification, and neuroinflammation-targeting approaches.",
      },
      {
        question: "Why are Alzheimer's deals so heavily milestone-weighted?",
        answer: `Alzheimer's deals allocate approximately ${r.dealRecommendation.milestonePercent}% to milestones due to the extended 3-5 year pivotal trial timelines, complex regulatory endpoints (CDR-SB, ADAS-Cog), and historically high late-stage failure rates. Milestones are structured to reward progressive de-risking through biomarker, clinical, and regulatory achievements.`,
      },
    ],
    relatedPages: [
      { slug: 'neurology-cns-deal-benchmarks', title: 'Neurology & CNS Deal Overview' },
      { slug: 'gene-therapy-deal-benchmarks', title: 'Gene Therapy Deals' },
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
      { slug: 'phase-3-deal-benchmarks', title: 'Phase 3 Deal Benchmarks' },
    ],
    category: 'indication',
  };
}

function buildMyelomaPage(): BenchmarkPageData {
  const input = makeInput({ indication: 'myeloma' as Indication, phase: 'phase2', modality: 'bispecific' as Modality });
  const r = calculateDealTerms(input);
  return {
    slug: 'multiple-myeloma-deal-terms',
    title: 'Multiple Myeloma Licensing Deal Benchmarks 2026 | Hematology Deal Terms',
    metaDescription: `Multiple myeloma licensing deals average ${formatCurrency(r.terms.totalDealValue.median)} total value at Phase 2. Benchmark upfronts, milestones, and royalties for myeloma deals.`,
    h1: 'Multiple Myeloma Licensing Deal Benchmarks',
    heroStats: buildHeroStats(r),
    contextParagraphs: [
      `Multiple myeloma is among the most actively licensed hematologic indications, driven by a large and growing patient population and a well-defined treatment landscape with multiple lines of therapy. Phase 2 myeloma deals carry a median total deal value of ${formatCurrency(r.terms.totalDealValue.median)}, with upfront payments between ${formatCurrency(r.terms.upfront.low)} and ${formatCurrency(r.terms.upfront.high)}.`,
      `Deal structures reflect the established development pathway in myeloma. Development milestones average ${formatCurrency(r.terms.devMilestones.median)}, while regulatory milestones contribute ${formatCurrency(r.terms.regMilestones.median)} and commercial milestones reach ${formatCurrency(r.terms.commMilestones.median)}. The overall structure splits approximately ${r.dealRecommendation.upfrontPercent}% upfront and ${r.dealRecommendation.milestonePercent}% milestones.`,
      `Royalty rates for myeloma licensing agreements range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}% at the base tier, escalating to ${r.tieredRoyalties.highTier.high}% on high-volume sales. Bispecific antibodies targeting BCMA, GPRC5D, and FcRH5 are commanding the highest valuations, followed by novel CAR-T approaches and next-generation immunomodulators.`,
    ],
    calculatorPrefill: { phase: 'phase2', indication: 'myeloma', modality: 'bispecific' },
    faqs: [
      {
        question: 'What are benchmark deal terms for multiple myeloma licensing?',
        answer: `Phase 2 myeloma deals average ${formatCurrency(r.terms.upfront.median)} upfront with ${formatCurrency(r.terms.totalDealValue.median)} total deal value. The established development pathway and large addressable market support robust valuations across modalities.`,
      },
      {
        question: 'Which modalities dominate myeloma licensing deals?',
        answer: 'Bispecific antibodies and CAR-T cell therapies lead myeloma deal activity. BCMA-targeting agents remain most popular, with emerging interest in GPRC5D and FcRH5 targets. Next-generation CELMoDs and bispecific-CAR-T combinations are gaining traction.',
      },
      {
        question: 'How do myeloma deal terms vary by line of therapy?',
        answer: 'First-line myeloma assets command 20-30% higher total deal values than relapsed/refractory (3L+) assets, reflecting the larger addressable population and longer duration of therapy. However, late-line assets with breakthrough data can rival first-line valuations.',
      },
      {
        question: 'What royalty rates are standard for myeloma licensing?',
        answer: `Base royalty rates of ${r.tieredRoyalties.base.low}%-${r.tieredRoyalties.base.high}% for myeloma deals are competitive with broader oncology benchmarks. Tiered royalties can reach ${r.tieredRoyalties.highTier.high}% on peak sales, reflecting the multi-billion dollar commercial opportunity.`,
      },
    ],
    relatedPages: [
      { slug: 'car-t-deal-benchmarks', title: 'CAR-T Cell Therapy Deals' },
      { slug: 'bispecific-antibody-deal-benchmarks', title: 'Bispecific Antibody Deals' },
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
      { slug: 'oncology-deal-benchmarks-2026', title: 'Oncology Deal Overview 2026' },
    ],
    category: 'indication',
  };
}

function buildPreclinicalPage(): BenchmarkPageData {
  const input = makeInput({ phase: 'preclinical', modality: 'smallMolecule' as Modality, indication: 'lung_nsclc' as Indication });
  const r = calculateDealTerms(input);
  return {
    slug: 'preclinical-licensing-benchmarks',
    title: 'Preclinical Licensing Deal Benchmarks 2026 | Early-Stage Deal Terms',
    metaDescription: `Preclinical licensing deals average ${formatCurrency(r.terms.totalDealValue.median)} total value. Benchmark upfronts, milestones, and royalties for IND-enabling stage assets.`,
    h1: 'Preclinical Licensing Deal Benchmarks',
    heroStats: buildHeroStats(r),
    contextParagraphs: [
      `Preclinical licensing deals represent the highest-risk, highest-potential segment of biopharma deal-making. Median total deal values for preclinical (IND-enabling) assets reach ${formatCurrency(r.terms.totalDealValue.median)}, with modest upfront payments of ${formatCurrency(r.terms.upfront.median)} reflecting the significant clinical risk ahead. These deals are characterized by heavily milestone-weighted structures where the bulk of value is contingent on successful clinical progression.`,
      `Development milestones dominate preclinical deal structures at ${formatCurrency(r.terms.devMilestones.median)}, covering IND filing, Phase 1 start, Phase 2 start, and Phase 3 initiation. Regulatory milestones add ${formatCurrency(r.terms.regMilestones.median)}, while commercial milestones of ${formatCurrency(r.terms.commMilestones.median)} reward successful commercialization. The recommended ${r.dealRecommendation.upfrontPercent}/${r.dealRecommendation.milestonePercent} upfront/milestone split is standard for this stage.`,
      `Royalty rates for preclinical assets start at ${r.tieredRoyalties.base.low}%-${r.tieredRoyalties.base.high}%, the lower end of industry ranges, reflecting early clinical risk. Platform technology deals with multi-target potential often negotiate higher royalties in exchange for lower upfronts, while single-asset deals favor higher upfronts with lower royalty commitments.`,
    ],
    calculatorPrefill: { phase: 'preclinical' },
    faqs: [
      {
        question: 'What are typical upfront payments for preclinical licensing deals?',
        answer: `Preclinical deal upfronts average ${formatCurrency(r.terms.upfront.median)}, ranging from ${formatCurrency(r.terms.upfront.low)} to ${formatCurrency(r.terms.upfront.high)}. The modest upfronts reflect the significant clinical risk and are balanced by substantial milestone potential as the asset progresses through development.`,
      },
      {
        question: 'How are preclinical deal milestones structured?',
        answer: `Preclinical deals allocate approximately ${r.dealRecommendation.milestonePercent}% of total value to milestones. Development milestones (${formatCurrency(r.terms.devMilestones.median)}) represent the largest component, gating payments to IND filing, clinical phase starts, and pivotal trial initiation.`,
      },
      {
        question: 'What makes a preclinical asset attractive for licensing?',
        answer: 'Key factors include novel and validated target biology, strong IND-enabling preclinical data (efficacy, PK, safety), differentiated mechanism of action, clear competitive advantages, strong IP position, and a defined regulatory pathway. Platform technologies with multi-indication potential also attract premium interest.',
      },
      {
        question: 'How do preclinical deal terms vary by modality?',
        answer: 'Preclinical deal terms vary significantly by modality. Cell and gene therapies, ADCs, and radiopharmaceuticals command higher total deal values due to platform complexity and manufacturing barriers. Small molecules and naked antibodies are valued more conservatively at the preclinical stage.',
      },
    ],
    relatedPages: [
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
      { slug: 'gene-therapy-deal-benchmarks', title: 'Gene Therapy Deals' },
      { slug: 'small-molecule-deal-benchmarks', title: 'Small Molecule Deals' },
      { slug: 'oncology-deal-benchmarks-2026', title: 'Oncology Deal Overview 2026' },
    ],
    category: 'phase',
  };
}

function buildPhase2Page(): BenchmarkPageData {
  const input = makeInput({ phase: 'phase2', modality: 'smallMolecule' as Modality, indication: 'lung_nsclc' as Indication });
  const r = calculateDealTerms(input);
  return {
    slug: 'phase-2-deal-benchmarks',
    title: 'Phase 2 Licensing Deal Benchmarks 2026 | Mid-Stage Deal Terms',
    metaDescription: `Phase 2 licensing deals average ${formatCurrency(r.terms.totalDealValue.median)} total value. Comprehensive benchmarks for upfronts, milestones, and royalties at the proof-of-concept stage.`,
    h1: 'Phase 2 Licensing Deal Benchmarks',
    heroStats: buildHeroStats(r),
    contextParagraphs: [
      `Phase 2 represents the most active deal-making stage in biopharma licensing, where proof-of-concept data transforms asset valuations. Median total deal values at Phase 2 reach ${formatCurrency(r.terms.totalDealValue.median)}, with upfront payments between ${formatCurrency(r.terms.upfront.low)} and ${formatCurrency(r.terms.upfront.high)}. This stage offers the optimal balance of de-risking and upside potential for both licensors and licensees.`,
      `Phase 2 deal structures balance upfront and milestone payments effectively. The ${r.dealRecommendation.upfrontPercent}/${r.dealRecommendation.milestonePercent} upfront/milestone split reflects moderate clinical risk. Development milestones average ${formatCurrency(r.terms.devMilestones.median)}, while regulatory milestones of ${formatCurrency(r.terms.regMilestones.median)} and commercial milestones of ${formatCurrency(r.terms.commMilestones.median)} reward successful progression to market.`,
      `Royalty rates at Phase 2 range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}%, the mid-range of industry norms. Assets with pivotal-ready Phase 2 data (clear efficacy signal, manageable safety, well-defined patient population) command premium terms approaching Phase 3 valuations, while assets with mixed or preliminary data trade at discounts.`,
    ],
    calculatorPrefill: { phase: 'phase2' },
    faqs: [
      {
        question: 'What is the average total deal value for Phase 2 licensing?',
        answer: `Phase 2 licensing deals average ${formatCurrency(r.terms.totalDealValue.median)} total deal value, ranging from ${formatCurrency(r.terms.totalDealValue.low)} to ${formatCurrency(r.terms.totalDealValue.high)}. This reflects the proof-of-concept de-risking that occurs at this stage.`,
      },
      {
        question: 'How do Phase 2 deal terms compare to Phase 1 and Phase 3?',
        answer: 'Phase 2 deals represent a significant step-up from Phase 1, with 50-100% higher total deal values. Phase 3 deals command approximately 40-80% more than Phase 2, reflecting the additional regulatory de-risking. Phase 2 is considered the optimal licensing window for many licensors.',
      },
      {
        question: 'What data quality factors affect Phase 2 deal valuations?',
        answer: 'Key factors include statistical rigor of efficacy data, durability of response, safety profile relative to competitors, biomarker data supporting patient selection, and clarity of the Phase 3 development path. Pivotal-ready Phase 2 data can drive valuations approaching Phase 3 levels.',
      },
      {
        question: 'Why is Phase 2 considered the optimal licensing window?',
        answer: 'Phase 2 offers the best risk-reward balance for licensing. Licensors have demonstrated proof of concept, commanding meaningful upfronts, while licensees can still capture significant value appreciation through Phase 3 completion and commercialization. This window maximizes total deal value relative to remaining development risk.',
      },
    ],
    relatedPages: [
      { slug: 'preclinical-licensing-benchmarks', title: 'Preclinical Deal Benchmarks' },
      { slug: 'phase-3-deal-benchmarks', title: 'Phase 3 Deal Benchmarks' },
      { slug: 'adc-deal-benchmarks', title: 'ADC Deal Benchmarks' },
      { slug: 'oncology-deal-benchmarks-2026', title: 'Oncology Deal Overview 2026' },
    ],
    category: 'phase',
  };
}

function buildPhase3Page(): BenchmarkPageData {
  const input = makeInput({ phase: 'phase3', modality: 'smallMolecule' as Modality, indication: 'lung_nsclc' as Indication });
  const r = calculateDealTerms(input);
  return {
    slug: 'phase-3-deal-benchmarks',
    title: 'Phase 3 Licensing Deal Benchmarks 2026 | Late-Stage Deal Terms',
    metaDescription: `Phase 3 licensing deals average ${formatCurrency(r.terms.totalDealValue.median)} total value with ${formatCurrency(r.terms.upfront.median)} upfront. Benchmark deal terms for pivotal-stage assets.`,
    h1: 'Phase 3 Licensing Deal Benchmarks',
    heroStats: buildHeroStats(r),
    contextParagraphs: [
      `Phase 3 licensing deals represent the most de-risked and highest-value segment of biopharma transactions. Median total deal values at Phase 3 reach ${formatCurrency(r.terms.totalDealValue.median)}, with upfront payments between ${formatCurrency(r.terms.upfront.low)} and ${formatCurrency(r.terms.upfront.high)}. The substantial upfronts reflect the near-term revenue potential and reduced regulatory risk of pivotal-stage assets.`,
      `Phase 3 deal structures shift toward higher upfront allocations, with a recommended ${r.dealRecommendation.upfrontPercent}/${r.dealRecommendation.milestonePercent} upfront/milestone split. Development milestones are more focused at ${formatCurrency(r.terms.devMilestones.median)}, covering Phase 3 completion and NDA/BLA filing. Regulatory milestones (${formatCurrency(r.terms.regMilestones.median)}) and commercial milestones (${formatCurrency(r.terms.commMilestones.median)}) make up the remainder.`,
      `Royalty rates at Phase 3 command premium levels of ${r.tieredRoyalties.base.low}%-${r.tieredRoyalties.base.high}%, with high-tier escalation to ${r.tieredRoyalties.highTier.high}%. The reduced risk profile justifies higher fixed royalty commitments for licensees. Assets with strong Phase 3 interim data or breakthrough therapy designation can command even higher terms.`,
    ],
    calculatorPrefill: { phase: 'phase3' },
    faqs: [
      {
        question: 'What are typical upfront payments for Phase 3 licensing deals?',
        answer: `Phase 3 deals average ${formatCurrency(r.terms.upfront.median)} in upfront payments, ranging from ${formatCurrency(r.terms.upfront.low)} to ${formatCurrency(r.terms.upfront.high)}. The higher upfront allocation (${r.dealRecommendation.upfrontPercent}% of total value) reflects the significantly de-risked profile of pivotal-stage assets.`,
      },
      {
        question: 'How are Phase 3 deal milestones structured?',
        answer: `Phase 3 deals allocate ${r.dealRecommendation.milestonePercent}% to milestones. Development milestones (${formatCurrency(r.terms.devMilestones.median)}) focus on Phase 3 completion and regulatory filing. Regulatory (${formatCurrency(r.terms.regMilestones.median)}) and commercial milestones (${formatCurrency(r.terms.commMilestones.median)}) reward approval and market success.`,
      },
      {
        question: 'Why do Phase 3 deals have higher upfront-to-milestone ratios?',
        answer: 'Phase 3 assets have already de-risked through proof-of-concept data, reducing the justification for milestone-heavy structures. Licensors leverage the near-term commercial potential and lower clinical risk to negotiate higher guaranteed payments at signing.',
      },
      {
        question: 'What factors drive premium Phase 3 deal terms?',
        answer: 'Premium factors include strong interim efficacy data, breakthrough therapy designation, first-in-class mechanism, favorable safety profile versus standard of care, clear competitive advantage, and large addressable patient population. Assets with accelerated regulatory pathways command the highest premiums.',
      },
    ],
    relatedPages: [
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
      { slug: 'preclinical-licensing-benchmarks', title: 'Preclinical Deal Benchmarks' },
      { slug: 'lung-nsclc-licensing-terms', title: 'Lung NSCLC Deal Terms' },
      { slug: 'oncology-deal-benchmarks-2026', title: 'Oncology Deal Overview 2026' },
    ],
    category: 'phase',
  };
}

function buildOncologyOverviewPage(): BenchmarkPageData {
  const p2 = calculateDealTerms(makeInput({ phase: 'phase2', modality: 'adc' as Modality, indication: 'lung_nsclc' as Indication }));
  const p1 = calculateDealTerms(makeInput({ phase: 'phase1', modality: 'carT_heme' as Modality, indication: 'dlbcl' as Indication }));
  const p3 = calculateDealTerms(makeInput({ phase: 'phase3', modality: 'smallMolecule' as Modality, indication: 'breast_tnbc' as Indication }));
  return {
    slug: 'oncology-deal-benchmarks-2026',
    title: 'Oncology Licensing Deal Benchmarks 2026 | Complete Market Overview',
    metaDescription: `Comprehensive 2026 oncology licensing deal benchmarks across ADCs, CAR-T, bispecifics, and all clinical stages. Data-driven analysis of upfronts, milestones, and royalties.`,
    h1: 'Oncology Licensing Deal Benchmarks 2026',
    heroStats: [
      {
        label: 'Phase 2 ADC (Median)',
        value: formatCurrency(p2.terms.totalDealValue.median),
        subtext: 'Total deal value',
      },
      {
        label: 'Phase 1 CAR-T (Median)',
        value: formatCurrency(p1.terms.totalDealValue.median),
        subtext: 'Total deal value',
      },
      {
        label: 'Phase 3 Small Molecule',
        value: formatCurrency(p3.terms.totalDealValue.median),
        subtext: 'Total deal value',
      },
      {
        label: 'ADC Royalty Range',
        value: `${p2.tieredRoyalties.base.low}%-${p2.tieredRoyalties.base.high}%`,
        subtext: 'Base tier rates',
      },
    ],
    contextParagraphs: [
      `The 2026 oncology licensing market continues to be driven by innovation in antibody-drug conjugates, bispecific antibodies, radiopharmaceuticals, and cell therapies. Phase 2 ADC deals lead in total deal value at ${formatCurrency(p2.terms.totalDealValue.median)} median, while Phase 1 CAR-T transactions command ${formatCurrency(p1.terms.totalDealValue.median)} on the strength of clinical proof of concept in hematologic malignancies. Phase 3 small molecule deals average ${formatCurrency(p3.terms.totalDealValue.median)} with the highest upfront ratios.`,
      `Deal structures across oncology modalities share common patterns but diverge in key areas. ADC and bispecific deals are characterized by higher development milestone allocations due to manufacturing and formulation complexity. CAR-T and gene therapy deals feature longer milestone schedules reflecting extended development timelines. Small molecules and naked antibodies follow more traditional milestone structures.`,
      `Royalty rates in oncology licensing have stabilized in the ${p2.tieredRoyalties.base.low}%-${p2.tieredRoyalties.base.high}% range at the base tier for most modalities, with tiered escalation rewarding blockbuster commercial performance. The most competitive pressure on royalty rates comes from crowded IO-combination and kinase inhibitor spaces, while novel modalities with limited competition command premium rates.`,
    ],
    calculatorPrefill: { phase: 'phase2' },
    faqs: [
      {
        question: 'What are the highest-value oncology deal modalities in 2026?',
        answer: `ADCs, radiopharmaceuticals, and CAR-T cell therapies command the highest total deal values in oncology. Phase 2 ADC deals average ${formatCurrency(p2.terms.totalDealValue.median)}, while Phase 1 CAR-T deals reach ${formatCurrency(p1.terms.totalDealValue.median)}, reflecting the transformative clinical potential and manufacturing barriers of these modalities.`,
      },
      {
        question: 'How do oncology deal terms vary by clinical stage?',
        answer: `Oncology deal values increase significantly with clinical de-risking. Phase 3 assets command approximately ${formatCurrency(p3.terms.totalDealValue.median)} with ${formatCurrency(p3.terms.upfront.median)} upfronts, while preclinical assets trade at substantially lower multiples. The optimal licensing window for most oncology assets is Phase 2 after proof-of-concept data.`,
      },
      {
        question: 'What oncology indications command the highest deal values?',
        answer: 'NSCLC, breast cancer (particularly TNBC), and multiple myeloma are the most actively transacted oncology indications. NSCLC commands premium valuations due to market size, while rare cancers (cholangiocarcinoma, mesothelioma) can achieve high deal values through orphan drug pathways and limited competition.',
      },
      {
        question: 'What trends are shaping oncology licensing in 2026?',
        answer: 'Key trends include the continued ADC premium driven by next-generation payloads and targets, growing demand for radiopharmaceutical assets, increased deal activity in bispecific platforms, and the emergence of bispecific-ADC and combination IO approaches. Biomarker-selected strategies continue to drive premium valuations across all modalities.',
      },
    ],
    relatedPages: [
      { slug: 'adc-deal-benchmarks', title: 'ADC Deal Benchmarks' },
      { slug: 'car-t-deal-benchmarks', title: 'CAR-T Cell Therapy Deals' },
      { slug: 'bispecific-antibody-deal-benchmarks', title: 'Bispecific Antibody Deals' },
      { slug: 'neurology-cns-deal-benchmarks', title: 'Neurology & CNS Deals' },
    ],
    category: 'overview',
  };
}

function buildNeurologyOverviewPage(): BenchmarkPageData {
  const alz = calculateDealTerms(makeInput({
    therapeuticArea: 'neurology',
    indication: 'alzheimers' as Indication,
    phase: 'phase2',
    modality: 'mab' as Modality,
    treatmentApproach: 'diseaseModifying',
    bbbPenetration: 'promisingPreclinical',
    diseaseProgression: 'slowProgressive',
    biomarkerValidation: 'exploratory',
  }));
  const park = calculateDealTerms(makeInput({
    therapeuticArea: 'neurology',
    indication: 'parkinsons' as Indication,
    phase: 'phase2',
    modality: 'smallMolecule' as Modality,
    treatmentApproach: 'diseaseModifying',
    bbbPenetration: 'provenCNS',
    diseaseProgression: 'moderateProgressive',
    biomarkerValidation: 'exploratory',
  }));
  const pain = calculateDealTerms(makeInput({
    therapeuticArea: 'neurology',
    indication: 'pain' as Indication,
    phase: 'phase2',
    modality: 'smallMolecule' as Modality,
    treatmentApproach: 'symptomatic',
    bbbPenetration: 'provenCNS',
    diseaseProgression: 'episodic',
    biomarkerValidation: 'noBiomarker',
  }));
  return {
    slug: 'neurology-cns-deal-benchmarks',
    title: 'Neurology & CNS Licensing Deal Benchmarks 2026 | Complete Overview',
    metaDescription: `Comprehensive 2026 neurology and CNS licensing deal benchmarks. Alzheimer's, Parkinson's, pain, and psychiatric disorder deal terms analyzed.`,
    h1: 'Neurology & CNS Licensing Deal Benchmarks 2026',
    heroStats: [
      {
        label: "Alzheimer's (Phase 2)",
        value: formatCurrency(alz.terms.totalDealValue.median),
        subtext: 'Disease-modifying mAb',
      },
      {
        label: "Parkinson's (Phase 2)",
        value: formatCurrency(park.terms.totalDealValue.median),
        subtext: 'Disease-modifying SM',
      },
      {
        label: 'Pain (Phase 2)',
        value: formatCurrency(pain.terms.totalDealValue.median),
        subtext: 'Symptomatic treatment',
      },
      {
        label: 'Neurology Royalties',
        value: `${alz.tieredRoyalties.base.low}%-${alz.tieredRoyalties.base.high}%`,
        subtext: 'Base tier range',
      },
    ],
    contextParagraphs: [
      `The neurology and CNS licensing landscape in 2026 is characterized by renewed optimism following breakthroughs in Alzheimer's disease-modifying therapies and advances in blood-brain barrier penetration technologies. Alzheimer's Phase 2 deals lead in deal value at ${formatCurrency(alz.terms.totalDealValue.median)} median, while Parkinson's disease-modifying approaches command ${formatCurrency(park.terms.totalDealValue.median)}. Pain therapeutics remain active at ${formatCurrency(pain.terms.totalDealValue.median)} with differentiated non-opioid mechanisms.`,
      `CNS deal structures are distinctively milestone-weighted compared to oncology, reflecting longer development timelines, complex clinical endpoints (cognitive scales, functional assessments), and historically lower approval rates. Disease-modifying therapies carry the highest milestone potential due to the extended pivotal trial durations (3-5 years) and the transformative commercial opportunity if endpoints are met.`,
      `Royalty rates in neurology licensing range from ${alz.tieredRoyalties.base.low}% to ${alz.tieredRoyalties.base.high}% at the base tier, with variations driven by BBB penetration data, disease-modification evidence, and competitive positioning. Key valuation differentiators unique to CNS include demonstrated brain penetration, biomarker-based patient selection, and pathway de-risking through novel clinical trial designs.`,
    ],
    calculatorPrefill: { therapeuticArea: 'neurology', phase: 'phase2' },
    faqs: [
      {
        question: 'How do neurology deal terms compare to oncology?',
        answer: `Neurology deal total values are generally competitive with oncology when comparing equivalent stages and modalities. However, neurology deals allocate a higher proportion to milestones due to longer development timelines and higher clinical risk. Alzheimer's Phase 2 deals (${formatCurrency(alz.terms.totalDealValue.median)}) are comparable to many oncology Phase 2 transactions.`,
      },
      {
        question: 'What neurology indications command the highest deal values?',
        answer: `Alzheimer's disease-modifying therapies lead at ${formatCurrency(alz.terms.totalDealValue.median)}, followed by Parkinson's disease (${formatCurrency(park.terms.totalDealValue.median)}) and novel pain therapies (${formatCurrency(pain.terms.totalDealValue.median)}). Rare neurological disorders can command premium valuations through orphan drug pathways.`,
      },
      {
        question: 'What role does BBB penetration play in CNS deal valuations?',
        answer: 'Blood-brain barrier penetration is a critical valuation driver in CNS deals. Assets with proven CNS penetration command 20-30% premium over those with unproven BBB data. Novel BBB delivery platforms (including brain shuttle technologies and focused ultrasound approaches) are attracting significant platform deal interest.',
      },
      {
        question: 'What trends are shaping neurology licensing in 2026?',
        answer: 'Key trends include growing deal activity in disease-modifying neurodegeneration therapies, emergence of psychedelic-derived therapeutics for psychiatric conditions, increased interest in digital biomarker endpoints, and platform deals for BBB delivery technologies. Gene therapy and ASO approaches for rare neurological diseases are also commanding premium terms.',
      },
    ],
    relatedPages: [
      { slug: 'alzheimers-licensing-deals', title: "Alzheimer's Disease Deals" },
      { slug: 'gene-therapy-deal-benchmarks', title: 'Gene Therapy Deals' },
      { slug: 'oncology-deal-benchmarks-2026', title: 'Oncology Deal Overview 2026' },
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
    ],
    category: 'overview',
  };
}

function buildMetabolicOverviewPage(): BenchmarkPageData {
  const obesity = calculateDealTerms(makeInput({
    therapeuticArea: 'metabolic',
    modality: 'glp1Agonist' as Modality,
    indication: 'obesity' as Indication,
  }));
  const mash = calculateDealTerms(makeInput({
    therapeuticArea: 'metabolic',
    modality: 'smallMolecule' as Modality,
    indication: 'nashMash' as Indication,
  }));
  const oralGlp1 = calculateDealTerms(makeInput({
    therapeuticArea: 'metabolic',
    modality: 'oralPeptide' as Modality,
    indication: 'obesity' as Indication,
  }));
  return {
    slug: 'metabolic-obesity-deal-benchmarks-2026',
    title: 'Metabolic & Obesity Licensing Deal Benchmarks 2026 | GLP-1 & Beyond',
    metaDescription: `Comprehensive 2026 metabolic and obesity licensing deal benchmarks. GLP-1 agonists, dual incretins, oral peptides, and MASH deal terms analyzed from 35+ R&D partnerships.`,
    h1: 'Metabolic & Obesity Deal Benchmarks 2026',
    heroStats: buildHeroStats(obesity),
    contextParagraphs: [
      `The metabolic/obesity therapeutic area has become the most commercially valuable segment in biopharma. Semaglutide (Wegovy/Ozempic) became the fastest drug to $20B annual revenue in pharma history, while tirzepatide (Mounjaro/Zepbound) demonstrated 22.5% weight loss — competitive with bariatric surgery.`,
      `Obesity licensing deals in 2025 have reached unprecedented levels. The AstraZeneca/CSPC deal at $18.5B headline value and Pfizer/Metsera at $9.8B demonstrate the massive premiums pharma companies are willing to pay for differentiated metabolic assets. Oral formulations, dual/triple incretins, and muscle-sparing approaches command the highest deal values.`,
      `GLP-1 obesity deals at Phase 2 typically command ${formatCurrency(obesity.terms.upfront.median)} upfront (range ${formatCurrency(obesity.terms.upfront.low)} - ${formatCurrency(obesity.terms.upfront.high)}), while oral peptide assets attract ${formatCurrency(oralGlp1.terms.upfront.median)} upfront reflecting the oral delivery premium. NASH/MASH assets following resmetirom's approval see ${formatCurrency(mash.terms.upfront.median)} upfront.`,
    ],
    calculatorPrefill: { therapeuticArea: 'metabolic', modality: 'glp1Agonist', indication: 'obesity' },
    faqs: [
      {
        question: 'How much are GLP-1 obesity licensing deals worth in 2026?',
        answer: `Phase 2 GLP-1 agonist deals for obesity typically have total deal values of ${formatCurrency(obesity.terms.totalDealValue.low)} - ${formatCurrency(obesity.terms.totalDealValue.high)}, with upfronts of ${formatCurrency(obesity.terms.upfront.median)}. Oral formulations command 20-30% premiums over injectable equivalents.`,
      },
      {
        question: 'What royalty rates do metabolic deals command?',
        answer: `Base royalties for metabolic deals range from ${obesity.tieredRoyalties.base.low}% to ${obesity.tieredRoyalties.base.high}%, tiering up to ${obesity.tieredRoyalties.highTier.high}% at peak sales. The enormous commercial potential of obesity drugs drives aggressive tiered royalty structures.`,
      },
      {
        question: 'How do oral obesity drug deals compare to injectables?',
        answer: `Oral metabolic drugs command significant premiums. Oral peptide deals average ${formatCurrency(oralGlp1.terms.totalDealValue.median)} total deal value vs ${formatCurrency(obesity.terms.totalDealValue.median)} for injectable GLP-1s. The oral convenience advantage drives patient preference, primary care adoption, and payer formulary access.`,
      },
    ],
    relatedPages: [
      { slug: 'glp1-obesity-deal-benchmarks-2026', title: 'GLP-1 Obesity Deal Benchmarks' },
      { slug: 'dual-incretin-deal-benchmarks-2026', title: 'Dual & Triple Incretin Deals' },
      { slug: 'nash-mash-deal-benchmarks-2026', title: 'NASH/MASH Deal Benchmarks' },
      { slug: 'oral-peptide-obesity-deal-benchmarks-2026', title: 'Oral Peptide Deal Benchmarks' },
    ],
    category: 'overview',
  };
}

function buildGLP1ObesityPage(): BenchmarkPageData {
  const injectable = calculateDealTerms(makeInput({
    therapeuticArea: 'metabolic',
    modality: 'glp1Agonist' as Modality,
    indication: 'obesity' as Indication,
  }));
  const oral = calculateDealTerms(makeInput({
    therapeuticArea: 'metabolic',
    modality: 'oralPeptide' as Modality,
    indication: 'obesity' as Indication,
  }));
  return {
    slug: 'glp1-obesity-deal-benchmarks-2026',
    title: 'GLP-1 Agonist Obesity Licensing Deal Benchmarks 2026 | Semaglutide & Beyond',
    metaDescription: `GLP-1 agonist obesity deals average ${formatCurrency(injectable.terms.totalDealValue.median)} total value at Phase 2. Compare injectable vs oral GLP-1 deal terms, upfronts, milestones, and royalties.`,
    h1: 'GLP-1 Agonist Obesity Deal Benchmarks 2026',
    heroStats: buildHeroStats(injectable),
    contextParagraphs: [
      `GLP-1 receptor agonists have become the defining drug class of the decade. Semaglutide (Wegovy/Ozempic) generated $20B+ in annual revenue by 2025, making it the fastest drug to that milestone in pharma history. Tirzepatide (Mounjaro/Zepbound) achieved 22.5% weight loss in clinical trials, approaching bariatric surgery efficacy without the surgical risk.`,
      `Phase 2 GLP-1 agonist licensing deals for obesity carry median upfront payments of ${formatCurrency(injectable.terms.upfront.median)} (range ${formatCurrency(injectable.terms.upfront.low)} - ${formatCurrency(injectable.terms.upfront.high)}), with total deal values reaching ${formatCurrency(injectable.terms.totalDealValue.median)}. The CSPC/AstraZeneca deal at $18.5B headline value and Carmot/Roche acquisition at $2.7B set the high-water marks for the category.`,
      `Oral GLP-1 formulations command significant premiums: ${formatCurrency(oral.terms.upfront.median)} upfront vs ${formatCurrency(injectable.terms.upfront.median)} for injectables. The oral convenience advantage drives patient preference, primary care adoption, and payer formulary access — making oral GLP-1 assets the most sought-after in biopharma.`,
    ],
    calculatorPrefill: { therapeuticArea: 'metabolic', modality: 'glp1Agonist', indication: 'obesity' },
    faqs: [
      {
        question: 'How much are GLP-1 obesity deals worth in 2026?',
        answer: `Phase 2 injectable GLP-1 deals average ${formatCurrency(injectable.terms.totalDealValue.median)} total deal value with ${formatCurrency(injectable.terms.upfront.median)} upfront. Oral GLP-1 assets command 20-30% premiums, averaging ${formatCurrency(oral.terms.totalDealValue.median)} total value.`,
      },
      {
        question: 'What royalty rates do GLP-1 obesity deals command?',
        answer: `GLP-1 obesity royalties range from ${injectable.tieredRoyalties.base.low}%-${injectable.tieredRoyalties.base.high}% base tier, escalating to ${injectable.tieredRoyalties.highTier.high}% at peak sales. The $100B+ projected obesity market drives aggressive tiered royalty structures.`,
      },
      {
        question: 'How do oral GLP-1 deals compare to injectable GLP-1 deals?',
        answer: `Oral GLP-1 deals command 20-30% premiums over injectable equivalents. Oral formulations average ${formatCurrency(oral.terms.upfront.median)} upfront vs ${formatCurrency(injectable.terms.upfront.median)} for injectables, reflecting the oral convenience advantage for patient adherence and primary care adoption.`,
      },
    ],
    relatedPages: [
      { slug: 'metabolic-obesity-deal-benchmarks-2026', title: 'Metabolic & Obesity Overview' },
      { slug: 'dual-incretin-deal-benchmarks-2026', title: 'Dual Incretin Deal Benchmarks' },
      { slug: 'nash-mash-deal-benchmarks-2026', title: 'NASH/MASH Deal Benchmarks' },
    ],
    category: 'modality',
  };
}

function buildDualIncretinPage(): BenchmarkPageData {
  const dual = calculateDealTerms(makeInput({
    therapeuticArea: 'metabolic',
    modality: 'dualIncretin' as Modality,
    indication: 'obesity' as Indication,
  }));
  const triple = calculateDealTerms(makeInput({
    therapeuticArea: 'metabolic',
    modality: 'tripleIncretin' as Modality,
    indication: 'obesity' as Indication,
  }));
  return {
    slug: 'dual-incretin-deal-benchmarks-2026',
    title: 'Dual & Triple Incretin Deal Benchmarks 2026 | GLP-1/GIP/Glucagon',
    metaDescription: `Dual incretin (GLP-1/GIP) deals average ${formatCurrency(dual.terms.totalDealValue.median)} total value. Compare dual vs triple agonist deal terms and benchmarks.`,
    h1: 'Dual & Triple Incretin Deal Benchmarks 2026',
    heroStats: buildHeroStats(dual),
    contextParagraphs: [
      `Dual and triple incretin agonists represent the next frontier in obesity therapeutics. Tirzepatide (GLP-1/GIP dual agonist) demonstrated category-leading 22.5% weight loss, while retatrutide (GLP-1/GIP/glucagon triple agonist) achieved 24.2% weight loss in Phase 2 — the highest in any obesity trial. These multi-receptor approaches consistently outperform single-receptor GLP-1 agonists.`,
      `Phase 2 dual incretin licensing deals command median upfront payments of ${formatCurrency(dual.terms.upfront.median)}, with total deal values of ${formatCurrency(dual.terms.totalDealValue.median)}. Triple agonists push even higher at ${formatCurrency(triple.terms.totalDealValue.median)} total value, reflecting the frontier premium and superior clinical data potential.`,
      `The Carmot/Roche acquisition at $2.7B for CT-388 (a GLP-1/GIP/FGF21 triple agonist at Phase 1) demonstrated the massive premium pharma will pay for next-generation multi-receptor approaches. Development milestones average ${formatCurrency(dual.terms.devMilestones.median)}, with commercial milestones reaching ${formatCurrency(dual.terms.commMilestones.median)}.`,
    ],
    calculatorPrefill: { therapeuticArea: 'metabolic', modality: 'dualIncretin', indication: 'obesity' },
    faqs: [
      {
        question: 'What are dual incretin deals worth in 2026?',
        answer: `Phase 2 dual incretin deals average ${formatCurrency(dual.terms.totalDealValue.median)} total value with ${formatCurrency(dual.terms.upfront.median)} upfront. Triple incretins command an additional premium at ${formatCurrency(triple.terms.totalDealValue.median)} total value.`,
      },
      {
        question: 'How do dual incretins compare to single GLP-1 agonists?',
        answer: `Dual incretins (GLP-1/GIP) command 10-15% premiums over single GLP-1 agonists, driven by tirzepatide's superior clinical results. The multi-receptor mechanism provides better weight loss efficacy and broader metabolic benefits.`,
      },
      {
        question: 'What milestone structures do incretin deals use?',
        answer: `Dual incretin deals allocate heavily toward commercial milestones (${formatCurrency(dual.terms.commMilestones.median)}) given the massive market opportunity. Development milestones (${formatCurrency(dual.terms.devMilestones.median)}) reflect the clinical de-risking required to demonstrate superiority over existing GLP-1s.`,
      },
    ],
    relatedPages: [
      { slug: 'glp1-obesity-deal-benchmarks-2026', title: 'GLP-1 Obesity Deal Benchmarks' },
      { slug: 'metabolic-obesity-deal-benchmarks-2026', title: 'Metabolic & Obesity Overview' },
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
    ],
    category: 'modality',
  };
}

function buildNashMashPage(): BenchmarkPageData {
  const mash = calculateDealTerms(makeInput({
    therapeuticArea: 'metabolic',
    modality: 'smallMolecule' as Modality,
    indication: 'nashMash' as Indication,
  }));
  const mashBiologic = calculateDealTerms(makeInput({
    therapeuticArea: 'metabolic',
    modality: 'glp1Agonist' as Modality,
    indication: 'nashMash' as Indication,
  }));
  return {
    slug: 'nash-mash-deal-benchmarks-2026',
    title: 'NASH/MASH Licensing Deal Benchmarks 2026 | Liver Disease Deal Terms',
    metaDescription: `NASH/MASH licensing deals average ${formatCurrency(mash.terms.totalDealValue.median)} total value. Benchmark deal terms for steatohepatitis therapies following resmetirom approval.`,
    h1: 'NASH/MASH Deal Benchmarks 2026',
    heroStats: buildHeroStats(mash),
    contextParagraphs: [
      `The NASH/MASH therapeutic landscape was transformed by resmetirom's (Rezdiffra) FDA approval in March 2024 — the first approved therapy for metabolic dysfunction-associated steatohepatitis. This validated the category and unlocked a wave of licensing deals. Madrigal Pharmaceuticals' market cap exceeded $7B on approval, setting the commercial benchmark for the class.`,
      `Phase 2 MASH small molecule deals command median upfront payments of ${formatCurrency(mash.terms.upfront.median)}, with total deal values of ${formatCurrency(mash.terms.totalDealValue.median)}. GLP-1-based MASH approaches (leveraging semaglutide's MASH data) push even higher at ${formatCurrency(mashBiologic.terms.totalDealValue.median)} total value, reflecting the dual obesity/MASH opportunity.`,
      `Key deal drivers include fibrosis improvement data (F2-F3 reversal), combination strategies with GLP-1 agonists, and the massive undiagnosed patient population (estimated 6-8M in the US alone). Efruxifermin (FGF21 agonist) was acquired by Novo Nordisk for $1.4B, while survodutide (GLP-1/glucagon dual agonist) is being developed by Boehringer Ingelheim in a $1.6B partnership with Zealand.`,
    ],
    calculatorPrefill: { therapeuticArea: 'metabolic', modality: 'smallMolecule', indication: 'nashMash' },
    faqs: [
      {
        question: 'What are MASH deals worth after resmetirom approval?',
        answer: `Phase 2 MASH deals average ${formatCurrency(mash.terms.totalDealValue.median)} total value. The resmetirom approval validated the category, increasing deal premiums 20-30% compared to pre-approval benchmarks.`,
      },
      {
        question: 'How do MASH deal terms compare to obesity deals?',
        answer: `MASH deals command slightly lower valuations than pure obesity plays due to smaller addressable populations, but assets with dual obesity/MASH potential (like GLP-1-based approaches at ${formatCurrency(mashBiologic.terms.totalDealValue.median)} total value) attract premium terms.`,
      },
      {
        question: 'What endpoints matter most for MASH deal valuations?',
        answer: `Fibrosis improvement (F2-F3 reversal without worsening MASH) is the gold-standard endpoint. Resolution of MASH without worsening fibrosis is also valued. Combination data with GLP-1 agonists can significantly increase deal premiums.`,
      },
    ],
    relatedPages: [
      { slug: 'metabolic-obesity-deal-benchmarks-2026', title: 'Metabolic & Obesity Overview' },
      { slug: 'glp1-obesity-deal-benchmarks-2026', title: 'GLP-1 Obesity Deal Benchmarks' },
      { slug: 'small-molecule-deal-benchmarks', title: 'Small Molecule Deal Benchmarks' },
    ],
    category: 'indication',
  };
}

function buildOralPeptidePage(): BenchmarkPageData {
  const oral = calculateDealTerms(makeInput({
    therapeuticArea: 'metabolic',
    modality: 'oralPeptide' as Modality,
    indication: 'obesity' as Indication,
  }));
  const oralT2D = calculateDealTerms(makeInput({
    therapeuticArea: 'metabolic',
    modality: 'oralPeptide' as Modality,
    indication: 'type2Diabetes' as Indication,
  }));
  return {
    slug: 'oral-peptide-obesity-deal-benchmarks-2026',
    title: 'Oral Peptide Obesity Deal Benchmarks 2026 | Oral GLP-1 Deal Terms',
    metaDescription: `Oral peptide obesity deals average ${formatCurrency(oral.terms.totalDealValue.median)} total value — 20-30% premium over injectables. Benchmark oral GLP-1 deal terms.`,
    h1: 'Oral Peptide & Oral GLP-1 Deal Benchmarks 2026',
    heroStats: buildHeroStats(oral),
    contextParagraphs: [
      `Oral peptide delivery is the "holy grail" of the obesity market. Oral semaglutide (Rybelsus) proved the concept with $2B+ annual revenue, but next-generation oral peptides aim for weight loss efficacy approaching injectable levels. The Pfizer/Metsera deal at $9.8B headline value for an oral obesity peptide demonstrated the massive premium pharma companies place on oral convenience.`,
      `Phase 2 oral peptide obesity deals command median upfronts of ${formatCurrency(oral.terms.upfront.median)} — a 20-30% premium over injectable GLP-1 equivalents. Total deal values reach ${formatCurrency(oral.terms.totalDealValue.median)}. The oral premium reflects the transformative impact on patient adherence, primary care prescribing, and payer formulary positioning.`,
      `Oral peptide deals for type 2 diabetes average ${formatCurrency(oralT2D.terms.totalDealValue.median)} total value, while obesity-focused oral deals command higher premiums. Royalty rates range from ${oral.tieredRoyalties.base.low}%-${oral.tieredRoyalties.base.high}% base, escalating to ${oral.tieredRoyalties.highTier.high}% at peak sales thresholds reflecting the enormous commercial opportunity.`,
    ],
    calculatorPrefill: { therapeuticArea: 'metabolic', modality: 'oralPeptide', indication: 'obesity' },
    faqs: [
      {
        question: 'Why do oral obesity drugs command premium deal terms?',
        answer: `Oral formulations command 20-30% premiums over injectable equivalents. Median upfronts reach ${formatCurrency(oral.terms.upfront.median)} vs lower for injectables. The premium reflects improved patient compliance, primary care adoption, and competitive positioning against injectable-only competitors.`,
      },
      {
        question: 'What is the market opportunity for oral GLP-1 drugs?',
        answer: `The oral obesity market is projected to capture 30-40% of the $100B+ total obesity market by 2030. Oral convenience dramatically expands the addressable patient population from specialist-managed injectable users to primary care patients.`,
      },
      {
        question: 'What are key risks for oral peptide deals?',
        answer: `Key risks include bioavailability challenges (oral peptides typically have <2% bioavailability), food-effect interactions requiring fasting, GI tolerability concerns, and manufacturing complexity. Formulation innovations that solve these challenges command the highest premiums.`,
      },
    ],
    relatedPages: [
      { slug: 'glp1-obesity-deal-benchmarks-2026', title: 'GLP-1 Obesity Deal Benchmarks' },
      { slug: 'metabolic-obesity-deal-benchmarks-2026', title: 'Metabolic & Obesity Overview' },
      { slug: 'small-molecule-deal-benchmarks', title: 'Small Molecule Deal Benchmarks' },
    ],
    category: 'modality',
  };
}

// ── Build full list ───────────────────────────────────────────────────────────

const BENCHMARK_PAGES: BenchmarkPageData[] = [
  buildADCPage(),
  buildCARTPage(),
  buildBispecificPage(),
  buildRadiopharmaPage(),
  buildGeneTherapyPage(),
  buildSmallMoleculePage(),
  buildLungNSCLCPage(),
  buildBreastCancerPage(),
  buildAlzheimersPage(),
  buildMyelomaPage(),
  buildPreclinicalPage(),
  buildPhase2Page(),
  buildPhase3Page(),
  buildOncologyOverviewPage(),
  buildNeurologyOverviewPage(),
  buildMetabolicOverviewPage(),
  buildGLP1ObesityPage(),
  buildDualIncretinPage(),
  buildNashMashPage(),
  buildOralPeptidePage(),
];

// ── Public API ────────────────────────────────────────────────────────────────

export function getAllBenchmarkPages(): BenchmarkPageData[] {
  return BENCHMARK_PAGES;
}

export function getBenchmarkBySlug(slug: string): BenchmarkPageData | undefined {
  return BENCHMARK_PAGES.find((p) => p.slug === slug);
}

export function getAllBenchmarkSlugs(): string[] {
  return BENCHMARK_PAGES.map((p) => p.slug);
}
