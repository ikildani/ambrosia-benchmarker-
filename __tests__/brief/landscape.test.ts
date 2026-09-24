/**
 * Brief v3 — landscape builders and pages.
 * Pure tests only: no database. The async builders are exercised with a tiny
 * chainable stub that mimics the PostgREST query builder.
 */

import {
  normaliseTrialPhase,
  normaliseAssetPhase,
  normaliseBucket,
  crowdingScore,
  buildPatientFunnel,
  computeRecommendedWindow,
  indicationSpec,
  trialMatchesIndication,
  parsePatentCliffs,
  buildPipelineMap,
  buildCatalystCalendar,
  buildLandscape,
} from '@/lib/brief/landscape';
import type { AssetProfile, CatalystCalendar, PatientFunnel, PipelineMap } from '@/lib/brief/types';
import type { MarketSizeEstimate } from '@/lib/financial/types';
import { renderPipelineMapPage } from '@/lib/report/pages/pipelineMap';
import { renderCatalystCalendarPage } from '@/lib/report/pages/catalystCalendar';
import { renderPatientFunnelPage } from '@/lib/report/pages/patientFunnel';
import { renderPipelineGrid } from '@/lib/report/svg-charts/pipelineGrid';
import { renderCatalystTimeline } from '@/lib/report/svg-charts/catalystTimeline';
import { renderPatientFunnel } from '@/lib/report/svg-charts/funnel';
import type { PDFReportData, ReportMeta } from '@/lib/report/types';

const AS_OF = '2026-09-23';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const asset: AssetProfile = {
  assetName: 'AMB-101',
  company: 'Client Co',
  modality: 'mab',
  phase: 'phase2',
  indication: 'alzheimers',
  therapeuticArea: 'neurology',
  territory: 'global',
  targetDealType: 'license',
};

const market: MarketSizeEstimate = {
  indication: 'alzheimers',
  territory: 'us_only',
  totalAddressableMarket: 57120,
  serviceableAddressableMarket: 5000,
  serviceableObtainableMarket: 1200,
  peakSales: { low: 800, median: 1800, high: 3600 },
  patientFunnel: {
    totalPopulation: 340_000_000,
    prevalentPatients: 2_040_000,
    diagnosedPatients: 1_122_000,
    treatedPatients: 504_900,
    drugEligiblePatients: 176_715,
    addressablePatients: 120_000,
  },
  marketShareAssumption: { low: 0.1, median: 0.2, high: 0.35 },
  annualRevenuePerPatient: 28_000,
  sources: ['WHO Global Health Observatory', "Alzheimer's Association Facts and Figures 2024"],
};

function trial(over: Record<string, unknown>) {
  return {
    nct_id: 'NCT00000001', trial_title: 'A study', company_name: null, lead_sponsor_name: 'Eli Lilly and Company',
    lead_sponsor_class: 'INDUSTRY', intervention_name: 'Donanemab', intervention_type: 'DRUG', modality: 'antibody', target: 'amyloid',
    indication_category: 'cns', indication_specific: null, conditions: ['Alzheimer Disease'], phase: 'phase_3', status: 'recruiting',
    primary_completion_date: '2027-03-15', completion_date: null,
    ...over,
  };
}

