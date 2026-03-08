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

// ── Rare Disease pages ────────────────────────────────────────────────────────

function buildRareDiseaseOverviewPage(): BenchmarkPageData {
  const sma = calculateDealTerms(makeInput({
    therapeuticArea: 'rareDisease',
    modality: 'geneTherapyRare' as Modality,
    indication: 'spinalMuscularAtrophy' as Indication,
    phase: 'phase2',
    regulatoryDesignations: { breakthrough: true, fastTrack: true, orphan: true, prime: false },
  }));
  const fabry = calculateDealTerms(makeInput({
    therapeuticArea: 'rareDisease',
    modality: 'enzymeReplacement' as Modality,
    indication: 'fabryDisease' as Indication,
    phase: 'phase2',
    regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: true, prime: false },
  }));
  const dmd = calculateDealTerms(makeInput({
    therapeuticArea: 'rareDisease',
    modality: 'geneTherapyRare' as Modality,
    indication: 'duchenneMD' as Indication,
    phase: 'phase1',
    regulatoryDesignations: { breakthrough: false, fastTrack: true, orphan: true, prime: false },
  }));
  return {
    slug: 'rare-disease-licensing-benchmarks',
    title: 'Rare Disease Licensing Deal Benchmarks 2026 | Orphan Drug Deal Terms',
    metaDescription: `Rare disease licensing deals average ${formatCurrency(sma.terms.totalDealValue.median)} total value at Phase 2 with orphan drug designation. Benchmark upfronts, milestones, and royalties across gene therapy, ERT, and substrate reduction.`,
    h1: 'Rare Disease Licensing Deal Benchmarks 2026',
    heroStats: [
      {
        label: 'Gene Therapy (Phase 2)',
        value: formatCurrency(sma.terms.totalDealValue.median),
        subtext: 'SMA gene therapy',
      },
      {
        label: 'ERT (Phase 2)',
        value: formatCurrency(fabry.terms.totalDealValue.median),
        subtext: 'Fabry disease ERT',
      },
      {
        label: 'Gene Therapy (Phase 1)',
        value: formatCurrency(dmd.terms.totalDealValue.median),
        subtext: 'DMD gene therapy',
      },
      {
        label: 'Orphan Royalties',
        value: `${sma.tieredRoyalties.base.low}%-${sma.tieredRoyalties.base.high}%`,
        subtext: 'Base tier range',
      },
    ],
    contextParagraphs: [
      `Rare disease licensing has become one of the most attractive segments in biopharma deal-making, driven by orphan drug exclusivity, accelerated regulatory pathways, and premium pricing. Phase 2 gene therapy deals for rare diseases carry a median total deal value of ${formatCurrency(sma.terms.totalDealValue.median)}, while enzyme replacement therapy deals reach ${formatCurrency(fabry.terms.totalDealValue.median)}. Orphan drug designation provides 7 years of market exclusivity in the US and 10 years in the EU, underpinning strong deal economics.`,
      `Deal structures in rare disease reflect the unique commercial dynamics of small patient populations and high per-patient revenue. Development milestones average ${formatCurrency(sma.terms.devMilestones.median)} for gene therapy approaches, with regulatory milestones of ${formatCurrency(sma.terms.regMilestones.median)} rewarding the accelerated approval pathways frequently available to orphan drugs. Commercial milestones of ${formatCurrency(sma.terms.commMilestones.median)} are structured around patient penetration rather than traditional revenue thresholds.`,
      `Royalty rates for rare disease licensing range from ${sma.tieredRoyalties.base.low}% to ${sma.tieredRoyalties.base.high}% at the base tier, reflecting the premium pricing power ($200K-$3M+ per patient annually for ERTs and gene therapies) and limited generic/biosimilar competition during the orphan exclusivity period. Assets with breakthrough therapy designation command additional premiums of 15-25% in deal terms.`,
    ],
    calculatorPrefill: { therapeuticArea: 'rareDisease', phase: 'phase2' },
    faqs: [
      {
        question: 'What are typical deal terms for rare disease licensing?',
        answer: `Phase 2 rare disease gene therapy deals average ${formatCurrency(sma.terms.upfront.median)} upfront with ${formatCurrency(sma.terms.totalDealValue.median)} total deal value. Orphan drug designation and breakthrough therapy status significantly enhance deal premiums, with designated assets commanding 15-25% higher total deal values.`,
      },
      {
        question: 'How does orphan drug status affect deal valuations?',
        answer: 'Orphan drug designation provides 7 years of US market exclusivity and tax credits for clinical development costs. These protections significantly de-risk the commercial proposition, enabling premium pricing ($200K-$3M+ per patient) and reducing competitive pressure, both of which drive higher deal valuations.',
      },
      {
        question: 'Which rare disease modalities command the highest deal values?',
        answer: `Gene therapy approaches lead in total deal value (${formatCurrency(sma.terms.totalDealValue.median)} at Phase 2) due to curative potential and one-time treatment economics. Enzyme replacement therapies (${formatCurrency(fabry.terms.totalDealValue.median)}) provide recurring revenue models, while substrate reduction therapies offer oral convenience advantages.`,
      },
      {
        question: 'What royalty rates are standard for rare disease licensing?',
        answer: `Base royalty rates of ${sma.tieredRoyalties.base.low}%-${sma.tieredRoyalties.base.high}% for rare disease deals are at the higher end of biopharma ranges, reflecting premium pricing power and limited competition. Tiered royalties can escalate to ${sma.tieredRoyalties.highTier.high}% at peak sales.`,
      },
    ],
    relatedPages: [
      { slug: 'gene-therapy-rare-disease-deal-benchmarks', title: 'Gene Therapy Rare Disease Deals' },
      { slug: 'enzyme-replacement-therapy-deal-benchmarks', title: 'ERT Deal Benchmarks' },
      { slug: 'gene-therapy-deal-benchmarks', title: 'Gene Therapy Deals' },
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
    ],
    category: 'overview',
  };
}

