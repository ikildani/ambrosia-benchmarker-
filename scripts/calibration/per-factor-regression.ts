/**
 * Per-factor calibration study (2026-09).
 *
 * Question answered: "Is there a quantitative lookback behind each engine
 * multiplier (first-in-class 1.25, pivotal-ready 1.15, 1L 1.25, US-only 0.55,
 * ADC 1.45, ...)?"  This script fits a ridge-regularised log-linear model of
 * observed deal value on one-hot factor dummies, using the SAME corpus the
 * whole-model backtest uses (`getAllBacktestCases()`), and compares each
 * implied multiplier exp(beta) with the engine's configured multiplier and the
 * dampened value the engine actually applies (multiplier ^ exponent).
 *
 * Model
 *   r_i = ln(actual_i / baselineMedian[TA_i][phase_i])
 *   r_i = a + sum_f beta_f * dummy_{f,i} + year FE + TA FE + phase FE + e_i
 *   beta = (X'X + lambda*I)^-1 X'y   (intercept unpenalised)
 *   95% CI from 200 row-bootstrap resamples (percentile method).
 *
 * The engine computes total = baselineMedian * prod(m_k ^ e_k) * dealTypeFactor,
 * so in log space each configured factor is additive and exp(beta) is directly
 * comparable to the factor's applied value m^e (reference level = 1.0).
 *
 * This is an EVIDENCE-PRODUCING study. It reads data/benchmarks.json and the
 * backtest corpus; it does not modify any engine number.
 *
 * Run:  npx tsx scripts/calibration/per-factor-regression.ts
 *       (or `npm run calibration:per-factor`)
 * Out:  scripts/calibration/output/per-factor-2026-09.json
 */

import * as fs from 'fs';
import * as path from 'path';
import benchmarks from '@/data/benchmarks.json';
import { getAllBacktestCases, type DealBacktestCase } from '@/lib/financial/backtest/deal-backtest';
import { EXTENDED_COMPARABLE_DEALS, type ExtendedComparableDeal } from '@/data/comparable-deals-extended';
import { SUPABASE_COMPARABLE_DEALS } from '@/data/comparable-deals-supabase';
import { CALIBRATION_DEALS } from '@/lib/financial/calibration';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STUDY_TAG = '2026-09';
const RIDGE_LAMBDA = 1.0;
const BOOTSTRAP_N = 200;
const BOOTSTRAP_SEED = 20260907;
const MIN_N_FOR_VERDICT = 15;
/** Levels with fewer cases than this are pooled into a family "thin" bucket. */
const MIN_N_OWN_LEVEL = 5;
const REFERENCE_YEAR = 2024;

const OUT_DIR = path.join(process.cwd(), 'scripts', 'calibration', 'output');
const OUT_JSON = path.join(OUT_DIR, `per-factor-${STUDY_TAG}.json`);

// ---------------------------------------------------------------------------
// Engine mirrors (read-only). These replicate the lookups in
// lib/calculations.ts calculateDealTerms so the residual is measured against
// exactly the baseline the engine would use for that TA/phase/modality.
// ---------------------------------------------------------------------------

type Baseline = { upfront: { median: number }; totalValue: { median: number } };
type BaselineTable = Record<string, Baseline>;

const B = benchmarks as unknown as Record<string, any>;

function baselineTableFor(ta: string, modality: string): BaselineTable {
  if (ta === 'oncology' || !B[`${ta}PhaseBaselines`]) return B.phaseBaselines; // engine fallback for unknown TA
  if (ta === 'rareDisease') {
    if (modality === 'geneTherapy' || modality === 'geneTherapyRare') return B.rareDiseaseGeneTherapyPhaseBaselines;
    if (modality === 'smallMolecule' || modality === 'enzymeReplacement' || modality === 'substrateReduction') {
      return B.rareDiseaseChronicPhaseBaselines;
    }
  }
  return B[`${ta}PhaseBaselines`];
}

