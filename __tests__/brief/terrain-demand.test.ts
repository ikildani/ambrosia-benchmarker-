/**
 * Brief v3 — Terrain demand-layer client and the landscape builders' use of it.
 * No network: `fetch` is mocked. No database: the pipeline map uses the same
 * chainable PostgREST stub as landscape.test.ts.
 */

import {
  fetchDemandProfile,
  clearTerrainDemandCache,
  netPricePerYearUsd,
  densityToCrowding,
  TERRAIN_DEMAND_SOURCE,
  TERRAIN_DEMAND_TIMEOUT_MS,
  type TerrainDemandProfile,
} from '@/lib/brief/terrain-demand';
import { buildPatientFunnel, buildPipelineMap, buildLandscape, funnelFromTerrain, landscapeUsesTerrain } from '@/lib/brief/landscape';
import type { AssetProfile, PatientFunnel, PipelineMap } from '@/lib/brief/types';
import type { MarketSizeEstimate } from '@/lib/financial/types';
import { renderPatientFunnelPage } from '@/lib/report/pages/patientFunnel';
import { renderPipelineMapPage } from '@/lib/report/pages/pipelineMap';
import type { PDFReportData, ReportMeta } from '@/lib/report/types';

const AS_OF = '2026-09-23';

// ─── Fixtures ──────────────────────────────────────────────────────────────

/** Abridged real response for alzheimers?territory=us_eu (Terrain docs, 2026-09-25). */
const PROFILE: TerrainDemandProfile = {
  identity: { terrainName: "Alzheimer's Disease", solidusKey: 'alzheimers', therapyArea: 'neurology', match: 'exact' },
  epidemiology: {
    population: 'US', prevalence: 6_800_000, incidence: 500_000, diagnosisRate: 0.45, treatmentRate: 0.6,
    diagnosed: 3_060_000, treated: 1_836_000, confidence: 'medium', verifiedYear: 2024, source: "Alzheimer's Association 2024 Facts and Figures",
  },
  market: {
    territory: { requested: 'us_eu', geographies: ['US', 'EU5'] },
    currency: 'USD',
    territoryBreakdown: [
      { code: 'US', territory: 'United States', tamUsd: 77_110_000_000, population: 336_000_000, marketMultiplier: 1 },
      { code: 'EU5', territory: 'EU5 (Combined)', tamUsd: 30_840_000_000, population: 330_000_000, marketMultiplier: 0.4 },
    ],
    peakSalesUsdM: { low: 1428, base: 3428, high: 5143 },
    priceBenchmark: { wacAnnualUsd: { conservative: 27_350, base: 56_000, premium: 82_500 }, grossToNet: 0.25, comparableCount: 8, rationale: 'Based on 23 approved neurology comparables.' },
    patientFunnel: {
      us_prevalence: 6_800_000, us_incidence: 500_000, diagnosed: 3_060_000, diagnosed_rate: 0.45, treated: 1_836_000, treated_rate: 0.6,
      adherent: 1_468_800, adherence_rate: 0.8, addressable: 734_400, addressable_rate: 0.5, capturable: 88_128, capturable_rate: 0.12,
    },
    engineInputs: { developmentStage: 'phase2', pricingAssumption: 'base', launchYear: 2028 },
  },
  competition: {
    densityScore: 5, densityLabel: 'Moderate',
    countsByPhase: { approved: 3, phase3: 2, phase2: 0, phase1: 4, preclinical: 1, withdrawnOrDiscontinued: 0, total: 10 },
    keyPrograms: [
      { company: 'Eisai/Biogen', asset: 'Leqembi', mechanism: 'Anti-amyloid beta antibody (protofibril-selective)', phase: 'Approved', differentiationScore: 3, evidenceStrength: 9, source: 'FDA label' },
      { company: 'Eli Lilly', asset: 'Kisunla', mechanism: 'Anti-amyloid mAb (N3pG)', phase: 'Approved', differentiationScore: 4, evidenceStrength: 9, source: 'FDA label' },
      { company: 'Eli Lilly', asset: 'Remternetug', mechanism: 'Anti-amyloid mAb', phase: 'Phase 3', differentiationScore: 5, evidenceStrength: 6, source: 'CT.gov' },
      { company: 'Biogen', asset: 'BIIB080', mechanism: 'Tau antisense oligonucleotide', phase: 'Phase 2', differentiationScore: 7, evidenceStrength: 4, source: 'CT.gov' },
      { company: 'Old Co', asset: 'Gone', mechanism: 'Small molecule', phase: 'Withdrawn', differentiationScore: 1, evidenceStrength: 1, source: 'n/a' },
    ],
    whiteSpace: ['No Anti Tau assets'], keyInsight: '10 tracked competitive assets.',
  },
  assumptions: ['development_stage defaulted to "phase2"'],
  asOf: '2026-09-25',
  generatedAt: '2026-09-25T16:15:29.601Z',
  contractVersion: '1.0',
};