const TRIALS = [
  trial({ nct_id: 'NCT1', lead_sponsor_name: 'Eli Lilly and Company', intervention_name: 'Remternetug', modality: 'antibody', phase: 'phase_3', primary_completion_date: '2027-03-15' }),
  trial({ nct_id: 'NCT2', lead_sponsor_name: 'Eisai Inc.', intervention_name: 'Lecanemab SC', modality: 'antibody', phase: 'phase_3', primary_completion_date: '2027-09-01' }),
  trial({ nct_id: 'NCT3', lead_sponsor_name: 'Biogen', intervention_name: 'BIIB080', modality: 'oligonucleotide', phase: 'phase_2', primary_completion_date: '2027-01-10' }),
  trial({ nct_id: 'NCT4', lead_sponsor_name: 'Cassava Sciences', intervention_name: 'Simufilam', modality: 'small_molecule', phase: 'phase_3', primary_completion_date: '2026-12-01' }),
  trial({ nct_id: 'NCT5', lead_sponsor_name: 'Cassava Sciences', intervention_name: 'Simufilam', modality: 'small_molecule', phase: 'phase_2', primary_completion_date: '2026-11-01' }),
  trial({ nct_id: 'NCT6', lead_sponsor_name: 'AC Immune', intervention_name: 'ACI-24', modality: 'other', intervention_type: 'BIOLOGICAL', phase: 'phase_1_2', primary_completion_date: '2028-02-01' }),
  trial({ nct_id: 'NCT7', lead_sponsor_name: 'Massachusetts General Hospital', lead_sponsor_class: 'OTHER', intervention_name: 'Metformin', modality: 'small_molecule', phase: 'phase_2', primary_completion_date: '2027-06-01' }),
  trial({ nct_id: 'NCT8', lead_sponsor_name: 'Novo Nordisk', intervention_name: 'Semaglutide', modality: 'peptide', phase: 'phase_3', conditions: ["Early Alzheimer's Disease"], primary_completion_date: '2026-10-20' }),
  trial({ nct_id: 'NCT9', lead_sponsor_name: 'Some Migraine Co', intervention_name: 'Zolmitriptan', modality: 'small_molecule', phase: 'phase_2', conditions: ['Migraine'], primary_completion_date: '2027-02-01' }),
  trial({ nct_id: 'NCT10', lead_sponsor_name: 'Weird <Sponsor>', intervention_name: 'X&Y', modality: 'antibody', phase: 'phase_1', conditions: ['Alzheimers Disease'], primary_completion_date: '2028-06-01' }),
];

/** Tiny chainable stub of the PostgREST builder. Filters on in/gte/lte are applied to the row set. */
function stubDb(tables: Record<string, Record<string, unknown>[]>, opts: { failTables?: string[] } = {}) {
  const calls: Array<{ table: string; ops: string[] }> = [];
  return {
    calls,
    from(table: string) {
      const rec = { table, ops: [] as string[] };
      calls.push(rec);
      let rows = [...(tables[table] ?? [])];
      const b: any = {
        select() { rec.ops.push('select'); return b; },
        in(col: string, vals: string[]) { rec.ops.push(`in:${col}`); rows = rows.filter(r => vals.includes(String(r[col]))); return b; },
        gte(col: string, v: string) { rec.ops.push(`gte:${col}`); rows = rows.filter(r => String(r[col] ?? '') >= v); return b; },
        lte(col: string, v: string) { rec.ops.push(`lte:${col}`); rows = rows.filter(r => String(r[col] ?? '') <= v); return b; },
        ilike(col: string, pat: string) { rec.ops.push(`ilike:${col}`); const needle = pat.replace(/%/g, '').toLowerCase(); rows = rows.filter(r => String(r[col] ?? '').toLowerCase().includes(needle)); return b; },
        or(expr: string) { rec.ops.push(`or:${expr}`); return b; },
        order() { rec.ops.push('order'); return b; },
        range(from: number, to: number) { rec.ops.push(`range:${from}-${to}`); rows = rows.slice(from, to + 1); return b; },
        limit(n: number) { rec.ops.push(`limit:${n}`); rows = rows.slice(0, n); return b; },
        then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
          if (opts.failTables?.includes(table)) return Promise.reject(new Error(`boom ${table}`)).then(resolve, reject);
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        },
      };
      return b;
    },
  };
}

const meta: ReportMeta = { reportId: 'AMB-TEST', generatedAt: AS_OF, version: '3', pageCount: 30, currentPage: 18, tocEntries: [] };
function reportData(landscape: { pipeline?: PipelineMap | null; catalysts?: CatalystCalendar | null; funnel?: PatientFunnel | null }): PDFReportData {
  return { brief: { asOf: AS_OF, asset, landscape: { pipeline: null, catalysts: null, funnel: null, ...landscape } } } as unknown as PDFReportData;
}

// ─── Phase normalisation ───────────────────────────────────────────────────

