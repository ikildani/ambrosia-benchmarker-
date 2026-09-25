/**
 * Deal Intelligence Brief v3 — landscape builders.
 *
 *  - buildPipelineMap      who else is developing for this indication, by modality bucket × phase
 *  - buildCatalystCalendar what reads out / loses exclusivity in the next N months
 *  - buildPatientFunnel    where the peak-sales number comes from (pure, from MarketSizeEstimate)
 *  - buildLandscape        runs the three with Promise.allSettled
 *
 * Data source is `company_trials` (ClinicalTrials.gov via Solidus). `clinical_assets`
 * is deliberately not used: its indication_category is coarse (cns, solid_tumor…)
 * and indication_specific rarely names the disease.
 *
 * Database facts this file respects (checked Sep 2026 against Alzheimer's rows):
 *  - status is lowercase snake_case: recruiting | active_not_recruiting |
 *    not_yet_recruiting | enrolling_by_invitation | completed | terminated | …
 *    (older code queried upper-case strings; both spellings are tolerated here)
 *  - lead_sponsor_class: INDUSTRY | OTHER | NIH | OTHER_GOV | FED | NETWORK | null
 *  - modality: small_molecule | antibody | adc | radiopharm | cell_therapy |
 *    peptide | gene_therapy | oligonucleotide | other
 *  - phase: early_phase_1 | phase_1 | phase_1_2 | phase_2 | phase_2_3 | phase_3 |
 *    phase_4 | not_applicable | unknown
 *  - conditions is text[]; PostgREST cannot ilike array elements and an
 *    `overlaps` filter on it times out (no GIN index). We therefore fetch by
 *    indication_category + status server-side (indexed, ~4.5k active CNS rows)
 *    and match the indication client-side with regexes over conditions,
 *    indication_specific and trial_title.
 *  - companies.patent_cliffs shapes vary: {drug_name|drug, expiry_year|loe_year|year,
 *    revenue_usd|revenue}; indication_patent_cliffs has indication, drug,
 *    loe_year, biosimilar_year, current_revenue_usd_m.
 */

import type {
  AssetProfile,
  CatalystCalendar,
  CatalystEvent,
  DealPhase,
  Landscape,
  PatientFunnel,
  PipelineCell,
  PipelineMap,
  Range3,
} from './types';
import type { MarketSizeEstimate, RNPVResult } from '@/lib/financial/types';

// ─── Minimal client shape (lets tests stub the client) ─────────────────────

/** Anything with a PostgREST-style `from()` — a SupabaseClient satisfies this. */
export interface LandscapeDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

// ─── Constants ─────────────────────────────────────────────────────────────

export const PIPELINE_PHASES: DealPhase[] = ['preclinical', 'phase_1', 'phase_2', 'phase_3', 'approved'];

export const BUCKETS = [
  'Antibody',
  'Small molecule',
  'ASO/RNA',
  'Gene therapy',
  'Cell therapy',
  'Vaccine',
  'Peptide/protein',
  'Other',
] as const;
export type Bucket = (typeof BUCKETS)[number];

const ACTIVE_STATUSES = ['recruiting', 'active_not_recruiting', 'not_yet_recruiting', 'enrolling_by_invitation'];
const ACTIVE_STATUS_FILTER = [...ACTIVE_STATUSES, ...ACTIVE_STATUSES.map(s => s.toUpperCase())];

const READOUT_PHASES = ['phase_2', 'phase_2_3', 'phase_3', 'PHASE2', 'PHASE3', 'PHASE2_PHASE3'];

const PHASE_RANK: Record<DealPhase, number> = {
  discovery: 0, preclinical: 1, phase_1: 2, phase_2: 3, phase_3: 4, approved: 5, unknown: -1,
};

const TRIAL_COLUMNS = [
  'nct_id', 'trial_title', 'company_name', 'lead_sponsor_name', 'lead_sponsor_class',
  'intervention_name', 'intervention_type', 'modality', 'target',
  'indication_category', 'indication_specific', 'conditions',
  'phase', 'status', 'primary_completion_date', 'completion_date',
].join(',');

const PAGE_SIZE = 1000;
const MAX_PAGES = 6;

/** Calculator therapeutic area → company_trials.indication_category. */
const TA_TO_CATEGORY: Record<string, string[]> = {
  oncology: ['solid_tumor', 'hematological'],
  hematology: ['hematological'],
  immunology: ['autoimmune'],
  neurology: ['cns'],
  metabolic: ['metabolic'],
  cardiovascular: ['cardiovascular'],
  infectiousDisease: ['infectious'],
  rareDisease: ['rare_disease'],
  dermatology: ['dermatology'],
  ophthalmology: ['ophthalmology'],
  gastroenterology: ['gastroenterology'],
  womensHealth: ['womens_health'],
};

/** Sponsors treated as "large" for the catalyst direction rule. */
const LARGE_SPONSORS = [
  'lilly', 'roche', 'genentech', 'novartis', 'pfizer', 'merck', 'janssen', 'johnson & johnson',
  'abbvie', 'bristol', 'astrazeneca', 'glaxosmithkline', 'gsk', 'sanofi', 'bayer', 'takeda',
  'eisai', 'biogen', 'amgen', 'gilead', 'novo nordisk', 'boehringer', 'otsuka', 'daiichi',
  'astellas', 'regeneron', 'vertex', 'ucb', 'lundbeck', 'teva', 'servier', 'ipsen',
];

// ─── Indication matching ───────────────────────────────────────────────────

interface IndicationSpec {
  /** Any of these regexes matching a condition string counts as a hit. */
  patterns: RegExp[];
  /** Exact ClinicalTrials.gov condition strings (used only for the no-category fallback query). */
  exact: string[];
  /** indication_category hint when the TA is unknown. */
  category?: string;
}