const asset: AssetProfile = {
  assetName: 'AMB-101', company: 'Client Co', modality: 'mab', phase: 'phase2',
  indication: 'alzheimers', therapeuticArea: 'neurology', territory: 'global', targetDealType: 'license',
};

const market: MarketSizeEstimate = {
  indication: 'alzheimers', territory: 'us_only',
  totalAddressableMarket: 57120, serviceableAddressableMarket: 5000, serviceableObtainableMarket: 1200,
  peakSales: { low: 800, median: 1800, high: 3600 },
  patientFunnel: { totalPopulation: 340_000_000, prevalentPatients: 2_040_000, diagnosedPatients: 1_122_000, treatedPatients: 504_900, drugEligiblePatients: 176_715, addressablePatients: 120_000 },
  marketShareAssumption: { low: 0.1, median: 0.2, high: 0.35 },
  annualRevenuePerPatient: 28_000,
  sources: ['WHO Global Health Observatory'],
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

const MANY_TRIALS = [
  trial({ nct_id: 'NCT1', lead_sponsor_name: 'Eli Lilly and Company', intervention_name: 'Remternetug', modality: 'antibody', phase: 'phase_3' }),
  trial({ nct_id: 'NCT2', lead_sponsor_name: 'Eisai Inc.', intervention_name: 'Lecanemab SC', modality: 'antibody', phase: 'phase_3' }),
  trial({ nct_id: 'NCT3', lead_sponsor_name: 'Biogen', intervention_name: 'BIIB080', modality: 'oligonucleotide', phase: 'phase_2' }),
  trial({ nct_id: 'NCT4', lead_sponsor_name: 'Cassava Sciences', intervention_name: 'Simufilam', modality: 'small_molecule', phase: 'phase_3' }),
  trial({ nct_id: 'NCT6', lead_sponsor_name: 'AC Immune', intervention_name: 'ACI-24', modality: 'other', intervention_type: 'BIOLOGICAL', phase: 'phase_1_2' }),
];
/** Only two local programs → below the map threshold. */
const THIN_TRIALS = MANY_TRIALS.slice(0, 2);

function stubDb(tables: Record<string, Record<string, unknown>[]>) {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const b: any = {
        select() { return b; },
        in(col: string, vals: string[]) { rows = rows.filter(r => vals.includes(String(r[col]))); return b; },
        gte() { return b; }, lte() { return b; }, ilike() { return b; }, or() { return b; }, order() { return b; },
        range(from: number, to: number) { rows = rows.slice(from, to + 1); return b; },
        limit(n: number) { rows = rows.slice(0, n); return b; },
        then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) { return Promise.resolve({ data: rows, error: null }).then(resolve, reject); },
      };
      return b;
    },
  };
}