function buildGeneTherapyRareDiseasePage(): BenchmarkPageData {
  const input = makeInput({
    therapeuticArea: 'rareDisease',
    modality: 'geneTherapyRare' as Modality,
    indication: 'spinalMuscularAtrophy' as Indication,
    phase: 'phase1',
    regulatoryDesignations: { breakthrough: true, fastTrack: true, orphan: true, prime: false },
  });
  const r = calculateDealTerms(input);
  return {
    slug: 'gene-therapy-rare-disease-deal-benchmarks',
    title: 'Gene Therapy Rare Disease Deal Benchmarks 2026 | AAV & Gene Editing Terms',
    metaDescription: `Gene therapy rare disease deals average ${formatCurrency(r.terms.totalDealValue.median)} total value at Phase 1. Benchmark upfronts, milestones, and royalties for orphan gene therapy licensing.`,
    h1: 'Gene Therapy Rare Disease Deal Benchmarks',
    heroStats: buildHeroStats(r),
    contextParagraphs: [
      `Gene therapy for rare diseases represents the highest-value intersection of modality and therapeutic area in biopharma licensing. Phase 1 gene therapy deals for orphan indications carry a median total deal value of ${formatCurrency(r.terms.totalDealValue.median)}, with upfront payments of ${formatCurrency(r.terms.upfront.median)}. The curative one-time treatment model, combined with orphan drug exclusivity and premium pricing ($1M-$3.5M per patient), creates compelling deal economics even at early clinical stages.`,
      `Development milestones average ${formatCurrency(r.terms.devMilestones.median)}, reflecting the extensive de-risking required around vector tropism, transgene expression durability, and immunogenicity management. Regulatory milestones of ${formatCurrency(r.terms.regMilestones.median)} reward the accelerated approval pathways (surrogate endpoints, smaller trial sizes) available to orphan gene therapies. Commercial milestones reach ${formatCurrency(r.terms.commMilestones.median)}.`,
      `Royalty rates for rare disease gene therapy licensing range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}% at the base tier. The unique economics of one-time curative treatments at $1M+ price points mean that commercial milestones are often structured around patient counts and treatment center expansion rather than traditional revenue thresholds. Zolgensma ($2.1M per treatment) and Hemgenix ($3.5M per treatment) set the pricing precedent.`,
    ],
    calculatorPrefill: { therapeuticArea: 'rareDisease', phase: 'phase1', modality: 'geneTherapyRare' },
    faqs: [
      {
        question: 'What are typical deal terms for rare disease gene therapy?',
        answer: `Phase 1 rare disease gene therapy deals average ${formatCurrency(r.terms.upfront.median)} upfront with ${formatCurrency(r.terms.totalDealValue.median)} total deal value. The ${r.dealRecommendation.upfrontPercent}/${r.dealRecommendation.milestonePercent} upfront/milestone split reflects early-stage clinical risk balanced against transformative curative potential.`,
      },
      {
        question: 'How does orphan drug designation affect gene therapy deal terms?',
        answer: 'Orphan drug designation provides 7 years US market exclusivity, FDA fee waivers, and 25% tax credit on clinical trial costs. For gene therapies specifically, the limited competition window combined with $1M-$3.5M per-patient pricing creates a highly favorable commercial profile that drives premium deal valuations.',
      },
      {
        question: 'What are the key risks in rare disease gene therapy deals?',
        answer: 'Primary risks include durability of transgene expression (especially for AAV-based approaches), immunogenicity limiting re-dosing potential, manufacturing scalability of viral vectors, and payer access challenges at $1M+ price points. These risks are reflected in the milestone-weighted deal structures.',
      },
      {
        question: 'How do AAV gene therapy deals compare to gene editing deals in rare disease?',
        answer: 'AAV gene therapy deals benefit from clinical validation (Zolgensma, Hemgenix approvals) but face re-dosing limitations. Gene editing platforms (CRISPR, base editing) offer potentially permanent cures but are earlier stage. Both command similar total deal values, though gene editing platforms may attract higher upfronts due to multi-indication potential.',
      },
    ],
    relatedPages: [
      { slug: 'rare-disease-licensing-benchmarks', title: 'Rare Disease Overview' },
      { slug: 'enzyme-replacement-therapy-deal-benchmarks', title: 'ERT Deal Benchmarks' },
      { slug: 'gene-therapy-deal-benchmarks', title: 'Gene Therapy Deals (Oncology)' },
      { slug: 'preclinical-licensing-benchmarks', title: 'Preclinical Deal Benchmarks' },
    ],
    category: 'modality',
  };
}

function buildEnzymeReplacementTherapyPage(): BenchmarkPageData {
  const input = makeInput({
    therapeuticArea: 'rareDisease',
    modality: 'enzymeReplacement' as Modality,
    indication: 'fabryDisease' as Indication,
    phase: 'phase2',
    regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: true, prime: false },
  });
  const r = calculateDealTerms(input);
  return {
    slug: 'enzyme-replacement-therapy-deal-benchmarks',
    title: 'Enzyme Replacement Therapy (ERT) Deal Benchmarks 2026 | Lysosomal Storage',
    metaDescription: `ERT licensing deals average ${formatCurrency(r.terms.totalDealValue.median)} total value at Phase 2. Benchmark deal terms for enzyme replacement therapies targeting Fabry, Gaucher, and Pompe disease.`,
    h1: 'Enzyme Replacement Therapy Deal Benchmarks',
    heroStats: buildHeroStats(r),
    contextParagraphs: [
      `Enzyme replacement therapies remain the backbone of lysosomal storage disorder treatment, generating $8B+ annually across Fabry, Gaucher, Pompe, and MPS indications. Phase 2 ERT deals carry a median total deal value of ${formatCurrency(r.terms.totalDealValue.median)}, with upfront payments of ${formatCurrency(r.terms.upfront.median)}. The recurring revenue model (lifelong treatment at $200K-$500K per patient annually) and orphan drug protections drive strong licensing economics.`,
      `ERT deal structures reflect the predictable revenue model of chronic therapy. Development milestones average ${formatCurrency(r.terms.devMilestones.median)}, with regulatory milestones of ${formatCurrency(r.terms.regMilestones.median)} and commercial milestones of ${formatCurrency(r.terms.commMilestones.median)}. The ${r.dealRecommendation.upfrontPercent}/${r.dealRecommendation.milestonePercent} upfront/milestone split balances clinical risk with the established commercial precedent in the enzyme replacement space.`,
      `Royalty rates for ERT licensing range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}%, reflecting the high per-patient revenue and limited biosimilar competition. Next-generation ERTs with improved half-life, tissue penetration, or oral bioavailability command premium terms. The competitive threat from gene therapy approaches is increasingly factored into ERT deal valuations, with licensees seeking assets that offer differentiated patient convenience or efficacy advantages.`,
    ],
    calculatorPrefill: { therapeuticArea: 'rareDisease', phase: 'phase2', modality: 'enzymeReplacement' },
    faqs: [
      {
        question: 'What are typical deal terms for ERT licensing?',
        answer: `Phase 2 ERT deals average ${formatCurrency(r.terms.upfront.median)} upfront with ${formatCurrency(r.terms.totalDealValue.median)} total deal value. The recurring revenue model ($200K-$500K per patient annually for life) provides predictable commercial economics that support strong deal valuations.`,
      },
      {
        question: 'How do ERT deals compare to gene therapy deals in rare disease?',
        answer: 'ERT deals typically feature lower total deal values than gene therapy but offer more predictable revenue streams. Gene therapies command higher upfronts due to curative one-time treatment potential, while ERTs generate recurring revenue over decades. Many licensees now seek both modalities for complementary portfolio positioning.',
      },
      {
        question: 'What drives premium valuations for ERT assets?',
        answer: 'Key premium drivers include improved enzyme stability or half-life, novel formulations enabling subcutaneous or oral delivery, expanded tissue penetration (e.g., CNS-penetrant ERTs for neuropathic variants), and activity in underserved patient populations. Next-generation ERTs with demonstrated superiority over first-generation products command 20-30% premiums.',
      },
      {
        question: 'What is the biosimilar risk for ERT deals?',
        answer: `ERT biosimilar risk is moderate but growing. Complex manufacturing and limited patient populations have slowed biosimilar entry compared to oncology biologics. However, Fabry and Gaucher ERTs face increasing biosimilar competition, which is reflected in royalty term negotiations and lifecycle management provisions.`,
      },
    ],
    relatedPages: [
      { slug: 'rare-disease-licensing-benchmarks', title: 'Rare Disease Overview' },
      { slug: 'gene-therapy-rare-disease-deal-benchmarks', title: 'Gene Therapy Rare Disease Deals' },
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
      { slug: 'small-molecule-deal-benchmarks', title: 'Small Molecule Deals' },
    ],
    category: 'modality',
  };
}