describe('normaliseTrialPhase', () => {
  it('folds registry phases into the five grid columns', () => {
    expect(normaliseTrialPhase('early_phase_1')).toBe('phase_1');
    expect(normaliseTrialPhase('phase_1')).toBe('phase_1');
    expect(normaliseTrialPhase('phase_1_2')).toBe('phase_1');
    expect(normaliseTrialPhase('phase_2')).toBe('phase_2');
    expect(normaliseTrialPhase('phase_2_3')).toBe('phase_2');
    expect(normaliseTrialPhase('phase_3')).toBe('phase_3');
    expect(normaliseTrialPhase('phase_4')).toBe('approved');
    expect(normaliseTrialPhase('PHASE2')).toBe('phase_2');
  });
  it('drops not_applicable / unknown / null', () => {
    expect(normaliseTrialPhase('not_applicable')).toBeNull();
    expect(normaliseTrialPhase('unknown')).toBeNull();
    expect(normaliseTrialPhase(null)).toBeNull();
  });
});

describe('normaliseAssetPhase', () => {
  it('accepts calculator and deals keys', () => {
    expect(normaliseAssetPhase('phase2')).toBe('phase_2');
    expect(normaliseAssetPhase('phase_2')).toBe('phase_2');
    expect(normaliseAssetPhase('phase1_2')).toBe('phase_1');
    expect(normaliseAssetPhase('nda_filed')).toBe('approved');
    expect(normaliseAssetPhase('preclinical')).toBe('preclinical');
    expect(normaliseAssetPhase('discovery')).toBe('discovery');
    expect(normaliseAssetPhase('garbage')).toBe('unknown');
  });
});

// ─── Bucket normalisation ──────────────────────────────────────────────────

describe('normaliseBucket', () => {
  it('maps registry modality values', () => {
    expect(normaliseBucket('antibody')).toBe('Antibody');
    expect(normaliseBucket('adc')).toBe('Antibody');
    expect(normaliseBucket('small_molecule')).toBe('Small molecule');
    expect(normaliseBucket('oligonucleotide')).toBe('ASO/RNA');
    expect(normaliseBucket('gene_therapy')).toBe('Gene therapy');
    expect(normaliseBucket('cell_therapy')).toBe('Cell therapy');
    expect(normaliseBucket('peptide')).toBe('Peptide/protein');
    expect(normaliseBucket('radiopharm')).toBe('Other');
  });
  it('maps calculator modality keys', () => {
    expect(normaliseBucket('mab')).toBe('Antibody');
    expect(normaliseBucket('bispecific')).toBe('Antibody');
    expect(normaliseBucket('smallMolecule')).toBe('Small molecule');
    expect(normaliseBucket('protac')).toBe('Small molecule');
    expect(normaliseBucket('rnai')).toBe('ASO/RNA');
    expect(normaliseBucket('aso')).toBe('ASO/RNA');
    expect(normaliseBucket('carT_heme')).toBe('Cell therapy');
    expect(normaliseBucket('therapeuticVaccine')).toBe('Vaccine');
    expect(normaliseBucket('geneTherapy')).toBe('Gene therapy');
  });
  it('falls back to intervention name then intervention type', () => {
    expect(normaliseBucket('other', 'BIOLOGICAL', 'gantenerumab')).toBe('Antibody');
    expect(normaliseBucket(null, 'BIOLOGICAL', 'ACI-24 vaccine')).toBe('Vaccine');
    expect(normaliseBucket(null, 'DRUG', 'ABC-123')).toBe('Small molecule');
    expect(normaliseBucket(null, 'BIOLOGICAL', 'ABC-123')).toBe('Peptide/protein');
    expect(normaliseBucket(null, 'GENETIC', 'ABC-123')).toBe('Gene therapy');
    expect(normaliseBucket(null, null, null)).toBe('Other');
  });
});

// ─── Crowding score ────────────────────────────────────────────────────────

describe('crowdingScore', () => {
  it('is 0 with nothing at or ahead and null without a map', () => {
    expect(crowdingScore(0, 20)).toBe(0);
    expect(crowdingScore(3, 0)).toBeNull();
  });
  it('follows 60·min(1, A/10) + 40·(A/T)', () => {
    expect(crowdingScore(5, 20)).toBe(Math.round(60 * 0.5 + 40 * 0.25)); // 40
    expect(crowdingScore(10, 10)).toBe(100);
    expect(crowdingScore(25, 30)).toBe(Math.round(60 + 40 * (25 / 30))); // 93
  });
});

// ─── Indication matching ───────────────────────────────────────────────────