const meta: ReportMeta = { reportId: 'AMB-TEST', generatedAt: AS_OF, version: '3', pageCount: 30, currentPage: 18, tocEntries: [] };
function reportData(landscape: { pipeline?: PipelineMap | null; funnel?: PatientFunnel | null }): PDFReportData {
  return { brief: { asOf: AS_OF, asset, landscape: { pipeline: null, catalysts: null, funnel: null, ...landscape } } } as unknown as PDFReportData;
}

// ─── fetch mock helpers ────────────────────────────────────────────────────

type FetchMock = jest.Mock<Promise<Response>, [string | URL | Request, RequestInit?]>;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

let fetchMock: FetchMock;
let warnSpy: jest.SpyInstance;
const ENV = { ...process.env };

beforeEach(() => {
  clearTerrainDemandCache();
  process.env = { ...ENV, TERRAIN_API_KEY: 'sk_terrain_test', TERRAIN_API_URL: 'https://terrain.test' };
  fetchMock = jest.fn();
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  process.env = { ...ENV };
  warnSpy.mockRestore();
  jest.useRealTimers();
});

// ─── Client ────────────────────────────────────────────────────────────────

describe('fetchDemandProfile', () => {
  it('calls Terrain by Solidus slug with the bearer key and territory, and returns profile + asOf', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: true, data: PROFILE }));
    const out = await fetchDemandProfile('alzheimers', { territory: 'us_eu' });
    expect(out).not.toBeNull();
    expect(out!.asOf).toBe('2026-09-25');
    expect(out!.profile.identity.solidusKey).toBe('alzheimers');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://terrain.test/api/v1/demand/alzheimers?territory=us_eu');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer sk_terrain_test');
    expect(init!.signal).toBeInstanceOf(AbortSignal);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('defaults the base URL to terrain.ambrosiaventures.co and omits territory when not given', async () => {
    delete process.env.TERRAIN_API_URL;
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: true, data: PROFILE }));
    await fetchDemandProfile('alzheimers');
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://terrain.ambrosiaventures.co/api/v1/demand/alzheimers');
  });

  it('returns null without a key and does not call the network', async () => {
    delete process.env.TERRAIN_API_KEY;
    expect(await fetchDemandProfile('alzheimers')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/^\[Brief\] terrain demand unavailable: TERRAIN_API_KEY/));
  });

  it('returns null on 401 and logs once per slug', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { success: false, error: 'Invalid or missing API key.' }));
    expect(await fetchDemandProfile('alzheimers')).toBeNull();
    expect(await fetchDemandProfile('alzheimers')).toBeNull();
    expect(await fetchDemandProfile('parkinsons')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3); // auth failures are not cached
    expect(warnSpy).toHaveBeenCalledTimes(2);   // once per slug
    expect(warnSpy.mock.calls[0][0]).toContain('invalid or missing API key');
  });

  it('returns null on 403 (missing demand scope) and 404 (no Terrain counterpart); the 404 is cached', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, { success: false, error: 'API key does not have the demand scope.' }));
    expect(await fetchDemandProfile('alzheimers')).toBeNull();
    expect(warnSpy.mock.calls[0][0]).toContain('demand scope');

    fetchMock.mockResolvedValueOnce(jsonResponse(404, { success: false, error: 'Solidus key "thymoma" has no Terrain counterpart', suggestions: [] }));
    expect(await fetchDemandProfile('thymoma')).toBeNull();
    expect(await fetchDemandProfile('thymoma')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warnSpy.mock.calls[1][0]).toContain('no Terrain counterpart for "thymoma"');
  });

  it('aborts after the timeout and returns null', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation((_url, init) => new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => {
        const err = new Error('The operation was aborted.');
        err.name = 'AbortError';
        reject(err);
      });
    }));
    const p = fetchDemandProfile('alzheimers');
    await jest.advanceTimersByTimeAsync(TERRAIN_DEMAND_TIMEOUT_MS + 1);
    expect(await p).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain(`timeout after ${TERRAIN_DEMAND_TIMEOUT_MS} ms`);
  });

  it('returns null on a network error or malformed body, never throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect(await fetchDemandProfile('alzheimers')).toBeNull();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: true, data: { asOf: 'not-a-date' } }));
    expect(await fetchDemandProfile('parkinsons')).toBeNull();
    expect(warnSpy.mock.calls[0][0]).toContain('network error ECONNREFUSED');
    expect(warnSpy.mock.calls[1][0]).toContain('unexpected response shape');
  });

  it('serves a cache hit for ten minutes per slug and territory', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: PROFILE }));
    const a = await fetchDemandProfile('alzheimers', { territory: 'us_only' });
    const b = await fetchDemandProfile('alzheimers', { territory: 'us_only' });
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await fetchDemandProfile('alzheimers', { territory: 'global' });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    jest.useFakeTimers();
    jest.setSystemTime(Date.now() + 10 * 60 * 1000 + 1);
    await fetchDemandProfile('alzheimers', { territory: 'us_only' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('exposes net price and crowding helpers on the profile', () => {
    expect(netPricePerYearUsd(PROFILE)).toBe(42_000);            // 56,000 × (1 − 0.25)
    expect(densityToCrowding(PROFILE)).toBe(50);                 // 5 / 10 → 50 / 100
    expect(densityToCrowding({ ...PROFILE, competition: { ...PROFILE.competition, densityScore: NaN } })).toBeNull();
  });
});