// ── Hematology pages ──────────────────────────────────────────────────────────

function buildHematologyOverviewPage(): BenchmarkPageData {
  const dlbcl = calculateDealTerms(makeInput({
    therapeuticArea: 'hematology',
    modality: 'carT_heme' as Modality,
    indication: 'dlbcl' as Indication,
    phase: 'phase1',
  }));
  const aml = calculateDealTerms(makeInput({
    therapeuticArea: 'hematology',
    modality: 'bispecificHeme' as Modality,
    indication: 'aml' as Indication,
    phase: 'phase2',
  }));
  const mf = calculateDealTerms(makeInput({
    therapeuticArea: 'hematology',
    modality: 'smallMolecule' as Modality,
    indication: 'myelofibrosis' as Indication,
    phase: 'phase2',
  }));
  return {
    slug: 'hematology-deal-benchmarks',
    title: 'Hematology Licensing Deal Benchmarks 2026 | Blood Cancer & Benign Hematology',
    metaDescription: `Comprehensive 2026 hematology licensing benchmarks. CAR-T, bispecific antibody, and small molecule deal terms across lymphoma, leukemia, and myeloproliferative neoplasms.`,
    h1: 'Hematology Licensing Deal Benchmarks 2026',
    heroStats: [
      {
        label: 'CAR-T DLBCL (Phase 1)',
        value: formatCurrency(dlbcl.terms.totalDealValue.median),
        subtext: 'Total deal value',
      },
      {
        label: 'Bispecific AML (Phase 2)',
        value: formatCurrency(aml.terms.totalDealValue.median),
        subtext: 'Total deal value',
      },
      {
        label: 'SM Myelofibrosis (Phase 2)',
        value: formatCurrency(mf.terms.totalDealValue.median),
        subtext: 'Total deal value',
      },
      {
        label: 'CAR-T Royalties',
        value: `${dlbcl.tieredRoyalties.base.low}%-${dlbcl.tieredRoyalties.base.high}%`,
        subtext: 'Base tier range',
      },
    ],
    contextParagraphs: [
      `Hematology continues to be one of the most active licensing areas in biopharma, driven by transformative cell therapy and bispecific antibody platforms. CAR-T cell therapy deals for DLBCL at Phase 1 carry median total deal values of ${formatCurrency(dlbcl.terms.totalDealValue.median)}, while bispecific antibody approaches to AML reach ${formatCurrency(aml.terms.totalDealValue.median)} at Phase 2. The field benefits from well-defined response endpoints (CR, MRD negativity) and accelerated approval pathways.`,
      `The hematology deal landscape spans malignant and benign conditions. Lymphoma and myeloma remain the highest-volume deal areas, but emerging targets in AML, MDS, and myeloproliferative neoplasms are attracting growing attention. Small molecule deals for myelofibrosis average ${formatCurrency(mf.terms.totalDealValue.median)}, buoyed by the commercial success of JAK inhibitors and the expanding pipeline of novel targets (BET inhibitors, MDM2 inhibitors, menin inhibitors).`,
      `Royalty rates across hematology licensing range from ${dlbcl.tieredRoyalties.base.low}% to ${dlbcl.tieredRoyalties.base.high}% at the base tier. CAR-T and bispecific antibody deals command the highest total deal values due to transformative response rates in relapsed/refractory settings, while small molecule approaches benefit from oral convenience and broader treatment line applicability.`,
    ],
    calculatorPrefill: { therapeuticArea: 'hematology', phase: 'phase2' },
    faqs: [
      {
        question: 'What are the highest-value hematology deal modalities in 2026?',
        answer: `CAR-T cell therapies lead in total deal value at ${formatCurrency(dlbcl.terms.totalDealValue.median)} for Phase 1 DLBCL programs, followed by bispecific antibodies at ${formatCurrency(aml.terms.totalDealValue.median)} (Phase 2 AML). Small molecule programs targeting myeloproliferative neoplasms average ${formatCurrency(mf.terms.totalDealValue.median)}.`,
      },
      {
        question: 'How do hematology deals compare to solid tumor oncology deals?',
        answer: 'Hematology deals generally command comparable or slightly higher total deal values than solid tumor deals at equivalent stages, driven by higher response rates, clearer clinical endpoints (MRD negativity, CR), and established accelerated approval pathways. CAR-T deals in hematology benefit from validated clinical proof of concept with 6 approved products.',
      },
      {
        question: 'Which hematology indications are most actively licensed?',
        answer: 'DLBCL, multiple myeloma, and AML lead in deal volume. DLBCL and myeloma benefit from validated targets (CD19, BCMA) and approved cell therapies. AML is attracting growing interest with novel targets (menin, CD47, FLT3) and bispecific approaches showing promising early data.',
      },
      {
        question: 'What trends are shaping hematology licensing in 2026?',
        answer: 'Key trends include next-generation CAR-T with improved persistence and safety, bispecific antibodies competing with CAR-T in earlier lines of therapy, novel small molecule targets (menin inhibitors for NPM1-mutated AML), and allogeneic cell therapy platforms aiming for off-the-shelf convenience.',
      },
    ],
    relatedPages: [
      { slug: 'car-t-hematology-deal-benchmarks', title: 'CAR-T Hematology Deals' },
      { slug: 'bispecific-antibody-hematology-benchmarks', title: 'Bispecific Hematology Deals' },
      { slug: 'car-t-deal-benchmarks', title: 'CAR-T Deal Benchmarks (Oncology)' },
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
    ],
    category: 'overview',
  };
}