/** Synonyms for common data/epidemiology.json keys. Others fall back to key-derived words. */
const SYNONYMS: Record<string, { any: string[]; exact?: string[]; category?: string }> = {
  alzheimers: { any: ['alzheimer'], exact: ['Alzheimer Disease', "Alzheimer's Disease", 'Alzheimers Disease'], category: 'cns' },
  parkinsons: { any: ['parkinson'], exact: ['Parkinson Disease', "Parkinson's Disease"], category: 'cns' },
  als: { any: ['amyotrophic lateral sclerosis', '\\bals\\b', 'motor neuron'], exact: ['Amyotrophic Lateral Sclerosis'], category: 'cns' },
  huntingtons: { any: ['huntington'], exact: ['Huntington Disease'], category: 'cns' },
  ms: { any: ['multiple sclerosis'], exact: ['Multiple Sclerosis'], category: 'cns' },
  multipleSclerosisMod: { any: ['multiple sclerosis'], exact: ['Multiple Sclerosis'], category: 'autoimmune' },
  migraine: { any: ['migraine'], exact: ['Migraine'], category: 'cns' },
  epilepsy: { any: ['epilep', 'seizure'], exact: ['Epilepsy'], category: 'cns' },
  schizophrenia: { any: ['schizophren'], exact: ['Schizophrenia'], category: 'cns' },
  depression: { any: ['depress'], exact: ['Depression', 'Major Depressive Disorder'], category: 'cns' },
  bipolar: { any: ['bipolar'], exact: ['Bipolar Disorder'], category: 'cns' },
  frontotemporal: { any: ['frontotemporal'], exact: ['Frontotemporal Dementia'], category: 'cns' },
  lewyBody: { any: ['lewy'], exact: ['Lewy Body Dementia'], category: 'cns' },
  dravet: { any: ['dravet'], exact: ['Dravet Syndrome'], category: 'cns' },
  rett: { any: ['rett'], exact: ['Rett Syndrome'], category: 'cns' },
  dmd: { any: ['duchenne'], exact: ['Duchenne Muscular Dystrophy'], category: 'rare_disease' },
  sma: { any: ['spinal muscular atrophy'], exact: ['Spinal Muscular Atrophy'], category: 'rare_disease' },
  pain: { any: ['\\bpain\\b'], exact: ['Pain'], category: 'cns' },
  chronicPain: { any: ['chronic pain', 'neuropathic pain'], exact: ['Chronic Pain'], category: 'cns' },
  obesity: { any: ['obesity', 'overweight'], exact: ['Obesity'], category: 'metabolic' },
  type2Diabetes: { any: ['type 2 diabetes', 'type ii diabetes', 'diabetes mellitus, type 2'], exact: ['Type 2 Diabetes', 'Diabetes Mellitus, Type 2'], category: 'metabolic' },
  type1Diabetes: { any: ['type 1 diabetes', 'diabetes mellitus, type 1'], exact: ['Type 1 Diabetes', 'Diabetes Mellitus, Type 1'], category: 'metabolic' },
  nashMash: { any: ['steatohepatitis', '\\bnash\\b', '\\bmash\\b'], exact: ['Nonalcoholic Steatohepatitis', 'NASH', 'MASH'], category: 'metabolic' },
  lung_nsclc: { any: ['non-small cell lung', 'non small cell lung', 'nsclc', 'carcinoma, non-small-cell lung'], exact: ['Non-small Cell Lung Cancer', 'Carcinoma, Non-Small-Cell Lung'], category: 'solid_tumor' },
  lung_sclc: { any: ['small cell lung', 'sclc'], exact: ['Small Cell Lung Cancer'], category: 'solid_tumor' },
  breast_her2: { any: ['her2.{0,12}breast', 'breast.{0,30}her2'], exact: ['HER2-positive Breast Cancer'], category: 'solid_tumor' },
  breast_tnbc: { any: ['triple.negative', 'tnbc'], exact: ['Triple Negative Breast Cancer'], category: 'solid_tumor' },
  breast_hr: { any: ['hr\\+', 'hormone receptor', 'er\\+', 'estrogen receptor'], exact: ['HR+ Breast Cancer'], category: 'solid_tumor' },
  colorectal: { any: ['colorectal', 'colon cancer', 'rectal cancer'], exact: ['Colorectal Cancer'], category: 'solid_tumor' },
  pancreatic: { any: ['pancrea'], exact: ['Pancreatic Cancer'], category: 'solid_tumor' },
  melanoma: { any: ['melanoma'], exact: ['Melanoma'], category: 'solid_tumor' },
  prostate: { any: ['prostat'], exact: ['Prostate Cancer'], category: 'solid_tumor' },
  ovarian: { any: ['ovarian'], exact: ['Ovarian Cancer'], category: 'solid_tumor' },
  gastric: { any: ['gastric', 'stomach', 'gastroesophageal'], exact: ['Gastric Cancer'], category: 'solid_tumor' },
  liver: { any: ['hepatocellular', 'liver cancer', '\\bhcc\\b'], exact: ['Hepatocellular Carcinoma'], category: 'solid_tumor' },
  renal: { any: ['renal cell', 'kidney cancer'], exact: ['Renal Cell Carcinoma'], category: 'solid_tumor' },
  gbm: { any: ['glioblastoma', 'glioma'], exact: ['Glioblastoma'], category: 'solid_tumor' },
  bladder: { any: ['bladder', 'urothelial'], exact: ['Bladder Cancer', 'Urothelial Carcinoma'], category: 'solid_tumor' },
  headNeck: { any: ['head and neck'], exact: ['Head and Neck Cancer'], category: 'solid_tumor' },
  mesothelioma: { any: ['mesothelioma'], exact: ['Mesothelioma'], category: 'solid_tumor' },
  aml: { any: ['acute myeloid', '\\baml\\b'], exact: ['Acute Myeloid Leukemia'], category: 'hematological' },
  all: { any: ['acute lymphoblastic', 'acute lymphocytic'], exact: ['Acute Lymphoblastic Leukemia'], category: 'hematological' },
  cll: { any: ['chronic lymphocytic'], exact: ['Chronic Lymphocytic Leukemia'], category: 'hematological' },
  myeloma: { any: ['myeloma'], exact: ['Multiple Myeloma'], category: 'hematological' },
  dlbcl: { any: ['diffuse large b', 'dlbcl'], exact: ['Diffuse Large B-Cell Lymphoma'], category: 'hematological' },
  mds: { any: ['myelodysplastic'], exact: ['Myelodysplastic Syndromes'], category: 'hematological' },
  rheumatoidArthritis: { any: ['rheumatoid'], exact: ['Rheumatoid Arthritis'], category: 'autoimmune' },
  sle_lupus: { any: ['lupus'], exact: ['Systemic Lupus Erythematosus', 'Lupus Erythematosus, Systemic'], category: 'autoimmune' },
  lupusNephritis: { any: ['lupus nephritis'], exact: ['Lupus Nephritis'], category: 'autoimmune' },
  atopicderm: { any: ['atopic dermatitis', 'eczema'], exact: ['Atopic Dermatitis'], category: 'autoimmune' },
  psoriasis: { any: ['psoriasis'], exact: ['Psoriasis'], category: 'autoimmune' },
  psoriaticArthritis: { any: ['psoriatic arthritis'], exact: ['Psoriatic Arthritis'], category: 'autoimmune' },
  ulcerativeColitis: { any: ['ulcerative colitis'], exact: ['Ulcerative Colitis'], category: 'autoimmune' },
  crohns: { any: ['crohn'], exact: ['Crohn Disease', "Crohn's Disease"], category: 'autoimmune' },
  ibd_broad: { any: ['inflammatory bowel', 'crohn', 'ulcerative colitis'], exact: ['Inflammatory Bowel Diseases'], category: 'autoimmune' },
  myastheniaGravis: { any: ['myasthenia'], exact: ['Myasthenia Gravis'], category: 'autoimmune' },
  ipf: { any: ['idiopathic pulmonary fibrosis', '\\bipf\\b'], exact: ['Idiopathic Pulmonary Fibrosis'], category: 'autoimmune' },
  copd: { any: ['chronic obstructive', '\\bcopd\\b'], exact: ['Chronic Obstructive Pulmonary Disease', 'COPD'], category: 'autoimmune' },
  asthma: { any: ['asthma'], exact: ['Asthma'], category: 'autoimmune' },
  heartFailureHfref: { any: ['heart failure'], exact: ['Heart Failure'], category: 'cardiovascular' },
  hfpef: { any: ['preserved ejection', 'hfpef'], exact: ['Heart Failure With Preserved Ejection Fraction'], category: 'cardiovascular' },
  atrialFibrillation: { any: ['atrial fibrillation'], exact: ['Atrial Fibrillation'], category: 'cardiovascular' },
  pulmonaryArterialHypertension: { any: ['pulmonary arterial hypertension', 'pulmonary hypertension'], exact: ['Pulmonary Arterial Hypertension'], category: 'cardiovascular' },
  hivAids: { any: ['\\bhiv\\b'], exact: ['HIV Infections', 'HIV'], category: 'infectious' },
  hepatitisB: { any: ['hepatitis b'], exact: ['Hepatitis B'], category: 'infectious' },
  rsv: { any: ['respiratory syncytial', '\\brsv\\b'], exact: ['Respiratory Syncytial Virus Infections'], category: 'infectious' },
  influenza: { any: ['influenza'], exact: ['Influenza'], category: 'infectious' },
  wetAmd: { any: ['macular degeneration', 'neovascular'], exact: ['Macular Degeneration', 'Wet Macular Degeneration'], category: 'ophthalmology' },
  dryAmdGA: { any: ['geographic atrophy', 'dry.{0,10}macular'], exact: ['Geographic Atrophy'], category: 'ophthalmology' },
  endometriosis: { any: ['endometriosis'], exact: ['Endometriosis'], category: 'womens_health' },
  sickleCell: { any: ['sickle'], exact: ['Sickle Cell Disease'], category: 'rare_disease' },
  cysticFibrosis: { any: ['cystic fibrosis'], exact: ['Cystic Fibrosis'], category: 'rare_disease' },
  hemophiliaA: { any: ['hemophilia a', 'haemophilia a'], exact: ['Hemophilia A'], category: 'rare_disease' },
  attrAmyloidosis: { any: ['transthyretin', 'attr'], exact: ['Transthyretin Amyloidosis'], category: 'rare_disease' },
};