// ─── Patient funnel mapping ────────────────────────────────────────────────

describe('buildPatientFunnel with a Terrain profile', () => {
  it('maps Terrain fields onto the funnel and stamps the Terrain source note', () => {
    const f = buildPatientFunnel(market, AS_OF, PROFILE)!;
    expect(f).not.toBeNull();
    expect(f.steps).toEqual([
      { label: 'Population', value: 336_000_000 },
      { label: 'Prevalent patients', value: 6_800_000 },
      { label: 'Diagnosed', value: 3_060_000 },
      { label: 'Treated', value: 1_836_000 },
      { label: 'Adherent', value: 1_468_800 },
      { label: 'Addressable', value: 734_400 },
    ]);
    expect(f.pricePerYearUsd).toBe(42_000);
    expect(f.peakSalesM).toEqual({ low: 1428, median: 3428, high: 5143 });
    expect(f.peakShare!.median).toBe(0.12);
    expect(f.peakShare!.low).toBeCloseTo(0.12 * (1428 / 3428), 6);
    expect(f.peakShare!.high).toBeCloseTo(0.12 * (5143 / 3428), 6);
    expect(f.territory).toBe('us_only');
    expect(f.source).toEqual({
      source: TERRAIN_DEMAND_SOURCE,
      n: 6,
      asOf: '2026-09-25',
      note: 'indication alzheimers; Solidus stores the slug and asOf only',
    });
    // No Terrain figure other than what the page prints, and none of Terrain's names.
    expect(JSON.stringify(f)).not.toContain("Alzheimer's Disease");
  });

  it('surfaces a proxy mapping in the source note', () => {
    const proxy: TerrainDemandProfile = {
      ...PROFILE,
      identity: { ...PROFILE.identity, solidusKey: 'tremor', match: 'proxy', matchNote: 'Terrain figures are essential tremor only.' },
    };
    const f = buildPatientFunnel(null, AS_OF, proxy)!;
    expect(f.source.note).toBe('indication tremor; Solidus stores the slug and asOf only; proxy match: Terrain figures are essential tremor only.');
  });

  it('falls back to the local epidemiology model when no profile is supplied or the profile is unusable', () => {
    const local = buildPatientFunnel(market, AS_OF)!;
    expect(local.source.source).toBe('Solidus epidemiology model');
    expect(local.steps.map(s => s.label)).toContain('Drug-eligible');
    expect(local.pricePerYearUsd).toBe(28_000);

    const unusable: TerrainDemandProfile = {
      ...PROFILE,
      market: { ...PROFILE.market, territoryBreakdown: [], patientFunnel: { ...PROFILE.market.patientFunnel, us_prevalence: 0, diagnosed: 0, treated: 0, adherent: 0, addressable: 0 } },
    };
    expect(funnelFromTerrain(unusable)).toBeNull();
    const f = buildPatientFunnel(market, AS_OF, unusable)!;
    expect(f.source.source).toBe('Solidus epidemiology model');
    expect(buildPatientFunnel(null, AS_OF, unusable)).toBeNull();
  });

  it('leaves peakShare null when Terrain has no capturable rate', () => {
    const noShare: TerrainDemandProfile = { ...PROFILE, market: { ...PROFILE.market, patientFunnel: { ...PROFILE.market.patientFunnel, capturable_rate: 0 } } };
    expect(buildPatientFunnel(null, AS_OF, noShare)!.peakShare).toBeNull();
  });
});