function buildCARTHematologyPage(): BenchmarkPageData {
  const input = makeInput({
    therapeuticArea: 'hematology',
    modality: 'carT_heme' as Modality,
    indication: 'dlbcl' as Indication,
    phase: 'phase1',
  });
  const r = calculateDealTerms(input);
  return {
    slug: 'car-t-hematology-deal-benchmarks',
    title: 'CAR-T Hematology Licensing Deal Benchmarks 2026 | Cell Therapy Terms',
    metaDescription: `CAR-T hematology deals average ${formatCurrency(r.terms.totalDealValue.median)} total value at Phase 1. Benchmark upfronts, milestones, and royalties for hematologic CAR-T cell therapy licensing.`,
    h1: 'CAR-T Hematology Deal Benchmarks',
    heroStats: buildHeroStats(r),
    contextParagraphs: [
      `CAR-T cell therapy in hematologic malignancies remains the most clinically validated application of engineered cell therapy, with six approved products generating $5B+ in combined annual revenue. Phase 1 CAR-T hematology deals carry a median total deal value of ${formatCurrency(r.terms.totalDealValue.median)}, with upfront payments of ${formatCurrency(r.terms.upfront.median)}. The validated clinical paradigm and established manufacturing infrastructure support deal premiums even at early clinical stages.`,
      `Milestone structures in hematology CAR-T deals reflect the established clinical pathway. Development milestones average ${formatCurrency(r.terms.devMilestones.median)}, with key gates at Phase 1 dose selection, pivotal trial initiation, and BLA filing. Regulatory milestones of ${formatCurrency(r.terms.regMilestones.median)} and commercial milestones of ${formatCurrency(r.terms.commMilestones.median)} reward successful market entry and indication expansion.`,
      `Royalty rates for hematology CAR-T deals range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}%, reflecting the unique manufacturing economics of autologous cell therapy. Allogeneic and in-vivo CAR-T approaches that address scalability limitations can command higher total deal values. Next-generation targets beyond CD19 and BCMA (GPRC5D, CD70, CD22) are driving the next wave of licensing activity.`,
    ],
    calculatorPrefill: { therapeuticArea: 'hematology', phase: 'phase1', modality: 'carT_heme' },
    faqs: [
      {
        question: 'What are typical deal terms for hematology CAR-T licensing?',
        answer: `Phase 1 hematology CAR-T deals average ${formatCurrency(r.terms.upfront.median)} upfront with ${formatCurrency(r.terms.totalDealValue.median)} total deal value. The ${r.dealRecommendation.upfrontPercent}/${r.dealRecommendation.milestonePercent} upfront/milestone split is standard for early-stage cell therapy assets.`,
      },
      {
        question: 'How do autologous vs. allogeneic CAR-T deal terms differ?',
        answer: 'Autologous CAR-T deals benefit from clinical validation but face scalability constraints. Allogeneic (off-the-shelf) CAR-T platforms can command 15-25% higher total deal values due to broader commercial scalability, despite earlier clinical development. In-vivo CAR-T approaches represent the next frontier with potentially transformative manufacturing economics.',
      },
      {
        question: 'Which CAR-T targets are most actively licensed in hematology?',
        answer: 'CD19 (lymphoma, ALL) and BCMA (myeloma) remain the most validated targets with approved products. Emerging targets include GPRC5D (myeloma), FcRH5 (myeloma), CD70 (AML), and CD22 (ALL). Dual-target constructs (CD19/CD22, BCMA/GPRC5D) are attracting premium deal terms.',
      },
      {
        question: 'What manufacturing factors affect CAR-T deal valuations?',
        answer: `Manufacturing platform maturity significantly impacts deal terms. Established GMP manufacturing with short vein-to-vein time commands premium valuations. Novel manufacturing approaches (point-of-care, automated systems) can increase total deal values by 10-20% due to improved commercial scalability.`,
      },
    ],
    relatedPages: [
      { slug: 'hematology-deal-benchmarks', title: 'Hematology Deal Overview' },
      { slug: 'bispecific-antibody-hematology-benchmarks', title: 'Bispecific Hematology Deals' },
      { slug: 'car-t-deal-benchmarks', title: 'CAR-T Deals (Oncology)' },
      { slug: 'gene-therapy-deal-benchmarks', title: 'Gene Therapy Deals' },
    ],
    category: 'modality',
  };
}

function buildBispecificHematologyPage(): BenchmarkPageData {
  const input = makeInput({
    therapeuticArea: 'hematology',
    modality: 'bispecificHeme' as Modality,
    indication: 'dlbcl' as Indication,
    phase: 'phase2',
  });
  const r = calculateDealTerms(input);
  return {
    slug: 'bispecific-antibody-hematology-benchmarks',
    title: 'Bispecific Antibody Hematology Deal Benchmarks 2026 | T-cell Engager Terms',
    metaDescription: `Bispecific antibody hematology deals average ${formatCurrency(r.terms.totalDealValue.median)} total value at Phase 2. Benchmark deal terms for hematologic bispecific antibody licensing.`,
    h1: 'Bispecific Antibody Hematology Deal Benchmarks',
    heroStats: buildHeroStats(r),
    contextParagraphs: [
      `Bispecific antibodies have emerged as a major competitive force in hematologic oncology, challenging CAR-T cell therapy with off-the-shelf convenience and lower manufacturing complexity. Phase 2 bispecific hematology deals carry a median total deal value of ${formatCurrency(r.terms.totalDealValue.median)}, with upfront payments of ${formatCurrency(r.terms.upfront.median)}. Approved agents like glofitamab, epcoritamab, and teclistamab have validated the bispecific approach across lymphoma and myeloma.`,
      `Deal structures for hematology bispecifics reflect the rapid clinical development timelines and accelerated approval pathways. Development milestones average ${formatCurrency(r.terms.devMilestones.median)}, regulatory milestones contribute ${formatCurrency(r.terms.regMilestones.median)}, and commercial milestones reach ${formatCurrency(r.terms.commMilestones.median)}. The overall ${r.dealRecommendation.upfrontPercent}/${r.dealRecommendation.milestonePercent} upfront/milestone split reflects moderate clinical risk at Phase 2.`,
      `Royalty rates for hematology bispecific deals range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}%, with escalation to ${r.tieredRoyalties.highTier.high}% on peak sales. Key differentiation factors include subcutaneous versus intravenous formulation, step-up dosing requirements, cytokine release syndrome profile, and activity in CAR-T-refractory patients. Fixed-duration therapy bispecifics command premium terms over continuous treatment approaches.`,
    ],
    calculatorPrefill: { therapeuticArea: 'hematology', phase: 'phase2', modality: 'bispecificHeme' },
    faqs: [
      {
        question: 'What are typical deal terms for hematology bispecific antibodies?',
        answer: `Phase 2 hematology bispecific deals average ${formatCurrency(r.terms.upfront.median)} upfront with ${formatCurrency(r.terms.totalDealValue.median)} total deal value. The off-the-shelf advantage over CAR-T therapy supports strong commercial projections and competitive deal economics.`,
      },
      {
        question: 'How do bispecific deals compare to CAR-T deals in hematology?',
        answer: 'Bispecific antibody deals typically feature lower total deal values than CAR-T programs at equivalent stages, reflecting the less transformative response rates but superior convenience and scalability. However, bispecifics with demonstrated activity in CAR-T-refractory patients can rival CAR-T deal valuations.',
      },
      {
        question: 'Which bispecific targets are most valued in hematology?',
        answer: 'CD20xCD3 bispecifics lead in lymphoma (glofitamab, epcoritamab), while BCMAxCD3 approaches target myeloma (teclistamab). Emerging targets include CD123xCD3 for AML, GPRC5DxCD3 for myeloma, and novel T-cell engager formats with reduced CRS risk.',
      },
      {
        question: 'What drives premium valuations for hematology bispecifics?',
        answer: `Premium drivers include subcutaneous formulation (vs. IV), fixed-duration treatment protocols, favorable CRS profiles, activity in earlier lines of therapy, and demonstrated efficacy post-CAR-T. Bispecifics with these attributes can command 15-30% higher total deal values.`,
      },
    ],
    relatedPages: [
      { slug: 'hematology-deal-benchmarks', title: 'Hematology Deal Overview' },
      { slug: 'car-t-hematology-deal-benchmarks', title: 'CAR-T Hematology Deals' },
      { slug: 'bispecific-antibody-deal-benchmarks', title: 'Bispecific Deals (Oncology)' },
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
    ],
    category: 'modality',
  };
}

// ── Dermatology pages ─────────────────────────────────────────────────────────

