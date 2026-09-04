/**
 * Universal Delivery Route Profiles
 *
 * Promotes the metabolic-only `routeOfAdministration` (3 values) to a
 * universal system (12 routes) with PoS, peak sales, deal premium, timeline,
 * and COGS modifiers.
 *
 * IV infusion is the 1.00 baseline for all modifiers.
 *
 * Sources:
 *   - IQVIA Channel Dynamics 2025 (route-specific market share data)
 *   - BIO/Informa 2024 (route-stratified clinical success rates)
 *   - EvaluatePharma 2025 (deal premium analysis by formulation)
 *   - FDA approval data (route-specific approval rates and timelines)
 *   - Ambrosia deal database (route-derived deal premiums from verified deals)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeliveryRoute =
  | 'iv'
  | 'sc'
  | 'oral'
  | 'intrathecal'
  | 'intravitreal'
  | 'inhaled'
  | 'topical'
  | 'implantable'
  | 'gene_therapy_vector'
  | 'device_combo'
  | 'autoinjector'
  | 'intranasal';

export interface DeliveryRouteProfile {
  slug: DeliveryRoute;
  displayName: string;
  posModifier: number;
  peakSalesModifier: number;
  timelineModifier: number;
  dealPremium: number;
  cogsMultiplier: number;
  applicableTAs: string[];
  notes: string;
  source: string;
}

// ---------------------------------------------------------------------------
// Route Profiles
// ---------------------------------------------------------------------------

export const DELIVERY_ROUTE_PROFILES: Record<DeliveryRoute, DeliveryRouteProfile> = {

  iv: {
    slug: 'iv', displayName: 'IV Infusion',
    posModifier: 1.00,
    peakSalesModifier: 1.00,
    timelineModifier: 0,
    dealPremium: 0,
    cogsMultiplier: 1.00,
    applicableTAs: ['oncology', 'immunology', 'neurology', 'hematology', 'infectiousDisease', 'rareDisease', 'cardiovascular', 'gastroenterology'],
    notes: 'Baseline route. Hospital/clinic setting. Standard for mAbs, ADCs, cell therapies.',
    source: 'Baseline reference',
  },

  sc: {
    slug: 'sc', displayName: 'Subcutaneous Injection',
    posModifier: 1.05,
    peakSalesModifier: 1.20,
    timelineModifier: 0,
    dealPremium: 0.06,
    cogsMultiplier: 1.05,
    applicableTAs: ['immunology', 'oncology', 'rareDisease', 'metabolic', 'cardiovascular', 'hematology', 'neurology', 'dermatology'],
    notes: 'Self-administration possible. Home-use advantage over IV. SC reformulation of IV drugs (Darzalex Faspro, Herceptin Hylecta) captures market share premium.',
    source: 'SC vs IV market share data: Darzalex SC captured 60% share within 18 months (JNJ 2023 10-K)',
  },

  oral: {
    slug: 'oral', displayName: 'Oral',
    posModifier: 0.97,
    peakSalesModifier: 1.30,
    timelineModifier: 0,
    dealPremium: 0.10,
    cogsMultiplier: 0.60,
    applicableTAs: ['oncology', 'immunology', 'neurology', 'metabolic', 'cardiovascular', 'infectiousDisease', 'hematology', 'dermatology', 'gastroenterology', 'psychiatry'],
    notes: 'Highest patient preference. Oral-in-IV-dominant-class commands 20-35% peak sales premium. Slightly lower PoS due to bioavailability and first-pass challenges for biologics. Dramatically lower COGS.',
    source: 'Oral JAKi vs IV biologics market share: Rinvoq/Xeljanz 25% share within 3 years. Oral PCSK9 (Alhambra) Phase 2 premium vs SC.',
  },

  intrathecal: {
    slug: 'intrathecal', displayName: 'Intrathecal',
    posModifier: 0.92,
    peakSalesModifier: 0.85,
    timelineModifier: 3,
    dealPremium: -0.04,
    cogsMultiplier: 1.20,
    applicableTAs: ['neurology', 'rareDisease'],
    notes: 'CNS-direct delivery bypassing BBB. Required for ASO therapies (Spinraza). Specialized administration limits addressable market. 3-month timeline delay for IT-specific manufacturing and clinical logistics.',
    source: 'Spinraza IT administration: $375K/yr but limited to ~11K patients treated globally vs oral Evrysdi 30K+ (Novartis/Roche 2024)',
  },

  intravitreal: {
    slug: 'intravitreal', displayName: 'Intravitreal Injection',
    posModifier: 0.95,
    peakSalesModifier: 1.00,
    timelineModifier: 0,
    dealPremium: 0,
    cogsMultiplier: 1.10,
    applicableTAs: ['ophthalmology'],
    notes: 'Standard for retinal therapies. Treatment burden drives demand for extended-durability formulations (port delivery, gene therapy alternatives).',
    source: 'Standard of care for wet AMD/DME; Eylea, Lucentis, Vabysmo all intravitreal',
  },

  inhaled: {
    slug: 'inhaled', displayName: 'Inhaled',
    posModifier: 0.90,
    peakSalesModifier: 1.10,
    timelineModifier: 6,
    dealPremium: 0.03,
    cogsMultiplier: 1.30,
    applicableTAs: ['infectiousDisease', 'immunology', 'oncology'],
    notes: 'Lung-targeted delivery. Device development adds 6 months. Higher COGS from device + drug co-packaging. Limited to pulmonary/respiratory indications.',
    source: 'Inhaled biologics (inhaled anti-IL-13, inhaled surfactant) Phase 2 data; device+drug regulatory complexity',
  },

  topical: {
    slug: 'topical', displayName: 'Topical',
    posModifier: 0.98,
    peakSalesModifier: 0.75,
    timelineModifier: 0,
    dealPremium: -0.04,
    cogsMultiplier: 0.70,
    applicableTAs: ['dermatology', 'ophthalmology'],
    notes: 'Localized delivery, lower systemic exposure. Peak sales discounted because topical markets are smaller and face generic/OTC competition. Low COGS.',
    source: 'Topical JAKi (Opzelura) vs systemic biologics: smaller peak sales but faster market penetration',
  },

  implantable: {
    slug: 'implantable', displayName: 'Implantable Device/Depot',
    posModifier: 0.88,
    peakSalesModifier: 0.90,
    timelineModifier: 6,
    dealPremium: -0.02,
    cogsMultiplier: 1.40,
    applicableTAs: ['metabolic', 'neurology', 'ophthalmology', 'womensHealth'],
    notes: 'Long-acting depot or implant. Additional device regulatory pathway. Higher COGS from manufacturing complexity. Susvimo (port delivery) precedent in ophthalmology.',
    source: 'Susvimo (ranibizumab port delivery) voluntary withdrawal 2023; Nexplanon implant contraception',
  },

  gene_therapy_vector: {
    slug: 'gene_therapy_vector', displayName: 'Gene Therapy Vector (AAV/LV)',
    posModifier: 0.85,
    peakSalesModifier: 1.15,
    timelineModifier: 6,
    dealPremium: 0.06,
    cogsMultiplier: 2.50,
    applicableTAs: ['rareDisease', 'ophthalmology', 'neurology', 'hematology'],
    notes: 'One-time treatment premium. Very high COGS ($500K-$2M+ per treatment). Manufacturing capacity constraints. Platform value for vector technology.',
    source: 'Tufts NEWDIGS 2024: gene therapy COGS 5-10x biologic; Zolgensma $2.1M, Hemgenix $3.5M',
  },

  device_combo: {
    slug: 'device_combo', displayName: 'Device-Drug Combination',
    posModifier: 0.90,
    peakSalesModifier: 1.05,
    timelineModifier: 6,
    dealPremium: 0.03,
    cogsMultiplier: 1.50,
    applicableTAs: ['neurology', 'oncology', 'cardiovascular', 'metabolic'],
    notes: 'Drug-device combination product. Dual regulatory pathway (drug + device). DeepsonBio Neuclare ultrasound + pharma licensing is this category. Higher complexity but differentiated positioning.',
    source: 'Drug-device combinations: dual FDA pathway, typical 6-month additional timeline',
  },

  autoinjector: {
    slug: 'autoinjector', displayName: 'Autoinjector / Pen',
    posModifier: 1.08,
    peakSalesModifier: 1.25,
    timelineModifier: 0,
    dealPremium: 0.08,
    cogsMultiplier: 1.15,
    applicableTAs: ['immunology', 'metabolic', 'neurology', 'rareDisease', 'dermatology', 'cardiovascular'],
    notes: 'Self-administered pre-filled device. Patient convenience drives market share vs IV/SC vial. Ozempic/Wegovy pen format key to GLP-1 mass market adoption. Higher PoS because device-drug combination reduces administration errors.',
    source: 'GLP-1 pen vs vial adoption: pen devices >90% share (IQVIA 2025). Dupixent autoinjector launch drove pediatric expansion.',
  },

  intranasal: {
    slug: 'intranasal', displayName: 'Intranasal',
    posModifier: 1.03,
    peakSalesModifier: 1.15,
    timelineModifier: 0,
    dealPremium: 0.05,
    cogsMultiplier: 0.80,
    applicableTAs: ['neurology', 'psychiatry', 'infectiousDisease'],
    notes: 'Non-invasive CNS delivery via olfactory/trigeminal pathway. Spravato (esketamine) nasal spray precedent. Lower COGS than injectable. Rapid onset advantage for acute settings.',
    source: 'FDA 2019 Spravato; nasal oxytocin, nasal insulin Phase 2 programs',
  },
};

// ---------------------------------------------------------------------------
// Per-TA Option Arrays
// ---------------------------------------------------------------------------

function routesForTA(ta: string): { value: DeliveryRoute; label: string }[] {
  return Object.values(DELIVERY_ROUTE_PROFILES)
    .filter(r => r.applicableTAs.includes(ta))
    .sort((a, b) => b.peakSalesModifier - a.peakSalesModifier)
    .map(r => ({ value: r.slug, label: r.displayName }));
}

export const deliveryRouteOptionsByTA: Record<string, { value: DeliveryRoute; label: string }[]> = {
  oncology: routesForTA('oncology'),
  neurology: routesForTA('neurology'),
  immunology: routesForTA('immunology'),
  metabolic: routesForTA('metabolic'),
  cardiovascular: routesForTA('cardiovascular'),
  infectiousDisease: routesForTA('infectiousDisease'),
  ophthalmology: routesForTA('ophthalmology'),
  womensHealth: routesForTA('womensHealth'),
  rareDisease: routesForTA('rareDisease'),
  hematology: routesForTA('hematology'),
  dermatology: routesForTA('dermatology'),
  gastroenterology: routesForTA('gastroenterology'),
  psychiatry: routesForTA('psychiatry'),
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getRouteProfile(route: DeliveryRoute): DeliveryRouteProfile {
  return DELIVERY_ROUTE_PROFILES[route] ?? DELIVERY_ROUTE_PROFILES.iv;
}

export function getRoutePosModifier(route?: string): number {
  if (!route) return 1.0;
  return DELIVERY_ROUTE_PROFILES[route as DeliveryRoute]?.posModifier ?? 1.0;
}

export function getRoutePeakSalesModifier(route?: string): number {
  if (!route) return 1.0;
  return DELIVERY_ROUTE_PROFILES[route as DeliveryRoute]?.peakSalesModifier ?? 1.0;
}

export function getRouteDealPremium(route?: string): number {
  if (!route) return 0;
  return DELIVERY_ROUTE_PROFILES[route as DeliveryRoute]?.dealPremium ?? 0;
}

export function getRouteTimelineModifier(route?: string): number {
  if (!route) return 0;
  return DELIVERY_ROUTE_PROFILES[route as DeliveryRoute]?.timelineModifier ?? 0;
}

export function getRouteCogsMultiplier(route?: string): number {
  if (!route) return 1.0;
  return DELIVERY_ROUTE_PROFILES[route as DeliveryRoute]?.cogsMultiplier ?? 1.0;
}

// ---------------------------------------------------------------------------
// Deprecated backward compatibility shim
// ---------------------------------------------------------------------------

const LEGACY_ROUTE_MAP: Record<string, DeliveryRoute> = {
  oral: 'oral',
  injectable: 'sc',
  implantable: 'implantable',
};

export function legacyRouteToDeliveryRoute(legacyRoute?: string): DeliveryRoute | undefined {
  if (!legacyRoute) return undefined;
  return LEGACY_ROUTE_MAP[legacyRoute];
}

// ---------------------------------------------------------------------------
// Default route inference from modality
// ---------------------------------------------------------------------------

const MODALITY_DEFAULT_ROUTE: Record<string, DeliveryRoute> = {
  smallMolecule: 'oral',
  mab: 'iv',
  adc: 'iv',
  bispecific: 'iv',
  trispecificAntibody: 'iv',
  tCellEngager: 'iv',
  carT_heme: 'iv',
  carT_solid: 'iv',
  cellTherapy: 'iv',
  geneTherapy: 'gene_therapy_vector',
  geneTherapyOcular: 'intravitreal',
  geneTherapyRare: 'gene_therapy_vector',
  radiopharmaceutical: 'iv',
  mrna: 'iv',
  rnai: 'sc',
  protac: 'oral',
  molecularGlue: 'oral',
  peptide: 'sc',
  therapeuticVaccine: 'sc',
  oncolyticVirus: 'iv',
  bbbPlatform: 'iv',
  aso: 'intrathecal',
  psychedelic: 'oral',
  ionChannel: 'oral',
  tauTargeting: 'iv',
  stemCell: 'iv',
  oligonucleotide: 'sc',
  carT_autoimmune: 'iv',
  inVivoCarT: 'iv',
  carTreg: 'iv',
  fcrnAntagonist: 'sc',
  complementInhibitor: 'iv',
  jakInhibitor: 'oral',
  s1pModulator: 'oral',
  oralIntegrin: 'oral',
  dualAntagonist: 'oral',
  tl1aInhibitor: 'iv',
  glp1Agonist: 'autoinjector',
  dualIncretin: 'autoinjector',
  tripleIncretin: 'autoinjector',
  sglt2Inhibitor: 'oral',
  amylinAnalog: 'autoinjector',
  oralPeptide: 'oral',
  antiviral: 'oral',
  antibioticNovel: 'iv',
  vaccinePreventive: 'sc',
  antiVegf: 'intravitreal',
  intravitreal: 'intravitreal',
  topicalOphthalmic: 'topical',
  il17Inhibitor: 'sc',
  il13Inhibitor: 'sc',
  jakInhibitorDerm: 'topical',
  topicalBiologic: 'topical',
  antiTl1a: 'iv',
  il23GI: 'sc',
  gutSelectiveIntegrin: 'iv',
  enzymeReplacement: 'iv',
  substrateReduction: 'oral',
  gnrhAntagonist: 'oral',
  hormoneTherapy: 'oral',
  neuroactiveSteroid: 'oral',
  myosinInhibitor: 'oral',
  pcsk9Targeting: 'sc',
};

export function getDefaultRouteForModality(modality: string): DeliveryRoute | undefined {
  return MODALITY_DEFAULT_ROUTE[modality];
}
