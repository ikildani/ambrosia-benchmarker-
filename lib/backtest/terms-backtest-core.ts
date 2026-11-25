/**
 * Deal-terms backtest core: map a verified license to calculator inputs, price it, summarize calculator / actual
 * upfront, and compare a summary with the committed baseline (the CI accuracy gate).
 *
 * Pure apart from calculateDealTerms, which reads the benchmark tables (static JSON + whatever calibration rows
 * lib/benchmarks.ts holds). Used by scripts/terms-backtest.ts, the CI gate and the /accuracy page's data.
 */
import { calculateDealTerms } from '@/lib/calculations';
import { setCalibrationRowsForTesting, staticBenchmarks } from '@/lib/benchmarks';

/** One input deal, as written to the fixture by scripts/terms-backtest-snapshot.ts. */
export interface BacktestDeal {
  id: string;
  licensor_name: string | null;
  licensee_name: string | null;
  therapeutic_area: string | null;
  modality: string | null;
  phase_at_signing: string | null;
  deal_type: string | null;
  territory: string | null;
  territories_included: string[] | null;
  upfront_usd: number;
  announced_date: string | null;
}

export interface BacktestFixture {
  snapshotAt: string;
  source: string;
  window: { from: string; to: string };
  deals: BacktestDeal[];
  /** Active benchmark_calibrations rows at snapshot time (same columns refreshCalibrationCache reads). */
  calibrations: Array<Record<string, unknown>>;
}

export interface PricedDeal {
  id: string;
  deal: string;
  ta: string;
  phase: string;
  modality: string;
  territory: string;
  actual: number;
  calc: number;
  ratio: number;
}

export interface GroupStats {
  n: number;
  /** Median calculator / actual upfront (1 = centered; 2 = calculator twice the upfront paid). */
  medianRatio: number;
  /** Share of deals priced within 2x either way of the upfront paid. */
  within2x: number;
  /** Median |ln(calculator / actual)|. exp(mdaeLog) is the typical miss as a factor. */
  mdaeLog: number;
}

export interface BacktestSummary {
  generatedAt: string;
  fixtureSnapshotAt: string;
  window: { from: string; to: string };
  overall: GroupStats;
  byTerritory: Record<string, GroupStats>;
  byPhase: Record<string, GroupStats>;
  byTA: Record<string, GroupStats>;
  byModality: Record<string, GroupStats>;
}

const PHASE: Record<string, string> = {
  discovery: 'discovery', preclinical: 'preclinical', phase_1: 'phase1', phase1: 'phase1', phase_1_2: 'phase1_2', phase1_2: 'phase1_2',
  phase_2: 'phase2', phase2: 'phase2', phase_2_3: 'phase2_3', phase2_3: 'phase2_3', phase_3: 'phase3', phase3: 'phase3',
};
const MODALITY: Record<string, string> = {
  small_molecule: 'smallMolecule', smallMolecule: 'smallMolecule', antibody: 'mab', mab: 'mab', bispecific: 'bispecific', adc: 'adc',
  oligonucleotide: 'oligonucleotide', peptide: 'peptide', gene_therapy: 'geneTherapy', cell_therapy: 'cellTherapy', car_t: 'cellTherapy',
  radiopharm: 'radiopharmaceutical', mrna: 'mrna', vaccine: 'therapeuticVaccine',
};
const DEAL_TYPE: Record<string, string> = { license: 'licensing', licensing: 'licensing', collaboration: 'licensing', option: 'option' };
const TA_CATEGORY: Record<string, string> = {
  oncology: 'solidTumor', neurology: 'neurology', immunology: 'immunology', metabolic: 'metabolic', cardiovascular: 'cardiovascular',
  infectiousDisease: 'infectiousDisease', ophthalmology: 'ophthalmology', womensHealth: 'womensHealth', rareDisease: 'rareDisease',
  hematology: 'hematology', dermatology: 'dermatology', gastroenterology: 'gastroenterology',
};