function buildDermatologyOverviewPage(): BenchmarkPageData {
  const ad = calculateDealTerms(makeInput({
    therapeuticArea: 'dermatology',
    modality: 'il13Inhibitor' as Modality,
    indication: 'atopicDermatitis' as Indication,
    phase: 'phase2',
  }));
  const pso = calculateDealTerms(makeInput({
    therapeuticArea: 'dermatology',
    modality: 'il17Inhibitor' as Modality,
    indication: 'psoriasis' as Indication,
    phase: 'phase2',
  }));
  const jak = calculateDealTerms(makeInput({
    therapeuticArea: 'dermatology',
    modality: 'jakInhibitorDerm' as Modality,
    indication: 'alopeciaAreata' as Indication,
    phase: 'phase2',
  }));
  return {
    slug: 'dermatology-licensing-benchmarks',
    title: 'Dermatology Licensing Deal Benchmarks 2026 | Immunodermatology Deal Terms',
    metaDescription: `Comprehensive 2026 dermatology licensing benchmarks. IL-17, IL-13, JAK inhibitor, and topical biologic deal terms across atopic dermatitis, psoriasis, and emerging indications.`,
    h1: 'Dermatology Licensing Deal Benchmarks 2026',
    heroStats: [
      {
        label: 'IL-13 AD (Phase 2)',
        value: formatCurrency(ad.terms.totalDealValue.median),
        subtext: 'Atopic dermatitis',
      },
      {
        label: 'IL-17 Psoriasis (Phase 2)',
        value: formatCurrency(pso.terms.totalDealValue.median),
        subtext: 'Plaque psoriasis',
      },
      {
        label: 'JAK Inhibitor (Phase 2)',
        value: formatCurrency(jak.terms.totalDealValue.median),
        subtext: 'Alopecia areata',
      },
      {
        label: 'Derm Royalties',
        value: `${ad.tieredRoyalties.base.low}%-${ad.tieredRoyalties.base.high}%`,
        subtext: 'Base tier range',
      },
    ],
    contextParagraphs: [
      `Dermatology has become one of the fastest-growing therapeutic areas in biopharma licensing, driven by the success of biologics in immunodermatology. The dupilumab franchise ($13B+ annual revenue) validated the IL-4/IL-13 pathway, while IL-17 and IL-23 inhibitors have transformed psoriasis management. Phase 2 IL-13 inhibitor deals for atopic dermatitis carry a median total deal value of ${formatCurrency(ad.terms.totalDealValue.median)}, with IL-17 psoriasis deals at ${formatCurrency(pso.terms.totalDealValue.median)}.`,
      `Deal structures in dermatology reflect the large addressable populations (31M+ US AD patients, 7.5M psoriasis patients) and chronic treatment models that generate predictable recurring revenue. JAK inhibitor deals for emerging indications like alopecia areata and vitiligo average ${formatCurrency(jak.terms.totalDealValue.median)}, driven by the oral convenience advantage and broad inflammatory pathway coverage.`,
      `Royalty rates across dermatology licensing range from ${ad.tieredRoyalties.base.low}% to ${ad.tieredRoyalties.base.high}% at the base tier. Key deal drivers include efficacy superiority versus dupilumab, subcutaneous versus intravenous administration, dosing frequency advantages, and expansion potential across multiple inflammatory skin conditions. Topical biologics represent an emerging frontier with the potential to disrupt the systemics-dominated market.`,
    ],
    calculatorPrefill: { therapeuticArea: 'dermatology', phase: 'phase2' },
    faqs: [
      {
        question: 'What are the highest-value dermatology deal modalities in 2026?',
        answer: `IL-13 and IL-4Ralpha inhibitors lead in deal value for atopic dermatitis (${formatCurrency(ad.terms.totalDealValue.median)} at Phase 2), followed by IL-17 inhibitors for psoriasis (${formatCurrency(pso.terms.totalDealValue.median)}). JAK inhibitors attract strong interest for emerging indications at ${formatCurrency(jak.terms.totalDealValue.median)}.`,
      },
      {
        question: 'How do dermatology deal terms compare to oncology?',
        answer: 'Dermatology deals tend to feature lower total deal values than oncology but offer more predictable commercial profiles due to large, well-defined patient populations and chronic treatment models. The recurring revenue model and lower clinical development risk (clear endpoints like EASI, PASI) make dermatology deals attractive on a risk-adjusted basis.',
      },
      {
        question: 'Which dermatology indications are most actively licensed?',
        answer: 'Atopic dermatitis and plaque psoriasis lead in deal volume, followed by alopecia areata, vitiligo, hidradenitis suppurativa, and prurigo nodularis. The expansion of approved biologics into adjacencies (e.g., COPD, EoE for dupilumab) is driving increased interest in multi-indication licensing deals.',
      },
      {
        question: 'What trends are shaping dermatology licensing in 2026?',
        answer: 'Key trends include the race for next-generation oral JAK inhibitors with improved safety profiles, topical biologic platforms targeting local inflammation, OX40/OX40L pathway inhibitors for AD, and biosimilar competition pressuring first-generation biologics. The growing focus on under-served conditions (hidradenitis, vitiligo) is creating new high-value deal opportunities.',
      },
    ],
    relatedPages: [
      { slug: 'il17-inhibitor-deal-benchmarks', title: 'IL-17 Inhibitor Deals' },
      { slug: 'jak-inhibitor-dermatology-benchmarks', title: 'JAK Inhibitor Derm Deals' },
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
      { slug: 'small-molecule-deal-benchmarks', title: 'Small Molecule Deals' },
    ],
    category: 'overview',
  };
}