/** TA-specific dampening exponents, mirrored from calculateDealTerms. */
function indicationExp(ta: string): number {
  switch (ta) {
    case 'neurology': return 0.90;
    case 'immunology': return 0.85;
    case 'metabolic': return 0.85;
    case 'cardiovascular': return 0.85;
    case 'infectiousDisease': return 0.85;
    case 'ophthalmology': return 0.90;
    case 'womensHealth': return 0.85;
    default: return 0.80; // oncology + others
  }
}
function comboExp(ta: string): number {
  switch (ta) {
    case 'neurology': return 0.90;
    case 'immunology': return 0.80;
    case 'metabolic': return 0.85;
    case 'cardiovascular': return 0.80;
    case 'infectiousDisease': return 0.85;
    case 'ophthalmology': return 0.85;
    case 'womensHealth': return 0.80;
    default: return 0.75;
  }
}

/** Phase-specific deal-type factors, mirrored from calculateDealTerms. */
const DEAL_TYPE_BY_PHASE: Record<string, Record<string, number>> = {
  acquisition: { discovery: 0.30, preclinical: 0.60, phase1: 0.60, phase1_2: 0.70, phase2: 0.90, phase2_3: 1.10, phase3: 1.35, nda_filed: 1.50, approved: 1.65 },
  option: { discovery: 0.35, preclinical: 0.45, phase1: 0.70, phase1_2: 0.75, phase2: 0.80, phase2_3: 0.85, phase3: 0.90, nda_filed: 0.93, approved: 0.95 },
  codevelopment: { discovery: 0.55, preclinical: 0.65, phase1: 0.75, phase1_2: 0.80, phase2: 0.85, phase2_3: 0.90, phase3: 0.92, nda_filed: 0.95, approved: 0.95 },
  collaboration: { discovery: 0.30, preclinical: 0.40, phase1: 0.55, phase1_2: 0.58, phase2: 0.65, phase2_3: 0.72, phase3: 0.80, nda_filed: 0.85, approved: 0.90 },
  reformulation: { discovery: 0.25, preclinical: 0.35, phase1: 0.45, phase1_2: 0.50, phase2: 0.55, phase2_3: 0.60, phase3: 0.65, nda_filed: 0.70, approved: 0.75 },
};

// ---------------------------------------------------------------------------
// Corpus normalisation
// ---------------------------------------------------------------------------

/** Corpus modality strings -> engine modality keys (data/benchmarks.json modalities). */
const MODALITY_TO_ENGINE: Record<string, string> = {
  antibody: 'mab',
  adc_trop2: 'adc',
  adc_her2: 'adc',
  geneTherapyRare: 'geneTherapy',
  geneTherapyOcular: 'geneTherapy',
  geneEditing: 'geneTherapy',
  crispr_base_editing: 'geneTherapy',
  carT_allogeneic: 'carT_heme',
  tce_bcma: 'tCellEngager',
  rna: 'rnai',
  microRNA: 'oligonucleotide',
  circRNA: 'mrna',
  covalent_inhibitor: 'smallMolecule',
  allosteric_inhibitor: 'smallMolecule',
  pcsk9Targeting: 'smallMolecule',
};

/** Corpus territory strings -> engine territory keys; unmapped stay as-is (engine has no value). */
const TERRITORY_TO_ENGINE: Record<string, string> = {
  us: 'us_only',
  japan_only: 'japan',
  north_america: 'north_america', // not an engine key — engine silently applies 1.0
  ex_china: 'ex_china',           // not an engine key — engine silently applies 1.0
  asia_pacific: 'apac_ex_cj',
  regional: 'regional',
  other: 'other',
};