// ─── Pipeline map fallbacks ────────────────────────────────────────────────

describe('buildPipelineMap with a Terrain profile', () => {
  it('keeps the local registry map and score when the local set is rich', async () => {
    const db = stubDb({ company_trials: MANY_TRIALS });
    const map = (await buildPipelineMap(db, asset, { asOf: AS_OF, buyerNames: ['Eli Lilly'], terrain: PROFILE }))!;
    expect(map.source.source).toBe('ClinicalTrials.gov via Solidus');
    expect(map.source.n).toBe(5);
    expect(map.crowdingBasis).toBe('solidus_trials');
    expect(map.crowdingScore).not.toBeNull();
    expect(map.source.note).not.toContain('Terrain');
  });

  it('uses Terrain density for crowding when the local score is null (unknown asset phase)', async () => {
    const db = stubDb({ company_trials: MANY_TRIALS });
    const map = (await buildPipelineMap(db, { ...asset, phase: 'mystery' }, { asOf: AS_OF, terrain: PROFILE }))!;
    expect(map.source.source).toBe('ClinicalTrials.gov via Solidus');
    expect(map.assetPosition).toBeNull();
    expect(map.crowdingScore).toBe(50);
    expect(map.crowdingBasis).toBe('terrain_density');
    expect(map.source.note).toContain('crowding from Terrain density score 5/10 (moderate), as of 2026-09-25');

    const without = (await buildPipelineMap(db, { ...asset, phase: 'mystery' }, { asOf: AS_OF }))!;
    expect(without.crowdingScore).toBeNull();
  });

  it('builds the map from Terrain key programs when fewer than three local programs match', async () => {
    const db = stubDb({ company_trials: THIN_TRIALS });
    expect(await buildPipelineMap(db, asset, { asOf: AS_OF })).toBeNull();

    const map = (await buildPipelineMap(db, asset, { asOf: AS_OF, buyerNames: ['Eli Lilly'], terrain: PROFILE }))!;
    expect(map).not.toBeNull();
    expect(map.source.source).toBe(TERRAIN_DEMAND_SOURCE);
    expect(map.source.asOf).toBe('2026-09-25');
    expect(map.source.n).toBe(4);                       // withdrawn program dropped
    expect(map.source.note).toContain('indication alzheimers; 2 local registry programs matched');
    expect(map.totals.approved).toBe(2);
    expect(map.totals.phase_3).toBe(1);
    expect(map.totals.phase_2).toBe(1);
    const antibody = map.rows.find(r => r.bucket === 'Antibody')!;
    expect(antibody.total).toBe(3);
    const aso = map.rows.find(r => r.bucket === 'ASO/RNA')!;
    expect(aso.total).toBe(1);
    const lilly = antibody.cells.find(c => c.phase === 'approved')!.programs.find(p => p.sponsor === 'Eli Lilly')!;
    expect(lilly.isBuyerCandidate).toBe(true);
    expect(lilly.nctId).toBeNull();
    expect(map.assetPosition).toEqual({ bucket: 'Antibody', phase: 'phase_2' });
    // Terrain's list is capped at ten, so crowding comes from its density score, not the local formula.
    expect(map.crowdingScore).toBe(50);
    expect(map.crowdingBasis).toBe('terrain_density');
  });

  it('still returns null when both the local set and Terrain are thin', async () => {
    const db = stubDb({ company_trials: THIN_TRIALS });
    const thin: TerrainDemandProfile = { ...PROFILE, competition: { ...PROFILE.competition, keyPrograms: PROFILE.competition.keyPrograms.slice(0, 2) } };
    expect(await buildPipelineMap(db, asset, { asOf: AS_OF, terrain: thin })).toBeNull();
  });
});