function buildIL17InhibitorPage(): BenchmarkPageData {
  const input = makeInput({
    therapeuticArea: 'dermatology',
    modality: 'il17Inhibitor' as Modality,
    indication: 'psoriasis' as Indication,
    phase: 'phase2',
  });
  const r = calculateDealTerms(input);
  return {
    slug: 'il17-inhibitor-deal-benchmarks',
    title: 'IL-17 Inhibitor Licensing Deal Benchmarks 2026 | Psoriasis Deal Terms',
    metaDescription: `IL-17 inhibitor licensing deals average ${formatCurrency(r.terms.totalDealValue.median)} total value at Phase 2. Benchmark upfronts, milestones, and royalties for IL-17 pathway deals.`,
    h1: 'IL-17 Inhibitor Deal Benchmarks',
    heroStats: buildHeroStats(r),
    contextParagraphs: [
      `IL-17 inhibitors have become the gold standard for plaque psoriasis treatment, with secukinumab, ixekizumab, and bimekizumab generating $10B+ in combined annual revenue. Phase 2 IL-17 inhibitor deals carry a median total deal value of ${formatCurrency(r.terms.totalDealValue.median)}, with upfront payments of ${formatCurrency(r.terms.upfront.median)}. The validated pathway, large addressable population (7.5M US psoriasis patients), and expanding indication potential (psoriatic arthritis, axial spondyloarthritis, hidradenitis suppurativa) sustain robust deal activity.`,
      `Milestone structures for IL-17 inhibitor deals allocate ${formatCurrency(r.terms.devMilestones.median)} to development milestones, ${formatCurrency(r.terms.regMilestones.median)} to regulatory milestones, and ${formatCurrency(r.terms.commMilestones.median)} to commercial milestones. The ${r.dealRecommendation.upfrontPercent}/${r.dealRecommendation.milestonePercent} upfront/milestone split reflects the well-defined clinical development pathway with PASI 75/90/100 as established primary endpoints.`,
      `Royalty rates for IL-17 inhibitor licensing range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}% at the base tier. Differentiation factors include IL-17A versus IL-17A/F versus IL-17C selectivity, dosing frequency, immunogenicity profile, and potential for combination with other pathways. Next-generation IL-17 inhibitors with oral bioavailability or improved convenience (fewer injections, auto-injector delivery) command the highest premiums.`,
    ],
    calculatorPrefill: { therapeuticArea: 'dermatology', phase: 'phase2', modality: 'il17Inhibitor' },
    faqs: [
      {
        question: 'What are typical deal terms for IL-17 inhibitor licensing?',
        answer: `Phase 2 IL-17 inhibitor deals average ${formatCurrency(r.terms.upfront.median)} upfront with ${formatCurrency(r.terms.totalDealValue.median)} total deal value. The validated pathway and established commercial precedent ($10B+ market) provide a strong foundation for deal negotiations.`,
      },
      {
        question: 'How do IL-17A vs. IL-17F inhibitor deals differ?',
        answer: 'Dual IL-17A/F inhibitors (like bimekizumab) have demonstrated superior PASI responses compared to IL-17A-only inhibitors, commanding 10-15% higher deal premiums. IL-17C inhibitors represent a differentiated approach targeting keratinocyte-driven inflammation with potentially superior safety profiles.',
      },
      {
        question: 'What is the biosimilar impact on IL-17 inhibitor deals?',
        answer: 'Secukinumab biosimilars are expected from 2025-2027, creating pricing pressure on first-generation IL-17 inhibitors. However, next-generation IL-17 inhibitors with differentiated mechanisms, improved convenience, or expanded indication packages maintain premium deal terms. Biosimilar risk is factored into royalty term negotiations.',
      },
      {
        question: 'Which indications beyond psoriasis drive IL-17 deal value?',
        answer: 'Key expansion indications include psoriatic arthritis, axial spondyloarthritis, hidradenitis suppurativa, and non-infectious uveitis. Multi-indication IL-17 programs can command 20-30% higher total deal values versus psoriasis-only programs due to the expanded commercial opportunity.',
      },
    ],
    relatedPages: [
      { slug: 'dermatology-licensing-benchmarks', title: 'Dermatology Deal Overview' },
      { slug: 'jak-inhibitor-dermatology-benchmarks', title: 'JAK Inhibitor Derm Deals' },
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
      { slug: 'small-molecule-deal-benchmarks', title: 'Small Molecule Deals' },
    ],
    category: 'modality',
  };
}

function buildJAKInhibitorDermPage(): BenchmarkPageData {
  const input = makeInput({
    therapeuticArea: 'dermatology',
    modality: 'jakInhibitorDerm' as Modality,
    indication: 'atopicDermatitis' as Indication,
    phase: 'phase2',
  });
  const r = calculateDealTerms(input);
  return {
    slug: 'jak-inhibitor-dermatology-benchmarks',
    title: 'JAK Inhibitor Dermatology Deal Benchmarks 2026 | Oral Immunodermatology Terms',
    metaDescription: `JAK inhibitor dermatology deals average ${formatCurrency(r.terms.totalDealValue.median)} total value at Phase 2. Benchmark deal terms for JAK inhibitors in atopic dermatitis, alopecia areata, and vitiligo.`,
    h1: 'JAK Inhibitor Dermatology Deal Benchmarks',
    heroStats: buildHeroStats(r),
    contextParagraphs: [
      `JAK inhibitors have expanded from rheumatology into dermatology, with baricitinib (AD), upadacitinib (AD), abrocitinib (AD), and ritlecitinib (alopecia areata) establishing the oral immunodermatology class. Phase 2 JAK inhibitor deals in dermatology carry a median total deal value of ${formatCurrency(r.terms.totalDealValue.median)}, with upfront payments of ${formatCurrency(r.terms.upfront.median)}. The oral convenience advantage over injectable biologics drives strong patient preference and payer interest.`,
      `Deal structures reflect the balance between the proven anti-inflammatory mechanism and the ongoing safety scrutiny from FDA boxed warnings on JAK inhibitors. Development milestones average ${formatCurrency(r.terms.devMilestones.median)}, with gating criteria often tied to long-term safety data in addition to efficacy endpoints. Regulatory milestones of ${formatCurrency(r.terms.regMilestones.median)} and commercial milestones of ${formatCurrency(r.terms.commMilestones.median)} reward successful market entry.`,
      `Royalty rates for dermatology JAK inhibitor deals range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}%. Next-generation selective JAK1 or TYK2 inhibitors with improved cardiovascular and thromboembolic safety profiles command premium terms. Topical JAK inhibitors (ruxolitinib cream for AD, vitiligo) represent a differentiated approach that avoids systemic exposure concerns while maintaining JAK pathway efficacy.`,
    ],
    calculatorPrefill: { therapeuticArea: 'dermatology', phase: 'phase2', modality: 'jakInhibitorDerm' },
    faqs: [
      {
        question: 'What are typical deal terms for dermatology JAK inhibitors?',
        answer: `Phase 2 dermatology JAK inhibitor deals average ${formatCurrency(r.terms.upfront.median)} upfront with ${formatCurrency(r.terms.totalDealValue.median)} total deal value. Selective JAK1 inhibitors with clean safety profiles command the highest deal premiums in the class.`,
      },
      {
        question: 'How do JAK safety concerns affect deal valuations?',
        answer: 'FDA boxed warnings on JAK inhibitors (MACE, VTE, malignancy, infections) have moderated deal premiums compared to pre-2022 levels. However, next-generation selective inhibitors (JAK1-only, TYK2) with improved safety data are recovering deal value. Long-term safety data is now a critical milestone gate in JAK inhibitor deals.',
      },
      {
        question: 'How do topical vs. oral JAK inhibitor deals compare?',
        answer: 'Topical JAK inhibitors command similar total deal values to oral formulations despite lower per-patient revenue, because they avoid systemic safety concerns and can access broader patient populations. Ruxolitinib cream for AD and vitiligo has demonstrated the commercial viability of the topical approach.',
      },
      {
        question: 'Which dermatology indications are most targeted by JAK inhibitor deals?',
        answer: 'Atopic dermatitis leads in deal volume, followed by alopecia areata, vitiligo, hidradenitis suppurativa, and prurigo nodularis. The oral convenience and broad anti-inflammatory mechanism of JAK inhibitors make them attractive across multiple inflammatory dermatoses.',
      },
    ],
    relatedPages: [
      { slug: 'dermatology-licensing-benchmarks', title: 'Dermatology Deal Overview' },
      { slug: 'il17-inhibitor-deal-benchmarks', title: 'IL-17 Inhibitor Deals' },
      { slug: 'small-molecule-deal-benchmarks', title: 'Small Molecule Deals' },
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
    ],
    category: 'modality',
  };
}

// ── Gastroenterology pages ────────────────────────────────────────────────────