const norm = (s: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Free-text corpus indication -> normalised engine key (after norm()). */
const INDICATION_ALIASES: Record<string, string> = {
  mash: 'nashmash', nash: 'nashmash', mashnash: 'nashmash', nafldnash: 'nashmash',
  sicklecelldisease: 'sicklecell',
  obesitytype2diabetes: 'obesity',
  ulcerativecolitiscrohnsdisease: 'ulcerativecolitis',
  inflammatoryboweldisease: 'ibdbroad', ibd: 'ibdbroad',
  systemiclupuserythematosus: 'slelupus', lupus: 'slelupus',
  parkinsonsdisease: 'parkinsons',
  alzheimersdisease: 'alzheimers',
  elevatedlpa: 'lipoproteina',
  geographicatrophy: 'dryamdga',
  sclc: 'lungsclc',
  chronichepatitisbvirushbvinfection: 'hepatitisb', hepatitisbandhepatitisd: 'hepatitisb',
  iganephropathy: 'igan',
  hiv: 'hivaids',
  friedreichataxia: 'friedreichs',
  hemophilia: 'hemophiliaa',
  heartfailure: 'heartfailurehfref',
  multiplemyeloma: 'myeloma',
  hypertrophiccardiomyopathy: 'hypertrophiccardiomyopathy',
  attramyloidosis: 'attramyloidosis',
  breast: 'breasthr',
  type2diabetes: 'type2diabetes',
};

type EngineIndication = { category: string; key: string; multiplier: number };
const ENGINE_INDICATIONS: Record<string, EngineIndication[]> = {}; // norm(key) -> candidates (category order)
for (const [category, table] of Object.entries(B.indications as Record<string, Record<string, { multiplier: number }>>)) {
  for (const [key, v] of Object.entries(table)) {
    const n = norm(key);
    (ENGINE_INDICATIONS[n] ??= []).push({ category, key, multiplier: v.multiplier });
  }
}
const TA_CATEGORIES: Record<string, string[]> = {
  oncology: ['solidTumor', 'hematologic'], neurology: ['neurology'], immunology: ['immunology'], metabolic: ['metabolic'],
  cardiovascular: ['cardiovascular'], infectiousDisease: ['infectiousDisease'], ophthalmology: ['ophthalmology'],
  womensHealth: ['womensHealth'], rareDisease: ['rareDisease'], hematology: ['hematology'], dermatology: ['dermatology'],
  gastroenterology: ['gastroenterology'],
};

function matchIndication(ta: string, ...candidates: (string | undefined)[]): EngineIndication | null {
  for (const raw of candidates) {
    if (!raw) continue;
    const n0 = norm(raw);
    const n = INDICATION_ALIASES[n0] ?? n0;
    const hits = ENGINE_INDICATIONS[n];
    if (!hits) continue;
    const preferred = TA_CATEGORIES[ta] ?? [];
    return hits.find(h => preferred.includes(h.category)) ?? hits[0];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Design matrix
// ---------------------------------------------------------------------------

interface Row {
  id: string;
  ta: string;
  phase: string;
  year: number;
  yTotal: number;
  yUpfront: number;
  levels: Record<string, string>; // family -> level
  meta: Record<string, unknown>;
}

interface LevelSpec {
  family: string;
  level: string;
  /** Configured engine multiplier (undefined when the engine has no value for this level). */
  engineMultiplier?: number;
  /** Dampening exponent the engine applies to this family (1.0 when none). */
  exponent?: number;
  /** Engine's effective value m^e (n-weighted geometric mean for pooled levels). */
  engineApplied?: number;
  note?: string;
}

const RAW_BY_ID = new Map<string, ExtendedComparableDeal>(
  [...EXTENDED_COMPARABLE_DEALS, ...SUPABASE_COMPARABLE_DEALS].map(d => [d.id, d]),
);

function buildRows(cases: DealBacktestCase[]): { rows: Row[]; specs: LevelSpec[]; dropped: string[] } {
  const dropped: string[] = [];
  const pre: Array<Row & { engineVals: Record<string, { m?: number; e: number; note?: string }> }> = [];

  for (const c of cases) {
    const raw = RAW_BY_ID.get(c.id);
    const modalityKey = MODALITY_TO_ENGINE[c.modality] ?? c.modality;
    const table = baselineTableFor(c.therapeuticArea, modalityKey);
    const base = table[c.phase];
    if (!base) { dropped.push(`${c.id}: no baseline for ${c.therapeuticArea}/${c.phase}`); continue; }
    if (!(c.actualTotalDeal_M > 0) || !(c.actualUpfront_M > 0)) { dropped.push(`${c.id}: non-positive actuals`); continue; }

    const territoryKey = TERRITORY_TO_ENGINE[c.territory] ?? c.territory;
    const ind = matchIndication(c.therapeuticArea, raw?.indication_specific, c.indication, raw?.indication_category);
    const dealTypeLevel = c.dealType === 'licensing' ? 'licensing'
      : c.dealType === 'acquisition' ? `acquisition@${c.phase}`
      : c.dealType;
    const yearLevel = c.year < 2020 ? 'pre2020' : String(c.year);

    const modalityCfg = B.modalities[modalityKey];
    const territoryCfg = B.territories[territoryKey];

    pre.push({
      id: c.id,
      ta: c.therapeuticArea,
      phase: c.phase,
      year: c.year,
      yTotal: Math.log(c.actualTotalDeal_M / base.totalValue.median),
      yUpfront: Math.log(c.actualUpfront_M / base.upfront.median),
      levels: {
        modality: modalityKey,
        territory: territoryKey,
        dealType: dealTypeLevel,
        indication: ind ? ind.key : 'unmatched',
        combinationTherapy: raw?.combinationTherapy ? 'flagged' : 'notFlagged',
        verified: raw?.verified ? 'verified' : 'unverified',
        year: yearLevel,
        ta: c.therapeuticArea,
        phase: c.phase,
      },
      engineVals: {
        modality: { m: modalityCfg?.multiplier, e: 1.0, note: modalityCfg ? undefined : 'not an engine modality key' },
        territory: { m: territoryCfg?.multiplier, e: 1.0, note: territoryCfg ? undefined : 'not an engine territory key (engine applies 1.0)' },
        dealType: { m: c.dealType === 'licensing' ? 1.0 : DEAL_TYPE_BY_PHASE[c.dealType]?.[c.phase], e: 1.0 },
        indication: { m: ind ? ind.multiplier : 1.0, e: indicationExp(c.therapeuticArea) },
        combinationTherapy: { m: raw?.combinationTherapy ? B.multiplierConfig.combinationPotential.some.multiplier : 1.0, e: comboExp(c.therapeuticArea), note: 'corpus flag ~ engine "some combo potential" (1.10)' },
        verified: { m: undefined, e: 1.0, note: 'data-quality control, not an engine factor' },
        year: { m: undefined, e: 1.0, note: 'year fixed effect (control)' },
        ta: { m: undefined, e: 1.0, note: 'TA fixed effect — implied scale error of the TA baseline itself' },
        phase: { m: undefined, e: 1.0, note: 'phase fixed effect — implied scale error of the phase baseline itself' },
      },
      meta: { licensor: c.licensor, licensee: c.licensee, actualTotal_M: c.actualTotalDeal_M, actualUpfront_M: c.actualUpfront_M, baselineTotal_M: base.totalValue.median, baselineUpfront_M: base.upfront.median },
    });
  }

  // Pool thin levels inside identified families.
  const REFERENCE: Record<string, string> = {
    modality: 'smallMolecule', territory: 'global', dealType: 'licensing', indication: 'unmatched',
    combinationTherapy: 'notFlagged', verified: 'unverified', year: String(REFERENCE_YEAR), ta: 'oncology', phase: 'phase2',
  };
  const POOLABLE = new Set(['modality', 'territory', 'dealType', 'indication']);
  const counts: Record<string, Record<string, number>> = {};
  for (const r of pre) for (const [f, l] of Object.entries(r.levels)) ((counts[f] ??= {})[l] = (counts[f]?.[l] ?? 0) + 1);
  for (const r of pre) {
    for (const f of POOLABLE) {
      const l = r.levels[f];
      if (l !== REFERENCE[f] && counts[f][l] < MIN_N_OWN_LEVEL) r.levels[f] = `${f}:pooledThin`;
    }
  }

  // Level specs with engine values (n-weighted geometric mean of applied values for pooled levels).
  const specMap = new Map<string, { family: string; level: string; logApplied: number[]; mults: number[]; exps: number[]; notes: Set<string> }>();
  for (const r of pre) {
    for (const [f, l] of Object.entries(r.levels)) {
      if (l === REFERENCE[f]) continue;
      const key = `${f}|${l}`;
      const s = specMap.get(key) ?? { family: f, level: l, logApplied: [], mults: [], exps: [], notes: new Set<string>() };
      const ev = r.engineVals[f];
      if (ev.m !== undefined) { s.logApplied.push(Math.log(ev.m) * ev.e); s.mults.push(ev.m); s.exps.push(ev.e); }
      if (ev.note) s.notes.add(ev.note);
      specMap.set(key, s);
    }
  }
  const specs: LevelSpec[] = [...specMap.values()].map(s => {
    const has = s.logApplied.length > 0;
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    return {
      family: s.family,
      level: s.level,
      engineMultiplier: has ? Math.exp(mean(s.mults.map(Math.log))) : undefined,
      exponent: has ? mean(s.exps) : undefined,
      engineApplied: has ? Math.exp(mean(s.logApplied)) : undefined,
      note: s.notes.size ? [...s.notes].join('; ') : undefined,
    };
  });
  const familyOrder = ['modality', 'territory', 'dealType', 'indication', 'combinationTherapy', 'verified', 'year', 'ta', 'phase'];
  specs.sort((a, b) => familyOrder.indexOf(a.family) - familyOrder.indexOf(b.family) || a.level.localeCompare(b.level));

  const rows: Row[] = pre.map(({ engineVals: _e, ...r }) => r);
  return { rows, specs, dropped };
}

function designMatrix(rows: Row[], specs: LevelSpec[]): number[][] {
  return rows.map(r => [1, ...specs.map(s => (r.levels[s.family] === s.level ? 1 : 0))]);
}

// ---------------------------------------------------------------------------
// Linear algebra (no deps)
// ---------------------------------------------------------------------------

function ridgeSolve(X: number[][], y: number[], lambda: number): number[] {
  const n = X.length, p = X[0].length;
  const A: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const b: number[] = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    const xi = X[i];
    for (let j = 0; j < p; j++) {
      if (xi[j] === 0) continue;
      b[j] += xi[j] * y[i];
      for (let k = 0; k < p; k++) A[j][k] += xi[j] * xi[k];
    }
  }
  for (let j = 1; j < p; j++) A[j][j] += lambda; // do not penalise intercept
  return gaussSolve(A, b);
}

function gaussSolve(A: number[][], b: number[]): number[] {
  const p = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < p; col++) {
    let piv = col;
    for (let r = col + 1; r < p; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) continue;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < p; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      if (f === 0) continue;
      for (let k = col; k <= p; k++) M[r][k] -= f * M[col][k];
    }
  }
  return M.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[p] / row[i]));
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function fitWithBootstrap(X: number[][], y: number[], seed: number) {
  const beta = ridgeSolve(X, y, RIDGE_LAMBDA);
  const rng = mulberry32(seed);
  const p = beta.length;
  const draws: number[][] = Array.from({ length: p }, () => []);
  for (let b = 0; b < BOOTSTRAP_N; b++) {
    const Xb: number[][] = [], yb: number[] = [];
    for (let i = 0; i < X.length; i++) { const k = Math.floor(rng() * X.length); Xb.push(X[k]); yb.push(y[k]); }
    const bb = ridgeSolve(Xb, yb, RIDGE_LAMBDA);
    for (let j = 0; j < p; j++) draws[j].push(bb[j]);
  }
  const ci = draws.map(d => { const s = [...d].sort((a, b) => a - b); return [quantile(s, 0.025), quantile(s, 0.975)] as [number, number]; });
  const fitted = X.map(row => row.reduce((s, x, j) => s + x * beta[j], 0));
  const resid = y.map((v, i) => v - fitted[i]);
  const ssRes = resid.reduce((s, r) => s + r * r, 0);
  const mean = y.reduce((s, v) => s + v, 0) / y.length;
  const ssTot = y.reduce((s, v) => s + (v - mean) * (v - mean), 0);
  return { beta, ci, r2: 1 - ssRes / ssTot, rmseLog: Math.sqrt(ssRes / y.length) };
}