const GENERIC_STOPWORDS = new Set(['disease', 'cancer', 'disorder', 'syndrome', 'broad', 'mod', 'novel', 'only', 'and', 'the', 'of']);

/** Build the matcher for an epidemiology-style indication key (or a free-text indication). */
export function indicationSpec(indication: string): IndicationSpec {
  const key = (indication || '').trim();
  const syn = SYNONYMS[key];
  if (syn) {
    return { patterns: syn.any.map(p => new RegExp(p, 'i')), exact: syn.exact ?? [], category: syn.category };
  }
  // Derive words from the key: split on _, -, space and camelCase; stem a trailing "s".
  const words = key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[\s_\-/]+/)
    .map(w => w.toLowerCase().replace(/[^a-z0-9+]/g, ''))
    .filter(w => w.length >= 3 && !GENERIC_STOPWORDS.has(w))
    .map(w => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w));
  const unique = [...new Set(words)];
  if (unique.length === 0) return { patterns: [], exact: [] };
  // Generic keys require every word to appear (precision over recall).
  const lookaheads = unique.map(w => `(?=[\\s\\S]*${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`).join('');
  return { patterns: [new RegExp(`^${lookaheads}`, 'i')], exact: [] };
}

interface TrialRow {
  nct_id: string | null;
  trial_title: string | null;
  company_name: string | null;
  lead_sponsor_name: string | null;
  lead_sponsor_class: string | null;
  intervention_name: string | null;
  intervention_type: string | null;
  modality: string | null;
  target: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  conditions: string[] | null;
  phase: string | null;
  status: string | null;
  primary_completion_date: string | null;
  completion_date: string | null;
}