function buildGastroenterologyOverviewPage(): BenchmarkPageData {
  const crohns = calculateDealTerms(makeInput({
    therapeuticArea: 'gastroenterology',
    modality: 'antiTl1a' as Modality,
    indication: 'crohnsDisease' as Indication,
    phase: 'phase2',
  }));
  const uc = calculateDealTerms(makeInput({
    therapeuticArea: 'gastroenterology',
    modality: 'il23GI' as Modality,
    indication: 'ulcerativeColitis' as Indication,
    phase: 'phase2',
  }));
  const eoe = calculateDealTerms(makeInput({
    therapeuticArea: 'gastroenterology',
    modality: 'mab' as Modality,
    indication: 'eosinophilicEsophagitis' as Indication,
    phase: 'phase2',
  }));
  return {
    slug: 'gastroenterology-deal-benchmarks',
    title: 'Gastroenterology Licensing Deal Benchmarks 2026 | IBD & GI Deal Terms',
    metaDescription: `Comprehensive 2026 gastroenterology licensing benchmarks. Anti-TL1A, IL-23, and S1P modulator deal terms across Crohn's disease, ulcerative colitis, and emerging GI indications.`,
    h1: 'Gastroenterology Licensing Deal Benchmarks 2026',
    heroStats: [
      {
        label: "Anti-TL1A Crohn's (Phase 2)",
        value: formatCurrency(crohns.terms.totalDealValue.median),
        subtext: 'Total deal value',
      },
      {
        label: 'IL-23 UC (Phase 2)',
        value: formatCurrency(uc.terms.totalDealValue.median),
        subtext: 'Total deal value',
      },
      {
        label: 'mAb EoE (Phase 2)',
        value: formatCurrency(eoe.terms.totalDealValue.median),
        subtext: 'Total deal value',
      },
      {
        label: 'GI Royalties',
        value: `${crohns.tieredRoyalties.base.low}%-${crohns.tieredRoyalties.base.high}%`,
        subtext: 'Base tier range',
      },
    ],
    contextParagraphs: [
      `Gastroenterology has emerged as one of the most dynamic licensing areas in biopharma, fueled by the validation of novel targets like TL1A and the continued expansion of IL-23 and integrin pathways. The Merck/Prometheus Biosciences acquisition at $10.8B for anti-TL1A set a transformative valuation benchmark for the GI space. Phase 2 anti-TL1A deals for Crohn's disease carry a median total deal value of ${formatCurrency(crohns.terms.totalDealValue.median)}, while IL-23 approaches to UC reach ${formatCurrency(uc.terms.totalDealValue.median)}.`,
      `GI deal structures reflect the chronic nature of IBD treatment (lifelong therapy), large patient populations (3M+ US IBD patients), and well-defined clinical endpoints (endoscopic remission, clinical remission). The growing focus on combination approaches (IL-23 + TL1A, biologics + JAK inhibitors) is driving platform deal interest. EoE deals average ${formatCurrency(eoe.terms.totalDealValue.median)} as dupixent validated the eosinophilic pathway.`,
      `Royalty rates across GI licensing range from ${crohns.tieredRoyalties.base.low}% to ${crohns.tieredRoyalties.base.high}% at the base tier. Key valuation drivers include differentiation versus adalimumab and vedolizumab, oral versus injectable formulation, mucosal healing rates, and potential for steroid-free remission. The biosimilar erosion of adalimumab (Humira) has created opportunity for next-generation targeted therapies with superior efficacy profiles.`,
    ],
    calculatorPrefill: { therapeuticArea: 'gastroenterology', phase: 'phase2' },
    faqs: [
      {
        question: 'What are the highest-value GI deal modalities in 2026?',
        answer: `Anti-TL1A antibodies lead in deal value at ${formatCurrency(crohns.terms.totalDealValue.median)} for Phase 2 Crohn's programs, validated by the $10.8B Merck/Prometheus acquisition. IL-23 inhibitors for UC reach ${formatCurrency(uc.terms.totalDealValue.median)}, while gut-selective approaches with improved safety profiles are attracting growing interest.`,
      },
      {
        question: 'How do GI deal terms compare to other immunology TAs?',
        answer: 'GI deal terms are increasingly competitive with broader immunology (rheumatology, dermatology) due to large chronic patient populations and growing standard-of-care gaps. The validated clinical endpoints (endoscopic remission) and chronic treatment model support strong deal economics.',
      },
      {
        question: 'Which GI indications are most actively licensed?',
        answer: "Crohn's disease and ulcerative colitis dominate deal volume, followed by EoE, celiac disease, and IBS. Emerging indications like pouchitis and short bowel syndrome offer niche opportunities with limited competition and orphan-like commercial profiles.",
      },
      {
        question: 'What trends are shaping GI licensing in 2026?',
        answer: 'Key trends include the TL1A pathway validation driving a wave of follow-on licensing, oral integrin modulators competing with injectable therapies, combination biologic approaches for refractory IBD, precision medicine strategies based on gut microbiome profiling, and expansion into eosinophilic GI disorders.',
      },
    ],
    relatedPages: [
      { slug: 'anti-tl1a-deal-benchmarks', title: 'Anti-TL1A Deal Benchmarks' },
      { slug: 'il23-gi-deal-benchmarks', title: 'IL-23 GI Deal Benchmarks' },
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
      { slug: 'small-molecule-deal-benchmarks', title: 'Small Molecule Deals' },
    ],
    category: 'overview',
  };
}