// ---------------------------------------------------------------------------
// Collinearity diagnostics
// ---------------------------------------------------------------------------

function maxAbsCorrelation(X: number[][], specs: LevelSpec[]): Array<{ level: string; partner: string; r: number }> {
  const p = specs.length;
  const cols = specs.map((_, j) => X.map(row => row[j + 1]));
  const stats = cols.map(c => { const m = c.reduce((s, v) => s + v, 0) / c.length; const sd = Math.sqrt(c.reduce((s, v) => s + (v - m) ** 2, 0) / c.length); return { m, sd }; });
  const out: Array<{ level: string; partner: string; r: number }> = [];
  for (let a = 0; a < p; a++) {
    let best = { partner: '', r: 0 };
    for (let b = 0; b < p; b++) {
      if (a === b || stats[a].sd === 0 || stats[b].sd === 0) continue;
      let cov = 0;
      for (let i = 0; i < X.length; i++) cov += (cols[a][i] - stats[a].m) * (cols[b][i] - stats[b].m);
      const r = cov / X.length / (stats[a].sd * stats[b].sd);
      if (Math.abs(r) > Math.abs(best.r)) best = { partner: `${specs[b].family}:${specs[b].level}`, r };
    }
    out.push({ level: `${specs[a].family}:${specs[a].level}`, ...best });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------

type Verdict = 'consistent' | 'engine high' | 'engine low' | 'insufficient n' | 'no engine value';

function verdictFor(n: number, ci: [number, number], applied?: number): Verdict {
  if (applied === undefined) return 'no engine value';
  if (n < MIN_N_FOR_VERDICT) return 'insufficient n';
  if (applied > ci[1]) return 'engine high';
  if (applied < ci[0]) return 'engine low';
  return 'consistent';
}

// ---------------------------------------------------------------------------
// Supplementary probe: CALIBRATION_DEALS (only rows carrying competitive
// position / biomarker / designations labels).
// ---------------------------------------------------------------------------

function supplementaryProbe() {
  const deals = CALIBRATION_DEALS.filter(d =>
    d.actualUpfront > 0 && d.actualTotalDeal > 0 && !/no deal|reference|stranded|crl|renegotiated|ipo/i.test(d.licensee),
  );
  const levels = (d: (typeof deals)[number]) => ({
    competitivePosition: d.competitivePosition,
    biomarker: d.biomarkerSelected ? 'selected' : 'unselected',
    breakthrough: d.designations.includes('breakthrough') ? 'yes' : 'no',
    orphan: d.designations.includes('orphan') ? 'yes' : 'no',
    fastTrack: d.designations.includes('fastTrack') ? 'yes' : 'no',
    isAcquisition: d.actualUpfront === d.actualTotalDeal ? 'yes' : 'no',
    phaseBucket: d.phase === 'approved' ? 'approved' : d.phase === 'phase3' ? 'phase3' : d.phase === 'phase2' ? 'phase2' : 'early',
  });
  const REF: Record<string, string> = { competitivePosition: 'racing', biomarker: 'unselected', breakthrough: 'no', orphan: 'no', fastTrack: 'no', isAcquisition: 'no', phaseBucket: 'phase2' };
  const specs: LevelSpec[] = [];
  const seen = new Set<string>();
  const engine: Record<string, { m?: number; e: number }> = {
    'competitivePosition|firstInClass': { m: 1.25, e: 0.7 }, 'competitivePosition|bestInClass': { m: 1.10, e: 0.7 },
    'competitivePosition|firstToPivotal': { m: 1.15, e: 0.7 }, 'competitivePosition|behind': { m: 0.80, e: 0.7 }, 'competitivePosition|crowded': { m: 0.70, e: 0.7 },
    'biomarker|selected': { m: 1.15, e: 0.9 },
    'breakthrough|yes': { m: 1.12, e: 1.0 }, 'orphan|yes': { m: 1.08, e: 1.0 }, 'fastTrack|yes': { m: 1.06, e: 1.0 },
  };
  const rows = deals.map(d => {
    const table = baselineTableFor(d.therapeuticArea, d.modality);
    const base = table[d.phase] ?? table.phase2;
    return { id: d.id, levels: levels(d), yTotal: Math.log(d.actualTotalDeal / base.totalValue.median), yUpfront: Math.log(d.actualUpfront / base.upfront.median) };
  });
  for (const r of rows) for (const [f, l] of Object.entries(r.levels)) {
    if (l === REF[f]) continue;
    const key = `${f}|${l}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const ev = engine[key];
    specs.push({ family: f, level: l, engineMultiplier: ev?.m, exponent: ev?.e, engineApplied: ev?.m !== undefined ? Math.pow(ev.m, ev.e) : undefined, note: f === 'isAcquisition' || f === 'phaseBucket' ? 'control' : ev ? undefined : 'no engine value' });
  }
  const X = rows.map(r => [1, ...specs.map(s => (r.levels[s.family as keyof typeof r.levels] === s.level ? 1 : 0))]);
  const fitT = fitWithBootstrap(X, rows.map(r => r.yTotal), BOOTSTRAP_SEED + 1);
  const fitU = fitWithBootstrap(X, rows.map(r => r.yUpfront), BOOTSTRAP_SEED + 2);
  const nByLevel = (s: LevelSpec) => rows.filter(r => r.levels[s.family as keyof typeof r.levels] === s.level).length;
  return {
    n: rows.length,
    source: 'lib/financial/calibration.ts CALIBRATION_DEALS (hand-labelled; reference/no-deal rows excluded)',
    r2Total: fitT.r2,
    levels: specs.map((s, j) => {
      const ci: [number, number] = [Math.exp(fitT.ci[j + 1][0]), Math.exp(fitT.ci[j + 1][1])];
      const n = nByLevel(s);
      return { ...s, n, impliedTotal: Math.exp(fitT.beta[j + 1]), ci95Total: ci, impliedUpfront: Math.exp(fitU.beta[j + 1]), verdict: verdictFor(n, ci, s.engineApplied) };
    }),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function runModel(rows: Row[], specs: LevelSpec[], label: string, seed: number) {
  const X = designMatrix(rows, specs);
  const fitT = fitWithBootstrap(X, rows.map(r => r.yTotal), seed);
  const fitU = fitWithBootstrap(X, rows.map(r => r.yUpfront), seed + 1);
  const corr = maxAbsCorrelation(X, specs);
  const levels = specs.map((s, j) => {
    const n = rows.filter(r => r.levels[s.family] === s.level).length;
    const ciT: [number, number] = [Math.exp(fitT.ci[j + 1][0]), Math.exp(fitT.ci[j + 1][1])];
    const ciU: [number, number] = [Math.exp(fitU.ci[j + 1][0]), Math.exp(fitU.ci[j + 1][1])];
    return {
      family: s.family,
      level: s.level,
      n,
      impliedTotal: Math.exp(fitT.beta[j + 1]),
      ci95Total: ciT,
      impliedUpfront: Math.exp(fitU.beta[j + 1]),
      ci95Upfront: ciU,
      engineMultiplier: s.engineMultiplier,
      exponent: s.exponent,
      engineApplied: s.engineApplied,
      verdictTotal: verdictFor(n, ciT, s.engineApplied),
      verdictUpfront: verdictFor(n, ciU, s.engineApplied),
      maxAbsCorrWith: corr[j].partner,
      maxAbsCorr: corr[j].r,
      note: s.note,
    };
  });
  return {
    label,
    n: rows.length,
    p: specs.length,
    interceptTotal: Math.exp(fitT.beta[0]),
    interceptUpfront: Math.exp(fitU.beta[0]),
    r2Total: fitT.r2,
    r2Upfront: fitU.r2,
    rmseLogTotal: fitT.rmseLog,
    rmseLogUpfront: fitU.rmseLog,
    levels,
  };
}

function main() {
  const cases = getAllBacktestCases();
  const { rows, specs, dropped } = buildRows(cases);

  const primary = runModel(rows, specs, 'full corpus', BOOTSTRAP_SEED);

  // Robustness: non-M&A subset (licensing / codev / collaboration / option) — the
  // structures the licensing baselines were designed around.
  const nonMA = rows.filter(r => !r.levels.dealType.startsWith('acquisition'));
  const nonMASpecs = specs.filter(s => nonMA.some(r => r.levels[s.family] === s.level));
  const robustness = runModel(nonMA, nonMASpecs, 'non-M&A subset', BOOTSTRAP_SEED + 10);

  const supplementary = supplementaryProbe();

  // Engine factors with NO observable input in the corpus.
  const unidentifiable = [
    { factor: 'competitivePosition (first-in-class 1.25 / first-to-pivotal 1.15 / best-in-class 1.10 / behind 0.80 / crowded 0.70)', reason: 'No competitive-position field in the backtest corpus or the live deals table (0 of 1,875 rows). Only 4 of 221 matched live rows mention "first-in-class" in free text.' },
    { factor: 'dataQuality (pivotal-ready 1.15 / strong Ph2 1.08 / mixed 0.85 / limited 0.75)', reason: 'Not recorded per deal. Phase at signing is the only proxy and is already in the baseline.' },
    { factor: 'biomarker (selected 1.15)', reason: 'No biomarker field in corpus or live table. 57 hand-labelled CALIBRATION_DEALS carry it (see supplementary probe, n too thin).' },
    { factor: 'lineOfTherapy (1L 1.25 / 3L+ 0.85)', reason: 'Not recorded per deal.' },
    { factor: 'combinationPotential (strong 1.20 / some 1.10)', reason: 'Only 3 corpus rows flagged combinationTherapy; live table has no combination field.' },
    { factor: 'regulatoryDesignations (breakthrough +12% / orphan +8% / fast track +6%)', reason: 'regulatory_designations populated on 15 of 1,875 live rows (0.8%); 4 within the corpus.' },
    { factor: 'TA-specific enrichment (bbbPenetration, diseaseSeverity, mechanismDifferentiation, weightLossEfficacy, cvOutcomeBenefit, resistanceProfile, ocularDelivery, whUnmetNeed, orphanDesignation, hemeLineage, skinSeverity, ...)', reason: 'None of these are recorded per deal in any available source.' },
    { factor: 'sub-territory keys (canada, australia, south_korea, latam, mena, us_eu, us_japan)', reason: 'Zero corpus deals carry these territory codes.' },
  ];

  const out = {
    study: `per-factor-${STUDY_TAG}`,
    generatedAt: new Date().toISOString(),
    method: {
      corpus: 'getAllBacktestCases() — EXTENDED_COMPARABLE_DEALS + SUPABASE_COMPARABLE_DEALS, deduped, upfront >= $20M, data-quality filter',
      residual: 'ln(actual / engine baseline median for TA x phase [x rare-disease modality sub-baseline])',
      model: 'ridge OLS on one-hot dummies; intercept unpenalised',
      lambda: RIDGE_LAMBDA,
      bootstrap: BOOTSTRAP_N,
      seed: BOOTSTRAP_SEED,
      minNForVerdict: MIN_N_FOR_VERDICT,
      minNOwnLevel: MIN_N_OWN_LEVEL,
      referenceLevels: { modality: 'smallMolecule', territory: 'global', dealType: 'licensing', indication: 'unmatched (engine 1.0)', year: String(REFERENCE_YEAR), ta: 'oncology', phase: 'phase2' },
      liveTableProbe: 'scripts/calibration/live-enrichment-coverage.ts — read-only; enrichment columns too sparse to use (see unidentifiable)',
    },
    corpus: { casesIn: cases.length, rowsUsed: rows.length, dropped },
    primary,
    robustness,
    supplementary,
    unidentifiable,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));

  // Console summary
  const fmt = (x?: number) => (x === undefined ? '   —' : x.toFixed(2).padStart(5));
  console.log(`\nPer-factor calibration ${STUDY_TAG}: n=${rows.length} (dropped ${dropped.length}), p=${specs.length}, lambda=${RIDGE_LAMBDA}, bootstrap=${BOOTSTRAP_N}`);
  console.log(`R² total=${primary.r2Total.toFixed(3)} upfront=${primary.r2Upfront.toFixed(3)}; intercept total=${primary.interceptTotal.toFixed(2)} upfront=${primary.interceptUpfront.toFixed(2)}\n`);
  let fam = '';
  for (const l of primary.levels) {
    if (l.family !== fam) { fam = l.family; console.log(`--- ${fam}`); }
    console.log(`${l.level.padEnd(30)} n=${String(l.n).padStart(3)}  implied=${fmt(l.impliedTotal)} [${fmt(l.ci95Total[0])},${fmt(l.ci95Total[1])}]  upfront=${fmt(l.impliedUpfront)}  engine=${fmt(l.engineMultiplier)} applied=${fmt(l.engineApplied)}  ${l.verdictTotal}`);
  }
  console.log(`\nSupplementary (CALIBRATION_DEALS, n=${supplementary.n}):`);
  for (const l of supplementary.levels) console.log(`${(l.family + ':' + l.level).padEnd(36)} n=${String(l.n).padStart(3)} implied=${fmt(l.impliedTotal)} [${fmt(l.ci95Total[0])},${fmt(l.ci95Total[1])}] engine applied=${fmt(l.engineApplied)} ${l.verdict}`);
  console.log(`\nWrote ${path.relative(process.cwd(), OUT_JSON)}`);
}

main();