const CHINA = /^(mainland china|china mainland|china|greater china|prc|hong kong|hong kong sar|macau|macao|macau sar|taiwan)$/;
const JAPAN = /^japan$/;
const KOREA = /^(south korea|korea|republic of korea)$/;
const US = /^(the )?(us|u\.s\.|usa|united states( of america)?)$/;
const NORTH_AMERICA_EX_US = /^(canada|mexico)$/;
const EUROPE = /^(europe|european union|eu|eu countries|eea|european economic area|eu5|uk|united kingdom|great britain|germany|france|italy|spain|switzerland|nordics|norway|sweden|denmark|finland|iceland|ireland|netherlands|belgium|austria|portugal|poland|liechtenstein|european patent organization member states|other european countries)$/;
const AUSTRALIA = /^(australia|new zealand)$/;
const LATAM = /^(latin america|brazil|mexico|argentina|colombia|chile|peru)$/;
const MENA = /^(mena|middle east|north africa|saudi arabia|united arab emirates|uae|egypt|qatar|kuwait|bahrain|oman|jordan|morocco|algeria|tunisia|palestine|lebanon|iraq)$/;

const norm = (s: string) => s.toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Calculator territory for a list of countries / regions when every entry falls in one bucket, else null. */
function fromList(list: string[]): string | null {
  if (list.length === 0) return null;
  const all = (re: RegExp) => list.every((x) => re.test(x));
  const some = (re: RegExp) => list.some((x) => re.test(x));
  if (list.length === 1 && /^(global|worldwide)$/.test(list[0])) return 'global';
  if (all(CHINA)) return 'china';
  if (all(JAPAN)) return 'japan';
  if (all(KOREA)) return 'south_korea';
  if (all(EUROPE)) return 'europe';
  if (all(AUSTRALIA)) return 'australia';
  if (all(MENA)) return 'mena';
  if (all(LATAM)) return 'latam';
  if (list.length === 1 && list[0] === 'canada') return 'canada';
  // The US plus Canada / Mexico prices as the US (North America ex-US is ~3% of worldwide sales).
  if (list.length === 1 && list[0] === 'north america') return 'us_only';
  if (some(US) && list.every((x) => US.test(x) || NORTH_AMERICA_EX_US.test(x))) return 'us_only';
  if (some(US) && some(EUROPE) && list.every((x) => US.test(x) || EUROPE.test(x) || x === 'canada')) return 'us_eu';
  return null;
}

/**
 * Map a deal's territory text (plus its `territories_included` list) to a calculator territory, or null when it does
 * not map cleanly. Carve-outs ("global ex-China", "worldwide excluding Japan"), mixed baskets ("Europe and India",
 * "Japan and South Korea") and Rest-of-World lists are skipped: a deal priced on the wrong territory would measure
 * the mapping, not the calculator. There is no ex-China territory in the calculator, so ex-China licenses are out.
 */
export function mapTerritory(territory: string | null, included: string[] | null): string | null {
  const t = norm(String(territory ?? ''));
  if (t === 'global' || t === 'worldwide') return 'global';
  if (t === 'china' || t === 'greater china') return 'china';
  if (t === 'japan') return 'japan';
  if (t === 'europe') return 'europe';
  if (t === 'us' || t === 'us only') return 'us_only';
  if (t === 'us eu') return 'us_eu';
  if (t === 'ex us' || /^ex us \(excluding us, canada,? and mexico\)$/.test(t)) return 'ex_us';
  if (t === 'south korea') return 'south_korea';
  // Generic labels: classify by the listed countries.
  if (t === 'regional' || t === 'other' || t === 'null' || t === '' || t === 'asia pacific') {
    return fromList((included ?? []).map(norm).filter(Boolean));
  }
  return null;
}

const NEUTRAL = {
  biomarker: 'unselected', lineOfTherapy: '2L', dataQuality: 'promising', competitivePosition: 'racing',
  combinationPotential: 'standalone', treatmentApproach: 'symptomatic',
  regulatoryDesignations: { prime: false, orphan: false, fastTrack: false, breakthrough: false },
};

/**
 * Price one deal with neutral inputs (the deal's phase, area, modality, territory and deal type; every other factor
 * at its default, indication = the area's first indication). Returns null when a field does not map.
 */
export function priceDeal(d: BacktestDeal): PricedDeal | null {
  const phase = PHASE[String(d.phase_at_signing)];
  const modality = MODALITY[String(d.modality)];
  const category = TA_CATEGORY[String(d.therapeutic_area)];
  const territory = mapTerritory(d.territory, d.territories_included);
  const actual = Number(d.upfront_usd) / 1e6;
  if (!phase || !modality || !category || !territory || !(actual > 0)) return null;
  const indication = Object.keys((staticBenchmarks.indications as unknown as Record<string, Record<string, unknown>>)[category])[0];
  const r = calculateDealTerms({
    phase, modality, territory, indication, therapeuticArea: d.therapeutic_area,
    dealType: DEAL_TYPE[String(d.deal_type)] ?? 'licensing', ...NEUTRAL,
  } as never);
  // The calculator rounds upfronts to whole $M, so a tiny regional license can come back as $0. Floor at $50K so the
  // ratio stays finite (and counts as a miss) instead of breaking the medians.
  const calc = Math.max(r.terms.upfront.median, 0.05);
  return {
    id: d.id, deal: `${d.licensor_name} / ${d.licensee_name}`, ta: String(d.therapeutic_area), phase, modality, territory,
    actual, calc, ratio: calc / actual,
  };
}