// ─── Landscape orchestration ───────────────────────────────────────────────

describe('buildLandscape', () => {
  it('threads the Terrain profile through and reports usage', async () => {
    const db = stubDb({ company_trials: MANY_TRIALS, companies: [], indication_patent_cliffs: [] });
    const l = await buildLandscape(db, asset, market, { asOf: AS_OF, terrain: PROFILE });
    expect(l.funnel!.source.source).toBe(TERRAIN_DEMAND_SOURCE);
    expect(l.pipeline!.source.source).toBe('ClinicalTrials.gov via Solidus');
    expect(landscapeUsesTerrain(l)).toBe(true);

    const local = await buildLandscape(db, asset, market, { asOf: AS_OF });
    expect(local.funnel!.source.source).toBe('Solidus epidemiology model');
    expect(landscapeUsesTerrain(local)).toBe(false);
    expect(landscapeUsesTerrain(null)).toBe(false);
  });
});

// ─── Pages ─────────────────────────────────────────────────────────────────

describe('pages render with either source', () => {
  it('patient funnel page prints the Terrain source line and assumptions', () => {
    const f = buildPatientFunnel(market, AS_OF, PROFILE)!;
    const html = renderPatientFunnelPage(reportData({ funnel: f }), meta);
    expect(html).toContain('Source: Terrain demand layer');
    expect(html).toContain('n = 6');
    expect(html).toContain('indication alzheimers; Solidus stores the slug and asOf only');
    expect(html).toContain('Real-world adherence and persistence on therapy');
    expect(html).toContain('Terrain price benchmark');
    expect(html).toContain('$3.4B');
    expect(html).toContain('$42,000');
    expect(html).toContain('Patients, US Only');
    expect(html).not.toContain('Solidus epidemiology model');
  });

  it('patient funnel page keeps the local source line for the local model', () => {
    const f = buildPatientFunnel(market, AS_OF)!;
    const html = renderPatientFunnelPage(reportData({ funnel: f }), meta);
    expect(html).toContain('Source: Solidus epidemiology model');
    expect(html).toContain('Territory-adjusted net revenue per treated patient');
    expect(html).not.toContain('Terrain');
  });

  it('pipeline map page prints the Terrain source and the density-score method when used', async () => {
    const db = stubDb({ company_trials: THIN_TRIALS });
    const map = (await buildPipelineMap(db, asset, { asOf: AS_OF, buyerNames: ['Eli Lilly'], terrain: PROFILE }))!;
    const html = renderPipelineMapPage(reportData({ pipeline: map }), meta);
    expect(html).toContain('class="report-page"');
    expect(html).toContain('Source: Terrain demand layer');
    expect(html).toContain('Terrain competitive density score');
    expect(html).toContain('Leqembi');
    expect(html).toContain('50<span');

    const rich = (await buildPipelineMap(stubDb({ company_trials: MANY_TRIALS }), asset, { asOf: AS_OF, terrain: PROFILE }))!;
    const localHtml = renderPipelineMapPage(reportData({ pipeline: rich }), meta);
    expect(localHtml).toContain('Source: ClinicalTrials.gov via Solidus');
    expect(localHtml).toContain('Sixty points saturate');
    expect(localHtml).not.toContain('Terrain competitive density');
  });
});