function buildAntiTL1APage(): BenchmarkPageData {
  const input = makeInput({
    therapeuticArea: 'gastroenterology',
    modality: 'antiTl1a' as Modality,
    indication: 'crohnsDisease' as Indication,
    phase: 'phase2',
  });
  const r = calculateDealTerms(input);
  return {
    slug: 'anti-tl1a-deal-benchmarks',
    title: 'Anti-TL1A Licensing Deal Benchmarks 2026 | IBD Novel Target Deal Terms',
    metaDescription: `Anti-TL1A licensing deals average ${formatCurrency(r.terms.totalDealValue.median)} total value at Phase 2. Benchmark deal terms for TL1A-targeting therapies in Crohn's disease and ulcerative colitis.`,
    h1: 'Anti-TL1A Deal Benchmarks',
    heroStats: buildHeroStats(r),
    contextParagraphs: [
      `TL1A (TNF-like ligand 1A) has become the most sought-after novel target in gastroenterology following Merck's $10.8B acquisition of Prometheus Biosciences in 2023. Phase 2 anti-TL1A deals for Crohn's disease carry a median total deal value of ${formatCurrency(r.terms.totalDealValue.median)}, with upfront payments of ${formatCurrency(r.terms.upfront.median)}. The dual mechanism — anti-inflammatory and anti-fibrotic activity — addresses a critical unmet need in IBD, as fibrosis drives surgical morbidity in Crohn's disease.`,
      `Deal structures for anti-TL1A assets reflect the transformative pipeline interest. Development milestones average ${formatCurrency(r.terms.devMilestones.median)}, with key gates tied to endoscopic remission data and fibrosis endpoints. Regulatory milestones of ${formatCurrency(r.terms.regMilestones.median)} and commercial milestones of ${formatCurrency(r.terms.commMilestones.median)} reward market entry in what is projected to become a $5-10B target class by 2030.`,
      `Royalty rates for anti-TL1A licensing range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}%, with tiered escalation to ${r.tieredRoyalties.highTier.high}%. Differentiation factors include biomarker-guided patient selection (TL1A genetic risk variants), combination potential with IL-23 inhibitors, and oral versus injectable formulation. The competitive landscape has expanded rapidly, with Roche/Genentech, Pfizer, AbbVie, and Sanofi all pursuing TL1A programs.`,
    ],
    calculatorPrefill: { therapeuticArea: 'gastroenterology', phase: 'phase2', modality: 'antiTl1a' },
    faqs: [
      {
        question: 'What are typical deal terms for anti-TL1A licensing?',
        answer: `Phase 2 anti-TL1A deals average ${formatCurrency(r.terms.upfront.median)} upfront with ${formatCurrency(r.terms.totalDealValue.median)} total deal value. The $10.8B Merck/Prometheus acquisition has set a high-water mark that influences all subsequent TL1A deal negotiations.`,
      },
      {
        question: 'Why is TL1A considered a breakthrough target in GI?',
        answer: 'TL1A uniquely combines anti-inflammatory and anti-fibrotic activity, addressing the root cause of surgical morbidity in Crohn\'s disease. The genetics-guided patient selection approach (TL1A risk variants in ~50% of IBD patients) enables precision medicine strategies with higher response rates. Phase 2 data from tulisokibart showed unprecedented endoscopic remission rates.',
      },
      {
        question: 'How does the anti-TL1A competitive landscape affect deal terms?',
        answer: 'The rapid expansion of TL1A programs (10+ in clinical development) has increased competitive pressure but also validated the target, supporting deal premiums. First-movers with clinical data command the highest valuations, while differentiated approaches (bispecific TL1A/IL-23, oral TL1A inhibitors) can maintain premium terms.',
      },
      {
        question: 'What combination strategies drive TL1A deal value?',
        answer: 'TL1A + IL-23 inhibitor combinations represent the most anticipated approach, potentially addressing biologic-refractory IBD. Preclinical data suggests synergistic anti-inflammatory and anti-fibrotic effects. Assets with demonstrated combination compatibility command 15-25% premium in total deal value.',
      },
    ],
    relatedPages: [
      { slug: 'gastroenterology-deal-benchmarks', title: 'Gastroenterology Deal Overview' },
      { slug: 'il23-gi-deal-benchmarks', title: 'IL-23 GI Deal Benchmarks' },
      { slug: 'bispecific-antibody-deal-benchmarks', title: 'Bispecific Antibody Deals' },
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
    ],
    category: 'modality',
  };
}

function buildIL23GIPage(): BenchmarkPageData {
  const input = makeInput({
    therapeuticArea: 'gastroenterology',
    modality: 'il23GI' as Modality,
    indication: 'ulcerativeColitis' as Indication,
    phase: 'phase2',
  });
  const r = calculateDealTerms(input);
  return {
    slug: 'il23-gi-deal-benchmarks',
    title: 'IL-23 GI Licensing Deal Benchmarks 2026 | IBD Biologic Deal Terms',
    metaDescription: `IL-23 inhibitor GI deals average ${formatCurrency(r.terms.totalDealValue.median)} total value at Phase 2. Benchmark deal terms for IL-23 targeting therapies in ulcerative colitis and Crohn's disease.`,
    h1: 'IL-23 GI Deal Benchmarks',
    heroStats: buildHeroStats(r),
    contextParagraphs: [
      `IL-23 inhibitors have become the fastest-growing biologic class in gastroenterology, with risankizumab and guselkumab generating combined revenue approaching $10B. Phase 2 IL-23 GI deals carry a median total deal value of ${formatCurrency(r.terms.totalDealValue.median)}, with upfront payments of ${formatCurrency(r.terms.upfront.median)}. The class benefits from superior efficacy over TNF inhibitors, favorable safety profiles, and convenient dosing intervals (subcutaneous, every 4-8 weeks).`,
      `Deal structures for IL-23 GI programs allocate ${formatCurrency(r.terms.devMilestones.median)} to development milestones, ${formatCurrency(r.terms.regMilestones.median)} to regulatory milestones, and ${formatCurrency(r.terms.commMilestones.median)} to commercial milestones. The ${r.dealRecommendation.upfrontPercent}/${r.dealRecommendation.milestonePercent} upfront/milestone split reflects the de-risked clinical pathway with established endpoints and a clear regulatory precedent from approved IL-23 inhibitors.`,
      `Royalty rates for IL-23 GI licensing range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}% at the base tier, escalating to ${r.tieredRoyalties.highTier.high}%. Differentiation factors include p19-selective versus dual p19/p40 targeting, subcutaneous versus IV induction, mucosal healing rates in biologic-refractory patients, and combination potential with TL1A or integrin pathway agents. Assets with first-line positioning data command the highest premiums.`,
    ],
    calculatorPrefill: { therapeuticArea: 'gastroenterology', phase: 'phase2', modality: 'il23GI' },
    faqs: [
      {
        question: 'What are typical deal terms for IL-23 GI licensing?',
        answer: `Phase 2 IL-23 GI deals average ${formatCurrency(r.terms.upfront.median)} upfront with ${formatCurrency(r.terms.totalDealValue.median)} total deal value. The validated pathway (risankizumab, guselkumab approvals) and established $10B+ market provide a strong deal economics foundation.`,
      },
      {
        question: 'How do IL-23 GI deals compare to IL-23 dermatology deals?',
        answer: 'IL-23 GI deals command comparable or slightly higher total deal values than dermatology-focused IL-23 programs due to the larger IBD patient population (3M+ in the US) and growing first-line treatment positioning. However, dermatology IL-23 deals benefit from faster clinical development timelines.',
      },
      {
        question: 'What drives premium IL-23 GI deal valuations?',
        answer: 'Key premium factors include superior endoscopic remission rates in biologic-experienced patients, rapid onset of clinical response, subcutaneous formulation (vs. IV-only competitors), and favorable positioning versus both anti-TNF and anti-integrin agents. Head-to-head superiority data versus vedolizumab or ustekinumab is a major valuation accelerator.',
      },
      {
        question: 'How are IL-23 combination strategies valued?',
        answer: 'IL-23 + TL1A and IL-23 + JAK inhibitor combinations are the most anticipated strategies for refractory IBD. Clinical data supporting combination use can increase total deal values by 20-30%. Bispecific antibodies targeting both IL-23 and another pathway (TL1A, TNF) represent the next frontier in combination approach deal-making.',
      },
    ],
    relatedPages: [
      { slug: 'gastroenterology-deal-benchmarks', title: 'Gastroenterology Deal Overview' },
      { slug: 'anti-tl1a-deal-benchmarks', title: 'Anti-TL1A Deal Benchmarks' },
      { slug: 'il17-inhibitor-deal-benchmarks', title: 'IL-17 Inhibitor Deals' },
      { slug: 'phase-2-deal-benchmarks', title: 'Phase 2 Deal Benchmarks' },
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
  // Rare Disease
  buildRareDiseaseOverviewPage(),
  buildGeneTherapyRareDiseasePage(),
  buildEnzymeReplacementTherapyPage(),
  // Hematology
  buildHematologyOverviewPage(),
  buildCARTHematologyPage(),
  buildBispecificHematologyPage(),
  // Dermatology
  buildDermatologyOverviewPage(),
  buildIL17InhibitorPage(),
  buildJAKInhibitorDermPage(),
  // Gastroenterology
  buildGastroenterologyOverviewPage(),
  buildAntiTL1APage(),
  buildIL23GIPage(),
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