/** Does this trial row belong to the indication? Conditions first; title only when conditions are empty. */
export function trialMatchesIndication(row: Pick<TrialRow, 'conditions' | 'indication_specific' | 'trial_title'>, spec: IndicationSpec): boolean {
  if (spec.patterns.length === 0) return false;
  const conds = (row.conditions ?? []).filter(Boolean);
  const haystack = conds.length > 0
    ? [...conds, row.indication_specific ?? ''].join(' | ')
    : [row.indication_specific ?? '', row.trial_title ?? ''].join(' | ');
  return spec.patterns.some(p => p.test(haystack));
}

// ─── Phase & bucket normalisation (pure) ───────────────────────────────────

/** company_trials.phase → PipelineMap column. Returns null for not_applicable/unknown. */
export function normaliseTrialPhase(phase: string | null | undefined): DealPhase | null {
  const k = (phase ?? '').toLowerCase().replace(/[\s/]+/g, '_');
  switch (k) {
    case 'early_phase_1': case 'early_phase1': case 'phase_1': case 'phase1': case 'phase_1_2': case 'phase1_2': case 'phase1_phase2': case 'phase_1_phase_2':
      return 'phase_1';
    case 'phase_2': case 'phase2': case 'phase_2_3': case 'phase2_3': case 'phase2_phase3': case 'phase_2_phase_3':
      return 'phase_2';
    case 'phase_3': case 'phase3':
      return 'phase_3';
    case 'phase_4': case 'phase4': case 'approved':
      return 'approved';
    default:
      return null;
  }
}

/** Asset intake phase (calc keys phase1 / phase2_3 / nda_filed … or deals keys) → DealPhase. */
export function normaliseAssetPhase(phase: string | null | undefined): DealPhase {
  const k = (phase ?? '').toLowerCase().replace(/[\s/-]+/g, '_');
  if (k === 'discovery') return 'discovery';
  if (k === 'preclinical' || k === 'ind_enabling') return 'preclinical';
  if (k === 'nda_filed' || k === 'nda' || k === 'bla' || k === 'approved' || k === 'phase_4' || k === 'phase4') return 'approved';
  return normaliseTrialPhase(k) ?? 'unknown';
}

/** Modality/intervention → one of the 8 pipeline buckets. */
export function normaliseBucket(modality: string | null | undefined, interventionType?: string | null, interventionName?: string | null): Bucket {
  const m = (modality ?? '').toLowerCase().replace(/[\s_-]+/g, '');
  if (m && m !== 'other' && m !== 'unknown') {
    if (/(antibody|^mab$|bispecific|trispecific|^adc$|tcellengager|nanobody|immunoglobulin|checkpoint)/.test(m)) return 'Antibody';
    if (/(smallmolecule|protac|molecularglue|degrader|ionchannel|jakinhibitor|s1pmodulator|oralintegrin|psychedelic|tautargeting|kinase)/.test(m)) return 'Small molecule';
    if (/(oligo|^aso$|antisense|rnai|sirna|mrna|^rna$|nucleotide|microrna)/.test(m)) return 'ASO/RNA';
    if (/(genetherapy|geneediting|crispr|^aav$|genetic)/.test(m)) return 'Gene therapy';
    if (/(celltherapy|cart|^nk|stemcell|^til$|treg|cellular)/.test(m)) return 'Cell therapy';
    if (/vaccine/.test(m)) return 'Vaccine';
    if (/(peptide|protein|enzyme|fusion|hormone|insulin|incretin|glp|cytokine|fcrn|complement|biologic)/.test(m)) return 'Peptide/protein';
    if (/(radiopharm|radioligand|oncolytic|bbbplatform|device)/.test(m)) return 'Other';
  }
  const name = (interventionName ?? '').toLowerCase();
  if (name) {
    if (/\b\w+mab\b/.test(name)) return 'Antibody';
    if (/vaccine/.test(name)) return 'Vaccine';
    if (/(antisense|\baso\b|sirna|oligonucleotide|\brna\b|mrna)/.test(name)) return 'ASO/RNA';
    if (/(gene therapy|\baav\b|crispr)/.test(name)) return 'Gene therapy';
    if (/(car-t|car t|cell therapy|stem cell|\bnk cell)/.test(name)) return 'Cell therapy';
    if (/\b\w+(tide|relin|semag)\b/.test(name)) return 'Peptide/protein';
  }
  const t = (interventionType ?? '').toUpperCase();
  if (t === 'DRUG') return 'Small molecule';
  if (t === 'BIOLOGICAL') return 'Peptide/protein';
  if (t === 'GENETIC') return 'Gene therapy';
  return 'Other';
}

// ─── Crowding score (pure) ─────────────────────────────────────────────────

/**
 * Crowding score, 0–100.
 *   A = programs in the asset's bucket at or ahead of the asset's phase
 *   T = all programs on the map
 *   score = 60 · min(1, A / 10)  +  40 · (A / T)
 * Sixty points saturate at ten same-mechanism programs at-or-ahead (the count a
 * buyer will see in a landscape slide); forty points scale with that bucket's
 * share of the whole indication map (is the crowd *in our lane*?).
 */