describe('indicationSpec / trialMatchesIndication', () => {
  it('matches Alzheimer condition spellings via the synonym map', () => {
    const spec = indicationSpec('alzheimers');
    expect(spec.category).toBe('cns');
    for (const c of ['Alzheimer Disease', "Alzheimer's Disease", 'Alzheimers Disease', 'Alzheimer&#39;s Disease', "Early Alzheimer's Disease"]) {
      expect(trialMatchesIndication({ conditions: [c], indication_specific: null, trial_title: null }, spec)).toBe(true);
    }
    expect(trialMatchesIndication({ conditions: ['Migraine'], indication_specific: null, trial_title: 'Alzheimer study' }, spec)).toBe(false);
    expect(trialMatchesIndication({ conditions: [], indication_specific: null, trial_title: 'A Study in Alzheimer Disease' }, spec)).toBe(true);
  });
  it('derives all-words matching for unknown keys', () => {
    const spec = indicationSpec('lupusNephritis');
    expect(trialMatchesIndication({ conditions: ['Lupus Nephritis'], indication_specific: null, trial_title: null }, spec)).toBe(true);
    expect(trialMatchesIndication({ conditions: ['Lupus Erythematosus, Systemic'], indication_specific: null, trial_title: null }, spec)).toBe(false);
  });
});

// ─── Patient funnel ────────────────────────────────────────────────────────

describe('buildPatientFunnel', () => {
  it('returns null without a market estimate', () => {
    expect(buildPatientFunnel(undefined, AS_OF)).toBeNull();
    expect(buildPatientFunnel(null, AS_OF)).toBeNull();
  });
  it('builds ordered steps, price, share and peak sales from the estimate', () => {
    const f = buildPatientFunnel(market, AS_OF)!;
    expect(f).not.toBeNull();
    expect(f.steps.map(s => s.label)).toEqual(['Population', 'Prevalent patients', 'Diagnosed', 'Treated', 'Drug-eligible', 'Addressable']);
    expect(f.steps[5].value).toBe(120_000);
    expect(f.pricePerYearUsd).toBe(28_000);
    expect(f.peakShare).toEqual({ low: 0.1, median: 0.2, high: 0.35 });
    expect(f.peakSalesM).toEqual({ low: 800, median: 1800, high: 3600 });
    expect(f.territory).toBe('us_only');
    expect(f.source.source).toBe('Solidus epidemiology model');
    expect(f.source.asOf).toBe(AS_OF);
  });
  it('derives price from TAM / prevalent when annualRevenuePerPatient is missing', () => {
    const f = buildPatientFunnel({ ...market, annualRevenuePerPatient: 0 }, AS_OF)!;
    expect(f.pricePerYearUsd).toBe(Math.round((57120 * 1e6) / 2_040_000));
  });
  it('flags fallback data in the source note', () => {
    const f = buildPatientFunnel({ ...market, usedFallback: true, fallbackReasons: ['territory defaulted to global'] }, AS_OF)!;
    expect(f.source.note).toContain('defaults used');
  });
});

// ─── Recommended window ────────────────────────────────────────────────────

describe('computeRecommendedWindow', () => {
  const ev = (date: string, over: Partial<{ kind: 'readout' | 'loe'; phase: 'phase_2' | 'phase_3' | null; sameBucket: boolean }> = {}) => ({
    date, kind: over.kind ?? 'readout', phase: over.phase ?? 'phase_2', sameBucket: over.sameBucket ?? false,
  } as const);

  it('uses the first 6 months when no same-bucket Phase 3 readout exists', () => {
    const w = computeRecommendedWindow([ev('2027-03-01', { phase: 'phase_3' }), ev('2027-06-01')], AS_OF, 24)!;
    expect(w.start).toBe(AS_OF);
    expect(w.end).toBe('2027-03-23');
    expect(w.rationale).toMatch(/No same-mechanism Phase 3/);
  });
  it('picks the longest ≥ 3-month gap before the first same-bucket Phase 3 readout', () => {
    const w = computeRecommendedWindow([
      ev('2026-11-01'),                                   // 1.3 months after asOf
      ev('2027-06-01'),                                   // 7 months later → longest gap
      ev('2027-08-01', { phase: 'phase_3', sameBucket: true }), // the threat
      ev('2027-02-01', { phase: 'phase_3', sameBucket: true }), // sorted first → actually the first threat
    ], AS_OF, 24)!;
    // First threat is 2027-02-01; points: asOf, 2026-11-01, 2027-02-01 → gap 3 months from Nov to Feb
    expect(w.start).toBe('2026-11-01');
    expect(w.end).toBe('2027-02-01');
    expect(w.rationale).toMatch(/2027-02/);
  });
  it('moves immediately when no 3-month gap precedes the threat', () => {
    const w = computeRecommendedWindow([ev('2026-10-15'), ev('2026-12-01', { phase: 'phase_3', sameBucket: true })], AS_OF, 24)!;
    expect(w.start).toBe(AS_OF);
    expect(w.rationale).toMatch(/move immediately/);
  });
});