export const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN;
};
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

export function groupStats(ratios: number[]): GroupStats {
  return {
    n: ratios.length,
    medianRatio: r4(median(ratios)),
    within2x: r4(ratios.filter((x) => x >= 0.5 && x <= 2).length / ratios.length),
    mdaeLog: r4(median(ratios.map((x) => Math.abs(Math.log(x))))),
  };
}

function groupBy(rows: PricedDeal[], pick: (r: PricedDeal) => string): Record<string, GroupStats> {
  const by = new Map<string, number[]>();
  for (const r of rows) { const k = pick(r); by.set(k, [...(by.get(k) ?? []), r.ratio]); }
  return Object.fromEntries([...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, groupStats(v)]));
}

export function summarize(
  rows: PricedDeal[],
  meta: { fixtureSnapshotAt: string; window: { from: string; to: string }; generatedAt?: string },
): BacktestSummary {
  return {
    generatedAt: meta.generatedAt ?? new Date().toISOString(),
    fixtureSnapshotAt: meta.fixtureSnapshotAt,
    window: meta.window,
    overall: groupStats(rows.map((r) => r.ratio)),
    byTerritory: groupBy(rows, (r) => r.territory),
    byPhase: groupBy(rows, (r) => r.phase),
    byTA: groupBy(rows, (r) => r.ta),
    byModality: groupBy(rows, (r) => r.modality),
  };
}

/**
 * Price every deal in a fixture with that fixture's calibration rows pinned (no network), then restore normal
 * calibration loading.
 */
export function runFixture(fixture: BacktestFixture): { rows: PricedDeal[]; summary: BacktestSummary } {
  setCalibrationRowsForTesting(fixture.calibrations);
  try {
    const rows = fixture.deals.map(priceDeal).filter((r): r is PricedDeal => r !== null);
    return { rows, summary: summarize(rows, { fixtureSnapshotAt: fixture.snapshotAt, window: fixture.window }) };
  } finally {
    setCalibrationRowsForTesting(null);
  }
}

/** Tolerances of the CI gate: within-2x may fall at most 1 point, typical log error may rise at most 0.02. */
export const GATE = { maxWithin2xDrop: 0.01, maxMdaeRise: 0.02 } as const;

export interface GateResult { ok: boolean; messages: string[] }

/**
 * Compare a fresh summary with the committed baseline. Fails when accuracy regresses beyond GATE, or when the
 * sample differs from the baseline's (the fixture or the deal mapping changed without a baseline refresh).
 */
export function checkAgainstBaseline(current: BacktestSummary, baseline: BacktestSummary): GateResult {
  const messages: string[] = [];
  const c = current.overall;
  const b = baseline.overall;
  if (current.fixtureSnapshotAt !== baseline.fixtureSnapshotAt || c.n !== b.n) {
    messages.push(
      `Sample changed: fixture ${current.fixtureSnapshotAt} n=${c.n} vs baseline ${baseline.fixtureSnapshotAt} n=${b.n}. ` +
      'Regenerate the baseline (npx tsx scripts/terms-backtest.ts --fixture data/backtest/terms-backtest-fixture.json --write-baseline) and commit it.',
    );
  }
  const drop = b.within2x - c.within2x;
  if (drop > GATE.maxWithin2xDrop + 1e-9) {
    messages.push(`Within 2x fell ${(drop * 100).toFixed(1)} points: ${(b.within2x * 100).toFixed(1)}% -> ${(c.within2x * 100).toFixed(1)}% (allowed ${GATE.maxWithin2xDrop * 100} point).`);
  }
  const rise = c.mdaeLog - b.mdaeLog;
  if (rise > GATE.maxMdaeRise + 1e-9) {
    messages.push(`MdAE(log) rose ${rise.toFixed(3)}: ${b.mdaeLog.toFixed(3)} -> ${c.mdaeLog.toFixed(3)} (allowed ${GATE.maxMdaeRise}).`);
  }
  return { ok: messages.length === 0, messages };
}