export function crowdingScore(atOrAhead: number, total: number): number | null {
  if (!Number.isFinite(atOrAhead) || !Number.isFinite(total) || total <= 0) return null;
  const a = Math.max(0, atOrAhead);
  const score = 60 * Math.min(1, a / 10) + 40 * Math.min(1, a / total);
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * One display name per sponsor across registry spellings: "F. Hoffmann-La
 * Roche AG", "Hoffmann-La Roche Limited" and "Hoffmann-La Roche" collapse to
 * one row so program and sponsor counts are not inflated by legal suffixes.
 */
export function canonicalSponsor(name: string): string {
  let n = name.trim().replace(/\s+/g, ' ');
  n = n.replace(/^F\.\s+/i, '');
  for (let i = 0; i < 3; i++) {
    n = n.replace(/[,\s]+(AG|A\.G\.|Ltd\.?|Limited|Inc\.?|Incorporated|LLC|L\.L\.C\.|Corp\.?|Corporation|GmbH|S\.?A\.?|S\.?p\.?A\.?|plc|PLC|N\.?V\.?|B\.?V\.?|Pty|K\.?K\.?)\s*$/i, '').trim();
  }
  return n || name.trim();
}

function sponsorOf(r: TrialRow): string {
  return canonicalSponsor(r.lead_sponsor_name || r.company_name || 'Undisclosed sponsor');
}

function isIndustry(r: TrialRow): boolean {
  return (r.lead_sponsor_class ?? '').toUpperCase().includes('INDUSTRY');
}

function isLargeSponsor(name: string): boolean {
  const n = name.toLowerCase();
  return LARGE_SPONSORS.some(s => n.includes(s));
}

function matchesBuyer(name: string, buyerNames: string[]): boolean {
  const n = name.toLowerCase();
  return buyerNames.some(b => {
    const bb = b.toLowerCase().trim();
    return bb.length >= 3 && (n.includes(bb) || bb.includes(n));
  });
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function monthsBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso); const b = new Date(bIso);
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

function todayIso(): string { return new Date().toISOString().slice(0, 10); }

function categoriesFor(asset: AssetProfile, spec: IndicationSpec): string[] {
  const fromTa = TA_TO_CATEGORY[asset.therapeuticArea] ?? [];
  const set = new Set<string>(fromTa);
  if (spec.category) set.add(spec.category);
  return [...set];
}

function sanitizeForOr(s: string): string {
  return s.replace(/[,()."'\\%]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Fetch ─────────────────────────────────────────────────────────────────

interface FetchOpts {
  phases?: string[];
  completionFrom?: string;
  completionTo?: string;
}

/**
 * Fetch active trials for the asset's indication. Server side: category + status
 * (+ phase / date window). Client side: indication regex over conditions.
 */
async function fetchIndicationTrials(db: LandscapeDb, asset: AssetProfile, spec: IndicationSpec, opts: FetchOpts = {}): Promise<TrialRow[]> {
  const cats = categoriesFor(asset, spec);
  const out: TrialRow[] = [];

  const applyCommon = (q: any) => {
    q = q.in('status', ACTIVE_STATUS_FILTER);
    if (opts.phases?.length) q = q.in('phase', opts.phases);
    if (opts.completionFrom) q = q.gte('primary_completion_date', opts.completionFrom);
    if (opts.completionTo) q = q.lte('primary_completion_date', opts.completionTo);
    return q;
  };

  if (cats.length === 0) {
    // No category to scope by: fall back to exact condition strings + indication_specific ilike.
    const firstWord = spec.patterns[0]?.source.replace(/[^a-z0-9 ]/gi, '').trim().split(' ')[0] ?? '';
    const ors = [
      ...spec.exact.map(e => `conditions.cs.{"${sanitizeForOr(e)}"}`),
      ...(firstWord ? [`indication_specific.ilike.%${firstWord}%`] : []),
    ];
    if (ors.length === 0) return [];
    let q = db.from('company_trials').select(TRIAL_COLUMNS).or(ors.join(','));
    q = applyCommon(q).order('nct_id', { ascending: true }).limit(PAGE_SIZE);
    const { data, error } = await q;
    if (error) throw new Error(`[Brief] company_trials fallback query failed: ${error.message ?? String(error)}`);
    for (const r of (data ?? []) as TrialRow[]) if (trialMatchesIndication(r, spec)) out.push(r);
    return out;
  }

  for (let page = 0; page < MAX_PAGES; page++) {
    let q = db.from('company_trials').select(TRIAL_COLUMNS).in('indication_category', cats);
    q = applyCommon(q).order('nct_id', { ascending: true }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const { data, error } = await q;
    if (error) throw new Error(`[Brief] company_trials query failed: ${error.message ?? String(error)}`);
    const rows = (data ?? []) as TrialRow[];
    for (const r of rows) if (trialMatchesIndication(r, spec)) out.push(r);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

// ─── Pipeline map ──────────────────────────────────────────────────────────

interface Program {
  sponsor: string;
  intervention: string;
  nctId: string | null;
  status: string | null;
  phase: DealPhase;
  bucket: Bucket;
  industry: boolean;
  isBuyerCandidate: boolean;
}

/** Collapse trial rows to programs: one per (sponsor, intervention), most advanced phase wins. */
export function programsFromTrials(rows: TrialRow[], buyerNames: string[]): Program[] {
  const byKey = new Map<string, Program>();
  for (const r of rows) {
    const phase = normaliseTrialPhase(r.phase);
    if (!phase) continue;
    const sponsor = sponsorOf(r);
    const intervention = (r.intervention_name || r.target || 'Undisclosed').trim();
    const key = `${sponsor.toLowerCase()}|${intervention.toLowerCase().slice(0, 60)}`;
    const p: Program = {
      sponsor, intervention, nctId: r.nct_id, status: r.status, phase,
      bucket: normaliseBucket(r.modality, r.intervention_type, r.intervention_name),
      industry: isIndustry(r), isBuyerCandidate: matchesBuyer(sponsor, buyerNames),
    };
    const prev = byKey.get(key);
    if (!prev || PHASE_RANK[phase] > PHASE_RANK[prev.phase]) byKey.set(key, p);
  }
  return [...byKey.values()];
}

export async function buildPipelineMap(
  db: LandscapeDb,
  asset: AssetProfile,
  opts: { asOf?: string; buyerNames?: string[] } = {},
): Promise<PipelineMap | null> {
  const asOf = opts.asOf ?? todayIso();
  const buyerNames = opts.buyerNames ?? [];
  const spec = indicationSpec(asset.indication);
  const rows = await fetchIndicationTrials(db, asset, spec);
  const all = programsFromTrials(rows, buyerNames);

  // Industry sponsors preferred; include academic/government when the industry set is thin.
  const industry = all.filter(p => p.industry);
  const programs = industry.length >= 8 ? industry : all;
  if (programs.length < 3) return null;

  const assetBucket = normaliseBucket(asset.modality, null, asset.assetName ?? null);
  const assetPhase = normaliseAssetPhase(asset.phase);

  const rowsOut = BUCKETS
    .map(bucket => {
      const cells: PipelineCell[] = PIPELINE_PHASES.map(phase => ({
        phase,
        programs: programs
          .filter(p => p.bucket === bucket && p.phase === phase)
          .sort((a, b) => Number(b.isBuyerCandidate) - Number(a.isBuyerCandidate) || a.sponsor.localeCompare(b.sponsor))
          .map(p => ({ sponsor: p.sponsor, intervention: p.intervention, nctId: p.nctId, status: p.status, isBuyerCandidate: p.isBuyerCandidate })),
      }));
      return { bucket, cells, total: cells.reduce((s, c) => s + c.programs.length, 0) };
    })
    .filter(r => r.total > 0 || r.bucket === assetBucket);

  const totals = PIPELINE_PHASES.reduce((acc, ph) => {
    acc[ph] = programs.filter(p => p.phase === ph).length;
    return acc;
  }, { discovery: 0, unknown: 0 } as Record<DealPhase, number>);

  const assetRank = PHASE_RANK[assetPhase];
  const atOrAhead = assetRank >= 0
    ? programs.filter(p => p.bucket === assetBucket && PHASE_RANK[p.phase] >= assetRank).length
    : NaN;

  return {
    source: {
      source: 'ClinicalTrials.gov via Solidus',
      n: programs.length,
      asOf,
      note: `${industry.length} industry-sponsored programs${programs.length > industry.length ? ', academic and government sponsors included' : ''}; active trials only, one program per sponsor and intervention`,
    },
    rows: rowsOut,
    totals,
    assetPosition: assetPhase === 'unknown' ? null : { bucket: assetBucket, phase: assetPhase },
    crowdingScore: assetPhase === 'unknown' ? null : crowdingScore(atOrAhead, programs.length),
  };
}

// ─── Catalyst calendar ─────────────────────────────────────────────────────

/** CatalystEvent plus the flag the window logic needs (not part of the page contract). */
export interface CatalystEventInternal extends CatalystEvent {
  sameBucket: boolean;
}

/**
 * Recommended go-to-market window: the longest gap of ≥ 3 months between
 * consecutive events before the first same-bucket Phase 3 readout, else the
 * first 6 months of the window.
 */
export function computeRecommendedWindow(
  events: Array<Pick<CatalystEventInternal, 'date' | 'kind' | 'phase' | 'sameBucket'>>,
  asOf: string,
  windowMonths: number,
): CatalystCalendar['recommendedWindow'] {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const threat = sorted.find(e => e.kind === 'readout' && e.phase === 'phase_3' && e.sameBucket);
  if (!threat) {
    return {
      start: asOf,
      end: addMonths(asOf, 6),
      rationale: `No same-mechanism Phase 3 readout inside the ${windowMonths}-month window; go to market now while the class has no fresh pivotal data to reprice against.`,
    };
  }
  // Gaps between consecutive events from asOf up to the threat.
  const points = [asOf, ...sorted.filter(e => e.date < threat.date).map(e => e.date), threat.date];
  let best: { start: string; end: string; months: number } | null = null;
  for (let i = 0; i < points.length - 1; i++) {
    const m = monthsBetween(points[i], points[i + 1]);
    if (m >= 3 && (!best || m > best.months)) best = { start: points[i], end: points[i + 1], months: m };
  }
  const threatMonth = threat.date.slice(0, 7);
  if (best) {
    return {
      start: best.start,
      end: best.end,
      rationale: `${Math.round(best.months)} clear months before the first same-mechanism Phase 3 primary completion (${threatMonth}); close before that data lands, or the buyer will wait to see it.`,
    };
  }
  return {
    start: asOf,
    end: addMonths(asOf, Math.min(6, Math.max(1, Math.floor(monthsBetween(asOf, threat.date))))),
    rationale: `The first same-mechanism Phase 3 reads out ${threatMonth}; no quiet stretch of three months precedes it, so move immediately and run the process in parallel with the readout.`,
  };
}

interface CliffLike { drug: string; year: number; revenueUsd: number | null }

/** Tolerant parser for companies.patent_cliffs jsonb (shapes vary across ingestion runs). */
export function parsePatentCliffs(raw: unknown): CliffLike[] {
  if (!Array.isArray(raw)) return [];
  const out: CliffLike[] = [];
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    const drug = String(o.drug_name ?? o.drug ?? o.name ?? o.product ?? '').trim();
    const yearRaw = o.expiry_year ?? o.loe_year ?? o.year ?? o.expiry ?? o.loe;
    const year = typeof yearRaw === 'number' ? yearRaw : parseInt(String(yearRaw ?? ''), 10);
    if (!drug || !Number.isFinite(year)) continue;
    const revRaw = o.revenue_usd ?? o.revenue ?? o.revenue_usd_m ?? o.annual_revenue_usd;
    let revenueUsd: number | null = typeof revRaw === 'number' ? revRaw : (revRaw != null ? Number(revRaw) : null);
    if (revenueUsd != null && !Number.isFinite(revenueUsd)) revenueUsd = null;
    if (revenueUsd != null && o.revenue_usd_m != null && o.revenue_usd == null && o.revenue == null) revenueUsd = revenueUsd * 1e6;
    out.push({ drug, year, revenueUsd });
  }
  return out;
}

function readoutImpact(p: { phase: DealPhase | null; sameBucket: boolean; isBuyerCandidate: boolean; large: boolean }): { impact: string; direction: CatalystEvent['direction'] } {
  if (p.isBuyerCandidate) {
    return { impact: "Buyer's own program reads out; they will know their gap by then. Direction depends on their data, so it is kept open.", direction: 'mixed' };
  }
  if (p.phase === 'phase_3' && p.sameBucket) {
    return p.large
      ? { impact: 'Repricing event for the mechanism class; a large sponsor with pivotal data sets the reference for every deal after it.', direction: 'down' }
      : { impact: 'Repricing event for the mechanism class.', direction: 'mixed' };
  }
  if (p.phase === 'phase_3') return { impact: 'Pivotal readout in the indication, different mechanism; resets the efficacy bar buyers compare against.', direction: 'mixed' };
  return { impact: 'Sets the bar for differentiation data.', direction: 'mixed' };
}

export async function buildCatalystCalendar(
  db: LandscapeDb,
  asset: AssetProfile,
  opts: { asOf?: string; windowMonths?: number; buyerNames?: string[] } = {},
): Promise<CatalystCalendar | null> {
  const asOf = opts.asOf ?? todayIso();
  const windowMonths = opts.windowMonths ?? 24;
  const buyerNames = opts.buyerNames ?? [];
  const windowEnd = addMonths(asOf, windowMonths);
  const spec = indicationSpec(asset.indication);
  const assetBucket = normaliseBucket(asset.modality, null, asset.assetName ?? null);

  // Readouts
  const fetched = await fetchIndicationTrials(db, asset, spec, { phases: READOUT_PHASES, completionFrom: asOf, completionTo: windowEnd });
  // Industry sponsors preferred (same rule as the pipeline map); academic/government included when thin.
  const industryRows = fetched.filter(isIndustry);
  const rows = industryRows.length >= 8 ? industryRows : fetched;
  const seen = new Map<string, CatalystEventInternal>();
  for (const r of rows) {
    const phase = normaliseTrialPhase(r.phase);
    if (!phase || !r.primary_completion_date) continue;
    const sponsor = sponsorOf(r);
    const intervention = (r.intervention_name || r.target || 'Undisclosed').trim();
    const date = r.primary_completion_date.slice(0, 10);
    // One event per (sponsor, intervention, phase); the same intervention at the same phase
    // completing on the same date is one trial listed under a sponsor-name variant → collapse.
    const key = `${sponsor.toLowerCase()}|${intervention.toLowerCase().slice(0, 60)}|${phase}`;
    const twinKey = `${intervention.toLowerCase().slice(0, 60)}|${phase}|${date}`;
    const prev = seen.get(key);
    if (prev && prev.date <= date) continue;
    if (!prev && [...seen.values()].some(e => `${(e.title.split(' · ')[1] ?? '').toLowerCase().slice(0, 60)}|${e.phase}|${e.date}` === twinKey)) continue;
    const bucket = normaliseBucket(r.modality, r.intervention_type, r.intervention_name);
    const sameBucket = bucket === assetBucket;
    const isBuyer = matchesBuyer(sponsor, buyerNames);
    const { impact, direction } = readoutImpact({ phase, sameBucket, isBuyerCandidate: isBuyer, large: isLargeSponsor(sponsor) || isBuyer });
    const phaseLabel = r.phase?.toLowerCase().includes('2_3') ? 'Phase 2/3' : phase === 'phase_3' ? 'Phase 3' : 'Phase 2';
    seen.set(key, {
      date,
      kind: 'readout',
      title: `${sponsor} · ${intervention} · ${phaseLabel} primary completion`,
      sponsor, phase, nctId: r.nct_id, impact, direction, isBuyerCandidate: isBuyer, sameBucket,
    });
  }
  const readouts = [...seen.values()];

  // LOE events: buyer patent cliffs
  const loe: CatalystEventInternal[] = [];
  const startYear = Number(asOf.slice(0, 4));
  const endYear = Number(windowEnd.slice(0, 4));
  if (buyerNames.length > 0) {
    const ors = buyerNames.map(sanitizeForOr).filter(n => n.length >= 3).map(n => `name.ilike.%${n}%`);
    if (ors.length > 0) {
      const { data, error } = await db.from('companies').select('name,patent_cliffs').or(ors.join(',')).limit(60);
      if (error) throw new Error(`[Brief] companies.patent_cliffs query failed: ${error.message ?? String(error)}`);
      const dedupe = new Set<string>();
      for (const c of (data ?? []) as Array<{ name: string; patent_cliffs: unknown }>) {
        for (const cliff of parsePatentCliffs(c.patent_cliffs)) {
          if (cliff.year < startYear || cliff.year > endYear) continue;
          const date = `${cliff.year}-06-30`;
          if (date < asOf || date > windowEnd) continue;
          const k = `${c.name.toLowerCase()}|${cliff.drug.toLowerCase()}`;
          if (dedupe.has(k)) continue;
          dedupe.add(k);
          const rev = cliff.revenueUsd != null && cliff.revenueUsd > 0 ? ` (${(cliff.revenueUsd / 1e9).toFixed(1)}B revenue at risk)` : '';
          loe.push({
            date, kind: 'loe', title: `${c.name} · ${cliff.drug} loses exclusivity`, sponsor: c.name, phase: null, nctId: null,
            impact: `Revenue gap opens; BD urgency rises${rev}.`, direction: 'up', isBuyerCandidate: true, sameBucket: false,
          });
        }
      }
    }
  }
  // LOE events: indication-level cliffs
  {
    const keyWord = asset.indication.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().split(/[_\s-]+/)[0];
    if (keyWord && keyWord.length >= 3) {
      const { data, error } = await db.from('indication_patent_cliffs').select('indication,drug,loe_year,biosimilar_year,current_revenue_usd_m').ilike('indication', `%${keyWord}%`).limit(40);
      if (error) throw new Error(`[Brief] indication_patent_cliffs query failed: ${error.message ?? String(error)}`);
      for (const c of (data ?? []) as Array<{ indication: string; drug: string; loe_year: number | null; biosimilar_year: number | null; current_revenue_usd_m: number | null }>) {
        const year = c.loe_year ?? null;
        if (year == null || year < startYear || year > endYear) continue;
        const date = `${year}-06-30`;
        if (date < asOf || date > windowEnd) continue;
        if (loe.some(e => e.title.toLowerCase().includes(c.drug.toLowerCase()))) continue;
        const rev = c.current_revenue_usd_m ? ` (${c.current_revenue_usd_m >= 1000 ? `$${(c.current_revenue_usd_m / 1000).toFixed(1)}B` : `$${Math.round(c.current_revenue_usd_m)}M`} current revenue)` : '';
        loe.push({
          date, kind: 'loe', title: `${c.drug} loses exclusivity in the indication`, sponsor: null, phase: null, nctId: null,
          impact: `Branded revenue in the indication erodes${rev}; incumbents look for the next asset.`, direction: 'up', isBuyerCandidate: false, sameBucket: false,
        });
      }
    }
  }

  if (readouts.length + loe.length === 0) return null;

  // Cap 24: keep all LOE, then the nearest readouts.
  readouts.sort((a, b) => a.date.localeCompare(b.date));
  const keep = Math.max(0, 24 - loe.length);
  const kept: CatalystEventInternal[] = [...loe, ...readouts.slice(0, keep)].sort((a, b) => a.date.localeCompare(b.date));

  const recommendedWindow = computeRecommendedWindow(readouts.concat(loe), asOf, windowMonths);

  return {
    source: {
      source: 'ClinicalTrials.gov via Solidus; company filings for exclusivity',
      n: readouts.length + loe.length,
      asOf,
      note: `${readouts.length} Phase 2/3 primary completions${rows.length === industryRows.length ? ' (industry sponsors)' : ''} and ${loe.length} exclusivity events in the next ${windowMonths} months${readouts.length > keep ? `; ${keep} nearest readouts shown` : ''}`,
    },
    windowMonths,
    events: kept.map(({ sameBucket: _sb, ...e }) => e),
    recommendedWindow,
  };
}

// ─── Patient funnel (pure) ─────────────────────────────────────────────────

const FUNNEL_STEPS: Array<{ key: keyof MarketSizeEstimate['patientFunnel']; label: string }> = [
  { key: 'totalPopulation', label: 'Population' },
  { key: 'prevalentPatients', label: 'Prevalent patients' },
  { key: 'diagnosedPatients', label: 'Diagnosed' },
  { key: 'treatedPatients', label: 'Treated' },
  { key: 'drugEligiblePatients', label: 'Drug-eligible' },
  { key: 'addressablePatients', label: 'Addressable' },
];

export function buildPatientFunnel(
  market: MarketSizeEstimate | undefined | null,
  asOf: string,
  rnpv?: Pick<RNPVResult, 'peakSalesApplied'> | null,
): PatientFunnel | null {
  if (!market || !market.patientFunnel || !market.peakSales) return null;
  const pf = market.patientFunnel;
  const steps = FUNNEL_STEPS
    .map(s => ({ label: s.label, value: Number(pf[s.key]) }))
    .filter(s => Number.isFinite(s.value) && s.value > 0);
  if (steps.length < 2) return null;

  let pricePerYearUsd: number | null = null;
  if (Number.isFinite(market.annualRevenuePerPatient) && market.annualRevenuePerPatient > 0) {
    pricePerYearUsd = Math.round(market.annualRevenuePerPatient);
  } else if (market.totalAddressableMarket > 0 && pf.prevalentPatients > 0) {
    pricePerYearUsd = Math.round((market.totalAddressableMarket * 1e6) / pf.prevalentPatients);
  }

  // One peak-sales number for the whole brief: the figure the financial
  // model actually ran with (after the TAM ceiling and modifiers). The share
  // of addressable patients is then derived from it, so the funnel and the
  // rNPV page can never disagree. Without a model result, the market
  // estimate and its share assumption are used as-is.
  const applied = rnpv?.peakSalesApplied;
  const useModel = !!applied && [applied.low, applied.median, applied.high].every(v => Number.isFinite(v) && v > 0);
  const peakSalesM = useModel
    ? { low: applied!.low, median: applied!.median, high: applied!.high }
    : { low: market.peakSales.low, median: market.peakSales.median, high: market.peakSales.high };
  const addressable = steps[steps.length - 1].value;
  const share = market.marketShareAssumption;
  let peakShare: Range3 | null = null;
  if (useModel && pricePerYearUsd && addressable > 0) {
    const toShare = (peakM: number) => Math.max(0, Math.min(1, (peakM * 1e6) / (addressable * pricePerYearUsd)));
    peakShare = { low: toShare(peakSalesM.low), median: toShare(peakSalesM.median), high: toShare(peakSalesM.high) };
  } else if (share && [share.low, share.median, share.high].every(v => Number.isFinite(v))) {
    peakShare = { low: share.low, median: share.median, high: share.high };
  }

  const fallback = market.usedFallback
    ? ` · defaults used: ${(market.fallbackReasons ?? ['territory or epidemiology']).slice(0, 2).join(', ')}`
    : '';

  return {
    source: {
      source: 'Solidus epidemiology model',
      n: steps.length,
      asOf,
      note: `${market.territory}${market.sources?.length ? ` · ${market.sources.slice(0, 2).join('; ')}` : ''}${fallback}`,
    },
    territory: market.territory,
    steps,
    pricePerYearUsd,
    peakShare,
    peakSalesM,
    peakSalesBasis: useModel ? 'model' : 'market',
  };
}

// ─── Landscape ─────────────────────────────────────────────────────────────

export async function buildLandscape(
  db: LandscapeDb,
  asset: AssetProfile,
  market: MarketSizeEstimate | undefined | null,
  opts: { asOf?: string; windowMonths?: number; buyerNames?: string[]; rnpv?: Pick<RNPVResult, 'peakSalesApplied'> | null } = {},
): Promise<Landscape> {
  const asOf = opts.asOf ?? todayIso();
  const [pipeline, catalysts, funnel] = await Promise.allSettled([
    buildPipelineMap(db, asset, { asOf, buyerNames: opts.buyerNames }),
    buildCatalystCalendar(db, asset, { asOf, windowMonths: opts.windowMonths, buyerNames: opts.buyerNames }),
    Promise.resolve().then(() => buildPatientFunnel(market, asOf, opts.rnpv)),
  ]);
  const settle = <T>(r: PromiseSettledResult<T | null>, label: string): T | null => {
    if (r.status === 'fulfilled') return r.value;
    console.error(`[Brief] landscape.${label} failed:`, r.reason instanceof Error ? r.reason.message : r.reason);
    return null;
  };
  return {
    pipeline: settle(pipeline, 'pipeline'),
    catalysts: settle(catalysts, 'catalysts'),
    funnel: settle(funnel, 'funnel'),
  };
}