// ─── Patent cliff parser ───────────────────────────────────────────────────

describe('parsePatentCliffs', () => {
  it('tolerates the shapes seen in companies.patent_cliffs', () => {
    const out = parsePatentCliffs([
      { drug_name: 'Leqembi (lecanemab)', expiry_year: 2037, revenue_usd: 1.8e9 },
      { drug: 'Fycompa', loe_year: '2027', revenue: 4e8 },
      { name: 'X', year: 2028 },
      { drug: 'no year' },
      null,
    ]);
    expect(out).toEqual([
      { drug: 'Leqembi (lecanemab)', year: 2037, revenueUsd: 1.8e9 },
      { drug: 'Fycompa', year: 2027, revenueUsd: 4e8 },
      { drug: 'X', year: 2028, revenueUsd: null },
    ]);
    expect(parsePatentCliffs(null)).toEqual([]);
  });
});

// ─── Async builders with a stubbed client ──────────────────────────────────

describe('buildPipelineMap (stubbed client)', () => {
  it('buckets, dedupes and positions the asset', async () => {
    const db = stubDb({ company_trials: TRIALS });
    const map = (await buildPipelineMap(db, asset, { asOf: AS_OF, buyerNames: ['Eli Lilly', 'Biogen'] }))!;
    expect(map).not.toBeNull();
    expect(map.source.asOf).toBe(AS_OF);
    // Migraine row excluded; Simufilam deduped to its most advanced phase (3); MGH kept because industry set < 8
    expect(map.source.n).toBe(8);
    expect(map.totals.phase_3).toBe(4);
    expect(map.totals.phase_2).toBe(2);
    expect(map.totals.phase_1).toBe(2);
    const sm = map.rows.find(r => r.bucket === 'Small molecule')!;
    expect(sm.cells.find(c => c.phase === 'phase_3')!.programs.map(p => p.intervention)).toEqual(['Simufilam']);
    expect(map.assetPosition).toEqual({ bucket: 'Antibody', phase: 'phase_2' });
    const ab = map.rows.find(r => r.bucket === 'Antibody')!;
    const lilly = ab.cells.find(c => c.phase === 'phase_3')!.programs.find(p => p.sponsor.includes('Lilly'))!;
    expect(lilly.isBuyerCandidate).toBe(true);
    // Antibody at/ahead of phase 2: Lilly P3, Eisai P3 → A = 2, T = 8 → 60·0.2 + 40·0.25 = 22
    expect(map.crowdingScore).toBe(22);
    // Server-side filters were applied on category and status
    expect(db.calls[0].ops).toEqual(expect.arrayContaining(['in:indication_category', 'in:status']));
  });
  it('returns null under three programs', async () => {
    const db = stubDb({ company_trials: TRIALS.slice(0, 2) });
    expect(await buildPipelineMap(db, asset, { asOf: AS_OF })).toBeNull();
  });
});

describe('buildCatalystCalendar (stubbed client)', () => {
  const companies = [
    { name: 'Eli Lilly and Company', patent_cliffs: [{ drug_name: 'Trulicity', expiry_year: 2027, revenue_usd: 5e9 }, { drug_name: 'Far', expiry_year: 2035 }] },
    { name: 'Eisai', patent_cliffs: [{ drug_name: 'Leqembi', expiry_year: 2037 }] },
  ];
  const cliffs = [{ indication: 'alzheimers', drug: 'Aricept', loe_year: 2028, biosimilar_year: null, current_revenue_usd_m: 250 }];

  it('builds readouts and LOE events with deterministic impact and direction', async () => {
    const db = stubDb({ company_trials: TRIALS, companies, indication_patent_cliffs: cliffs });
    const cal = (await buildCatalystCalendar(db, asset, { asOf: AS_OF, windowMonths: 24, buyerNames: ['Eli Lilly', 'Eisai'] }))!;
    expect(cal).not.toBeNull();
    expect(cal.windowMonths).toBe(24);
    const dates = cal.events.map(e => e.date);
    expect([...dates].sort()).toEqual(dates);
    // Phase 1/2 (NCT6, NCT10) and out-of-window rows are excluded from readouts
    expect(cal.events.some(e => e.nctId === 'NCT6' || e.nctId === 'NCT10')).toBe(false);
    const lilly = cal.events.find(e => e.nctId === 'NCT1')!;
    expect(lilly.isBuyerCandidate).toBe(true);
    expect(lilly.impact).toMatch(/Buyer's own program/);
    expect(lilly.direction).toBe('mixed');
    expect(lilly.title).toBe('Eli Lilly and Company · Remternetug · Phase 3 primary completion');
    const novo = cal.events.find(e => e.nctId === 'NCT8')!;
    expect(novo.impact).toMatch(/different mechanism/);
    const biogen = cal.events.find(e => e.nctId === 'NCT3')!;
    expect(biogen.impact).toMatch(/Sets the bar/);
    const loe = cal.events.filter(e => e.kind === 'loe');
    expect(loe.map(e => e.title)).toEqual(expect.arrayContaining(['Eli Lilly and Company · Trulicity loses exclusivity', 'Aricept loses exclusivity in the indication']));
    expect(loe.every(e => e.direction === 'up')).toBe(true);
    expect(loe.some(e => e.title.includes('Far'))).toBe(false);
    expect(cal.recommendedWindow).not.toBeNull();
    expect(cal.source.n).toBe(cal.events.length);
  });
  it('marks a same-bucket Phase 3 readout from a large non-buyer sponsor as down', async () => {
    const db = stubDb({ company_trials: TRIALS, companies: [], indication_patent_cliffs: [] });
    const cal = (await buildCatalystCalendar(db, asset, { asOf: AS_OF, buyerNames: [] }))!;
    const eisai = cal.events.find(e => e.nctId === 'NCT2')!;
    expect(eisai.direction).toBe('down');
    expect(eisai.impact).toMatch(/Repricing event for the mechanism class/);
  });
  it('returns null with nothing in the window', async () => {
    const db = stubDb({ company_trials: [], companies: [], indication_patent_cliffs: [] });
    expect(await buildCatalystCalendar(db, asset, { asOf: AS_OF })).toBeNull();
  });
  it('collapses the same intervention/phase/date listed under a sponsor-name variant', async () => {
    const twins = [
      trial({ nct_id: 'NCT20', lead_sponsor_name: 'Bristol-Myers Squibb', intervention_name: 'KarXT', modality: 'small_molecule', phase: 'phase_3', primary_completion_date: '2026-10-05' }),
      trial({ nct_id: 'NCT21', lead_sponsor_name: 'Karuna Therapeutics, Inc., a Bristol Myers Squibb company', intervention_name: 'KarXT', modality: 'small_molecule', phase: 'phase_3', primary_completion_date: '2026-10-05' }),
      trial({ nct_id: 'NCT22', lead_sponsor_name: 'Other Co', intervention_name: 'KarXT', modality: 'small_molecule', phase: 'phase_3', primary_completion_date: '2027-04-05' }),
    ];
    const db = stubDb({ company_trials: twins, companies: [], indication_patent_cliffs: [] });
    const cal = (await buildCatalystCalendar(db, asset, { asOf: AS_OF }))!;
    expect(cal.events.filter(e => e.kind === 'readout').map(e => e.nctId)).toEqual(['NCT20', 'NCT22']);
  });
});

describe('buildLandscape', () => {
  it('settles each part independently and nulls failures', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const db = stubDb({ company_trials: TRIALS, companies: [], indication_patent_cliffs: [] }, { failTables: ['company_trials'] });
    const l = await buildLandscape(db, asset, market, { asOf: AS_OF });
    expect(l.pipeline).toBeNull();
    expect(l.catalysts).toBeNull();
    expect(l.funnel).not.toBeNull();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[Brief]'), expect.anything());
    spy.mockRestore();
  });
});

// ─── Charts ────────────────────────────────────────────────────────────────

describe('svg charts', () => {
  it('pipeline grid escapes names, outlines the asset cell and stays ≤ 560 wide', async () => {
    const db = stubDb({ company_trials: TRIALS });
    const map = (await buildPipelineMap(db, asset, { asOf: AS_OF, buyerNames: ['Eli Lilly'] }))!;
    const svg = renderPipelineGrid(map);
    expect(svg).toMatch(/^<svg id="pg-/);
    expect(svg).toContain('width="560"');
    expect(svg).toContain('Weird &lt;Sponsor&gt;');
    expect(svg).not.toContain('<Sponsor>');
    expect(svg).toContain(`stroke="#0d9488" stroke-width="2"`);
  });
  it('catalyst timeline draws markers by kind and the window', async () => {
    const db = stubDb({ company_trials: TRIALS, companies: [{ name: 'Eli Lilly', patent_cliffs: [{ drug: 'Trulicity', year: 2027 }] }], indication_patent_cliffs: [] });
    const cal = (await buildCatalystCalendar(db, asset, { asOf: AS_OF, buyerNames: ['Eli Lilly'] }))!;
    const svg = renderCatalystTimeline(cal);
    expect(svg).toMatch(/^<svg id="ct-/);
    expect(svg).toContain('GO-TO-MARKET WINDOW');
    expect(svg).toContain('<circle');
    expect(svg).toContain('<rect');
    expect(svg).toContain('Q4 26');
  });
  it('patient funnel log-scales a > 100× range and formats thousands', () => {
    const f = buildPatientFunnel(market, AS_OF)!;
    const svg = renderPatientFunnel(f);
    expect(svg).toContain('log-scaled');
    expect(svg).toContain('340,000,000');
    expect(svg).toContain('120,000');
    expect(svg).toContain('↓ 55%');
  });
});

// ─── Pages ─────────────────────────────────────────────────────────────────

describe('page renderers', () => {
  it('pipeline map page renders content and empty state', async () => {
    const db = stubDb({ company_trials: TRIALS });
    const map = (await buildPipelineMap(db, asset, { asOf: AS_OF, buyerNames: ['Eli Lilly'] }))!;
    const html = renderPipelineMapPage(reportData({ pipeline: map }), meta);
    expect(html).toContain('class="report-page"');
    expect(html).toContain('Pipeline map');
    expect(html).toContain('Deal Intelligence Brief');
    expect(html).toContain('Source: ClinicalTrials.gov via Solidus');
    expect(html).toContain('Crowding score');
    expect(html).toContain('Weird &lt;Sponsor&gt;');
    expect(html).not.toMatch(/\bAI\b|illustrative|sample/i);

    const empty = renderPipelineMapPage(reportData({ pipeline: null }), meta);
    expect(empty).toContain('class="report-page"');
    expect(empty).toContain('No pipeline map for this indication');
  });
  it('catalyst calendar page renders table, window and empty state', async () => {
    const db = stubDb({ company_trials: TRIALS, companies: [], indication_patent_cliffs: [] });
    const cal = (await buildCatalystCalendar(db, asset, { asOf: AS_OF }))!;
    const html = renderCatalystCalendarPage(reportData({ catalysts: cal }), meta);
    expect(html).toContain('Catalyst calendar');
    expect(html).toContain('Recommended go-to-market window');
    expect(html).toContain('Why it matters');
    expect(html).toContain('Source: ClinicalTrials.gov via Solidus');
    expect((html.match(/<tr>/g) ?? []).length).toBeLessThanOrEqual(15);
    const empty = renderCatalystCalendarPage(reportData({ catalysts: null }), meta);
    expect(empty).toContain('No dated catalysts in the window');
  });
  it('patient funnel page renders KPI strip, build table and empty state', () => {
    const f = buildPatientFunnel(market, AS_OF)!;
    const html = renderPatientFunnelPage(reportData({ funnel: f }), meta);
    expect(html).toContain('Patient funnel');
    expect(html).toContain('Peak sales · median');
    expect(html).toContain('$1.8B');
    expect(html).toContain('Source: Solidus epidemiology model');
    expect(html).toContain('US Only');
    expect(html).toContain('rNPV');
    const empty = renderPatientFunnelPage(reportData({ funnel: null }), meta);
    expect(empty).toContain('No patient funnel for this indication');
  });
});
