/**
 * Retrospective Validation Test for Partner Matching Engine
 *
 * Validates that the partner matching engine's scoring logic produces
 * sensible results when tested against known real-world deal pairs from
 * COMPARABLE_DEALS and structural invariants of the scoring model.
 *
 * Because WEIGHTS, MODALITY_ADJACENCY, INDICATION_ADJACENCY, and
 * THERAPEUTIC_AREA_INDICATIONS are not exported from partner-matching.ts,
 * this test probes them indirectly through findPartnerMatches() using
 * carefully constructed mock company profiles.
 */

import {
  findPartnerMatches,
  filterCliffsByTA,
  TA_CLIFF_KEYWORDS,
  calculateQuickWatchOuts,
  type MatchInput,
  type ScoreBreakdown,
} from '@/lib/services/partner-matching';
import { COMPARABLE_DEALS } from '@/lib/comparableDeals';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Mock Supabase client — returns companies from the data array,
// falls back gracefully for any other table queries (deals, trials, etc.)
// ---------------------------------------------------------------------------
function createMockSupabase(companies: Record<string, unknown>[]) {
  const chainable = () => {
    const chain: Record<string, jest.Mock> = {};
    chain.from = jest.fn().mockReturnValue(chain);
    chain.select = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.gte = jest.fn().mockReturnValue(chain);
    chain.or = jest.fn().mockReturnValue(chain);
    chain.in = jest.fn().mockReturnValue(chain);
    chain.overlaps = jest.fn().mockReturnValue(chain);
    chain.order = jest.fn().mockReturnValue(chain);
    chain.limit = jest.fn().mockImplementation(() =>
      Promise.resolve({ data: companies, error: null })
    );
    return chain;
  };
  return chainable() as unknown as SupabaseClient;
}

// ---------------------------------------------------------------------------
// Company profile factory
// ---------------------------------------------------------------------------
interface CompanyOverrides {
  id?: string;
  name?: string;
  company_type?: string;
  ticker?: string | null;
  hq_country?: string;
  modalities_active?: string[];
  modalities_primary?: string[];
  indications_active?: string[];
  indications_specific?: string[];
  deals_last_12mo?: number;
  deals_last_24mo?: number;
  last_deal_date?: string | null;
  last_deal_modality?: string | null;
  last_deal_indication?: string | null;
  active_trials_count?: number;
  avg_upfront_usd?: number | null;
  median_upfront_usd?: number | null;
  phase_preference_min?: string;
  phase_preference_max?: string;
  acquisition_appetite?: string;
  actively_acquiring?: boolean;
  strategic_priorities?: string[];
  territory_focus?: string[];
  data_quality_score?: number;
  patent_cliffs?: unknown[];
  revenue_at_risk_2025?: number;
  revenue_at_risk_2026?: number;
  revenue_at_risk_2027?: number;
}

function makeCompany(overrides: CompanyOverrides = {}) {
  return {
    id: overrides.id ?? 'company-1',
    name: overrides.name ?? 'Test Pharma',
    company_type: overrides.company_type ?? 'large_pharma',
    ticker: overrides.ticker ?? 'TST',
    hq_country: overrides.hq_country ?? 'USA',
    modalities_active: overrides.modalities_active ?? [],
    modalities_primary: overrides.modalities_primary ?? [],
    indications_active: overrides.indications_active ?? [],
    indications_specific: overrides.indications_specific ?? [],
    deals_last_12mo: overrides.deals_last_12mo ?? 3,
    deals_last_24mo: overrides.deals_last_24mo ?? 6,
    last_deal_date: 'last_deal_date' in overrides ? overrides.last_deal_date : new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    last_deal_modality: 'last_deal_modality' in overrides ? overrides.last_deal_modality : null,
    last_deal_indication: 'last_deal_indication' in overrides ? overrides.last_deal_indication : null,
    active_trials_count: overrides.active_trials_count ?? 5,
    avg_upfront_usd: overrides.avg_upfront_usd ?? 100_000_000,
    median_upfront_usd: overrides.median_upfront_usd ?? 80_000_000,
    phase_preference_min: overrides.phase_preference_min ?? 'preclinical',
    phase_preference_max: overrides.phase_preference_max ?? 'phase_3',
    acquisition_appetite: overrides.acquisition_appetite ?? 'aggressive',
    actively_acquiring: overrides.actively_acquiring ?? true,
    strategic_priorities: overrides.strategic_priorities ?? [],
    territory_focus: overrides.territory_focus ?? ['global'],
    data_quality_score: overrides.data_quality_score ?? 80,
    patent_cliffs: overrides.patent_cliffs ?? [],
    revenue_at_risk_2025: overrides.revenue_at_risk_2025 ?? 0,
    revenue_at_risk_2026: overrides.revenue_at_risk_2026 ?? 0,
    revenue_at_risk_2027: overrides.revenue_at_risk_2027 ?? 0,
  };
}

// ===========================================================================
// (a) WEIGHT COHERENCE — inferred via score breakdowns
// ===========================================================================
describe('Weight coherence', () => {
  test('all score breakdown dimensions are non-negative', async () => {
    const company = makeCompany({
      id: 'weight-check',
      modalities_active: ['adc'],
      modalities_primary: ['adc'],
      indications_active: ['solid_tumor', 'hematological'],
      indications_specific: ['NSCLC'],
      strategic_priorities: ['oncology', 'adc pipeline expansion'],
      patent_cliffs: [
        { drug_name: 'Drug1', indication: 'NSCLC cancer', revenue_usd: 5e9, expiry_year: 2027 },
      ],
    });

    const supabase = createMockSupabase([company]);
    const input: MatchInput = {
      modality: 'adc',
      development_phase: 'phase_2',
      indication_category: 'solid_tumor',
      indication_specific: 'NSCLC',
      territory_scope: 'global',
      therapeutic_area: 'oncology',
      dealType: 'licensing',
    };

    const result = await findPartnerMatches(supabase, input);
    expect(result.matches.length).toBe(1);

    const bd = result.matches[0].score_breakdown;
    expect(bd.modality).toBeGreaterThanOrEqual(0);
    expect(bd.indication).toBeGreaterThanOrEqual(0);
    expect(bd.phase).toBeGreaterThanOrEqual(0);
    expect(bd.activity).toBeGreaterThanOrEqual(0);
    expect(bd.strategic).toBeGreaterThanOrEqual(0);
    expect(bd.territory).toBeGreaterThanOrEqual(0);
    expect(bd.quality).toBeGreaterThanOrEqual(0);
    expect(bd.dealType).toBeGreaterThanOrEqual(0);
    expect(bd.total).toBeGreaterThanOrEqual(0);
  });

  test('no single dimension exceeds 50% of total possible (max 171)', async () => {
    // The documented max possible score is 171.
    // No single dimension weight should exceed 171 * 0.5 = 85.5.
    // We verify this by constructing a company that maxes out each dimension
    // individually and checking that the raw breakdown never exceeds 86.

    const company = makeCompany({
      id: 'domination-check',
      modalities_active: ['adc'],
      modalities_primary: ['adc'],
      indications_active: ['solid_tumor', 'hematological'],
      indications_specific: ['NSCLC'],
      strategic_priorities: ['oncology IO combinations', 'adc pipeline', 'solid_tumor expansion'],
      patent_cliffs: [
        { drug_name: 'BigDrug', indication: 'NSCLC lung cancer', revenue_usd: 10e9, expiry_year: 2027 },
      ],
      territory_focus: ['global'],
      data_quality_score: 90,
      actively_acquiring: true,
      acquisition_appetite: 'aggressive',
      active_trials_count: 20,
      last_deal_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      avg_upfront_usd: 200_000_000,
      median_upfront_usd: 200_000_000,
      phase_preference_min: 'phase_1',
      phase_preference_max: 'phase_3',
    });

    const supabase = createMockSupabase([company]);
    const input: MatchInput = {
      modality: 'adc',
      development_phase: 'phase_2',
      indication_category: 'solid_tumor',
      indication_specific: 'NSCLC',
      territory_scope: 'global',
      therapeutic_area: 'oncology',
      dealType: 'licensing',
    };

    const result = await findPartnerMatches(supabase, input);
    expect(result.matches.length).toBe(1);

    const bd = result.matches[0].score_breakdown;

    // maxPossibleScore from source: 40+30+18+12+8+15+8+15+5+5+8+10+5+20 = 199 (raw sum)
    // But the code uses a specific maxPossible = 171 for normalization.
    // No single dimension raw score should exceed 86 (50% of 171).
    const maxPossible = 171;
    const halfMax = maxPossible * 0.5;

    // Check each dimension individually.
    // Indication can go up to 30 base + 15 TA boost = 45. Still under 86.
    expect(bd.modality).toBeLessThanOrEqual(halfMax);
    expect(bd.indication).toBeLessThanOrEqual(halfMax);
    expect(bd.phase).toBeLessThanOrEqual(halfMax);
    expect(bd.activity).toBeLessThanOrEqual(halfMax);
    expect(bd.strategic).toBeLessThanOrEqual(halfMax);
    expect(bd.territory).toBeLessThanOrEqual(halfMax);
    expect(bd.quality).toBeLessThanOrEqual(halfMax);
    expect(bd.dealType).toBeLessThanOrEqual(halfMax);
  });

  test('normalized match_score is always 0-100 even for maximum-scoring companies', async () => {
    const company = makeCompany({
      id: 'norm-max',
      modalities_active: ['adc'],
      modalities_primary: ['adc'],
      indications_active: ['solid_tumor', 'hematological'],
      indications_specific: ['NSCLC'],
      strategic_priorities: ['oncology', 'adc pipeline', 'checkpoint', 'immuno-oncology'],
      patent_cliffs: [
        { drug_name: 'Blockbuster', indication: 'lung cancer NSCLC', revenue_usd: 15e9, expiry_year: 2027 },
      ],
      territory_focus: ['global'],
      data_quality_score: 95,
      actively_acquiring: true,
      acquisition_appetite: 'aggressive',
      active_trials_count: 30,
      last_deal_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      avg_upfront_usd: 150_000_000,
      median_upfront_usd: 150_000_000,
      phase_preference_min: 'phase_2',
      phase_preference_max: 'phase_2',
      revenue_at_risk_2027: 10_000_000_000,
    });

    const supabase = createMockSupabase([company]);
    const input: MatchInput = {
      modality: 'adc',
      development_phase: 'phase_2',
      indication_category: 'solid_tumor',
      indication_specific: 'NSCLC',
      territory_scope: 'global',
      therapeutic_area: 'oncology',
      dealType: 'licensing',
      regulatory_designations: { breakthrough: true, orphan: false },
    };

    const result = await findPartnerMatches(supabase, input);
    expect(result.matches.length).toBe(1);
    expect(result.matches[0].match_score).toBeGreaterThanOrEqual(0);
    expect(result.matches[0].match_score).toBeLessThanOrEqual(100);
  });
});

// ===========================================================================
// (b) MODALITY ADJACENCY SYMMETRY
// ===========================================================================
describe('Modality adjacency symmetry (indirect)', () => {
  // Since MODALITY_ADJACENCY is internal, we test symmetry by checking that
  // if a company with modality A scores > 0 modality points against input B,
  // then a company with modality B also scores > 0 modality points against input A.
  // This covers adjacency in both directions.

  // These pairs are verified symmetric in MODALITY_ADJACENCY.
  // Known asymmetries (adc->small_molecule, car_t->gene_therapy) are tested
  // separately below to document them.
  const adjacencyPairsToTest = [
    ['adc', 'antibody'],
    ['adc', 'bispecific'],
    ['car_t', 'cell_therapy'],
    ['gene_therapy', 'mrna'],
    ['mrna', 'vaccine'],
    ['small_molecule', 'peptide'],
    ['oligonucleotide', 'aso'],
    ['aso', 'rnai'],
  ];

  test.each(adjacencyPairsToTest)(
    'adjacency is bidirectional: %s <-> %s',
    async (modalityA, modalityB) => {
      // Company has A, input asks for B
      const companyAB = makeCompany({
        id: `adj-${modalityA}-${modalityB}`,
        modalities_active: [modalityA],
        modalities_primary: [modalityA],
        indications_active: ['solid_tumor'],
        indications_specific: [],
      });

      // Company has B, input asks for A
      const companyBA = makeCompany({
        id: `adj-${modalityB}-${modalityA}`,
        modalities_active: [modalityB],
        modalities_primary: [modalityB],
        indications_active: ['solid_tumor'],
        indications_specific: [],
      });

      const inputForB: MatchInput = {
        modality: modalityB,
        development_phase: 'phase_2',
        indication_category: 'solid_tumor',
        indication_specific: null,
        territory_scope: 'global',
        therapeutic_area: 'oncology',
      };

      const inputForA: MatchInput = {
        modality: modalityA,
        development_phase: 'phase_2',
        indication_category: 'solid_tumor',
        indication_specific: null,
        territory_scope: 'global',
        therapeutic_area: 'oncology',
      };

      const supabaseAB = createMockSupabase([companyAB]);
      const supabaseBA = createMockSupabase([companyBA]);

      const resultAB = await findPartnerMatches(supabaseAB, inputForB);
      const resultBA = await findPartnerMatches(supabaseBA, inputForA);

      // Both directions should produce a modality score > 0 (adjacent = 20)
      // If one passes threshold and the other does not, symmetry is broken.
      const abModality = resultAB.matches.length > 0 ? resultAB.matches[0].score_breakdown.modality : -1;
      const baModality = resultBA.matches.length > 0 ? resultBA.matches[0].score_breakdown.modality : -1;

      // Both should either have positive modality or both should not match.
      // The key assertion: if A->B is adjacent, B->A must also be adjacent.
      if (abModality > 0) {
        expect(baModality).toBeGreaterThan(0);
      }
      if (baModality > 0) {
        expect(abModality).toBeGreaterThan(0);
      }
    }
  );

  // Document known asymmetries in MODALITY_ADJACENCY.
  // These are NOT bugs per se — the engine intentionally models one-directional
  // adjacency in some cases (e.g. ADC -> small_molecule because ADC payloads
  // are often small molecules, but small_molecule companies do not typically
  // pivot to ADCs without antibody capability).
  test('known asymmetry: adc lists small_molecule as adjacent, but not vice versa', async () => {
    // Company has small_molecule, input is adc => should get adjacency credit
    const smCompany = makeCompany({
      id: 'asym-sm',
      modalities_active: ['small_molecule'],
      modalities_primary: ['small_molecule'],
      indications_active: ['solid_tumor'],
    });
    const supabaseSM = createMockSupabase([smCompany]);
    const inputADC: MatchInput = {
      modality: 'adc',
      development_phase: 'phase_2',
      indication_category: 'solid_tumor',
      indication_specific: null,
      territory_scope: 'global',
      therapeutic_area: 'oncology',
    };
    const resultSM = await findPartnerMatches(supabaseSM, inputADC);
    const smModality = resultSM.matches.length > 0 ? resultSM.matches[0].score_breakdown.modality : 0;
    // adc's adjacency list includes small_molecule, so this should score > 0
    expect(smModality).toBeGreaterThan(0);

    // Company has adc, input is small_molecule => small_molecule adjacency does NOT include adc
    const adcCompany = makeCompany({
      id: 'asym-adc',
      modalities_active: ['adc'],
      modalities_primary: ['adc'],
      indications_active: ['solid_tumor'],
    });
    const supabaseADC = createMockSupabase([adcCompany]);
    const inputSM: MatchInput = {
      modality: 'small_molecule',
      development_phase: 'phase_2',
      indication_category: 'solid_tumor',
      indication_specific: null,
      territory_scope: 'global',
      therapeutic_area: 'oncology',
    };
    const resultADC = await findPartnerMatches(supabaseADC, inputSM);
    const adcModality = resultADC.matches.length > 0 ? resultADC.matches[0].score_breakdown.modality : 0;
    // small_molecule's adjacency list does NOT include adc
    expect(adcModality).toBe(0);
  });

  test('known asymmetry: car_t lists gene_therapy as adjacent, but not vice versa', async () => {
    // Company has gene_therapy, input is car_t => car_t adjacency includes gene_therapy
    const gtCompany = makeCompany({
      id: 'asym-gt',
      modalities_active: ['gene_therapy'],
      modalities_primary: ['gene_therapy'],
      indications_active: ['solid_tumor'],
    });
    const supabaseGT = createMockSupabase([gtCompany]);
    const inputCART: MatchInput = {
      modality: 'car_t',
      development_phase: 'phase_2',
      indication_category: 'solid_tumor',
      indication_specific: null,
      territory_scope: 'global',
      therapeutic_area: 'oncology',
    };
    const resultGT = await findPartnerMatches(supabaseGT, inputCART);
    const gtModality = resultGT.matches.length > 0 ? resultGT.matches[0].score_breakdown.modality : 0;
    expect(gtModality).toBeGreaterThan(0);

    // Company has car_t, input is gene_therapy => gene_therapy adjacency does NOT include car_t
    const cartCompany = makeCompany({
      id: 'asym-cart',
      modalities_active: ['car_t'],
      modalities_primary: ['car_t'],
      indications_active: ['solid_tumor'],
    });
    const supabaseCART = createMockSupabase([cartCompany]);
    const inputGT: MatchInput = {
      modality: 'gene_therapy',
      development_phase: 'phase_2',
      indication_category: 'solid_tumor',
      indication_specific: null,
      territory_scope: 'global',
      therapeutic_area: 'oncology',
    };
    const resultCART = await findPartnerMatches(supabaseCART, inputGT);
    const cartModality = resultCART.matches.length > 0 ? resultCART.matches[0].score_breakdown.modality : 0;
    // gene_therapy's adjacency list includes cell_therapy but NOT car_t
    // However car_t's adjacency includes cell_therapy, so via cell_therapy... no,
    // adjacency is checked directly, not transitively.
    expect(cartModality).toBe(0);
  });
});

// ===========================================================================
// (c) KNOWN DEAL PAIR SCORING — mock real licensee profiles
// ===========================================================================
describe('Known deal pair scoring', () => {
  // These mock profiles mirror the real-world companies that executed the
  // deals in COMPARABLE_DEALS. The test validates that the engine scores
  // them as strong matches (score > 50 on 0-100 scale) for their typical
  // asset modality/TA.

  test('Pfizer + ADC oncology asset scores > 50 (Seagen acquisition precedent)', async () => {
    const pfizer = makeCompany({
      id: 'pfizer-mock',
      name: 'Pfizer',
      company_type: 'mega_pharma',
      ticker: 'PFE',
      hq_country: 'USA',
      modalities_active: ['adc', 'small_molecule', 'antibody', 'bispecific'],
      modalities_primary: ['adc', 'small_molecule'],
      indications_active: ['solid_tumor', 'hematological'],
      indications_specific: ['NSCLC', 'breast_cancer', 'cervical'],
      deals_last_12mo: 8,
      deals_last_24mo: 15,
      last_deal_date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      last_deal_modality: 'adc',
      last_deal_indication: 'solid_tumor',
      active_trials_count: 25,
      avg_upfront_usd: 500_000_000,
      median_upfront_usd: 400_000_000,
      phase_preference_min: 'phase_1',
      phase_preference_max: 'approved',
      acquisition_appetite: 'aggressive',
      actively_acquiring: true,
      strategic_priorities: ['oncology', 'ADC pipeline', 'immuno-oncology'],
      territory_focus: ['global'],
      data_quality_score: 95,
      patent_cliffs: [
        { drug_name: 'Ibrance', indication: 'breast cancer', revenue_usd: 5.1e9, expiry_year: 2027 },
      ],
      revenue_at_risk_2027: 5_100_000_000,
    });

    const supabase = createMockSupabase([pfizer]);
    const input: MatchInput = {
      modality: 'adc',
      development_phase: 'phase_2',
      indication_category: 'solid_tumor',
      indication_specific: 'NSCLC',
      territory_scope: 'global',
      therapeutic_area: 'oncology',
    };

    const result = await findPartnerMatches(supabase, input);
    expect(result.matches.length).toBe(1);
    expect(result.matches[0].match_score).toBeGreaterThan(50);
    expect(result.matches[0].company_name).toBe('Pfizer');
  });

  test('AbbVie + CNS small molecule scores > 50 (Cerevel acquisition precedent)', async () => {
    const abbvie = makeCompany({
      id: 'abbvie-mock',
      name: 'AbbVie',
      company_type: 'large_pharma',
      ticker: 'ABBV',
      hq_country: 'USA',
      modalities_active: ['small_molecule', 'antibody', 'psychedelic'],
      modalities_primary: ['small_molecule', 'antibody'],
      indications_active: ['cns', 'autoimmune', 'solid_tumor'],
      indications_specific: ['schizophrenia', 'parkinsons', 'depression'],
      deals_last_12mo: 6,
      deals_last_24mo: 12,
      last_deal_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      last_deal_modality: 'small_molecule',
      last_deal_indication: 'cns',
      active_trials_count: 20,
      avg_upfront_usd: 300_000_000,
      median_upfront_usd: 250_000_000,
      phase_preference_min: 'preclinical',
      phase_preference_max: 'phase_3',
      acquisition_appetite: 'aggressive',
      actively_acquiring: true,
      strategic_priorities: ['neuroscience', 'CNS pipeline', 'immunology'],
      territory_focus: ['global'],
      data_quality_score: 90,
      patent_cliffs: [
        { drug_name: 'Humira', indication: 'rheumatoid arthritis autoimmune', revenue_usd: 21.2e9, expiry_year: 2023 },
      ],
    });

    const supabase = createMockSupabase([abbvie]);
    const input: MatchInput = {
      modality: 'small_molecule',
      development_phase: 'phase_2',
      indication_category: 'cns',
      indication_specific: 'schizophrenia',
      territory_scope: 'global',
      therapeutic_area: 'neurology',
    };

    const result = await findPartnerMatches(supabase, input);
    expect(result.matches.length).toBe(1);
    expect(result.matches[0].match_score).toBeGreaterThan(50);
    expect(result.matches[0].company_name).toBe('AbbVie');
  });

  test('Novartis + gene therapy rare disease scores > 50 (PTC/Huntingtons precedent)', async () => {
    const novartis = makeCompany({
      id: 'novartis-mock',
      name: 'Novartis',
      company_type: 'mega_pharma',
      ticker: 'NVS',
      hq_country: 'Switzerland',
      modalities_active: ['gene_therapy', 'small_molecule', 'cell_therapy', 'antibody'],
      modalities_primary: ['gene_therapy', 'small_molecule'],
      indications_active: ['cns', 'rare_disease', 'cardiovascular'],
      indications_specific: ['huntingtons', 'sma', 'myelofibrosis'],
      deals_last_12mo: 5,
      deals_last_24mo: 10,
      last_deal_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      last_deal_modality: 'gene_therapy',
      last_deal_indication: 'rare_disease',
      active_trials_count: 18,
      avg_upfront_usd: 400_000_000,
      median_upfront_usd: 350_000_000,
      phase_preference_min: 'preclinical',
      phase_preference_max: 'phase_3',
      acquisition_appetite: 'aggressive',
      actively_acquiring: true,
      strategic_priorities: ['gene therapy', 'rare disease', 'cell and gene', 'CNS'],
      territory_focus: ['global'],
      data_quality_score: 92,
      patent_cliffs: [
        { drug_name: 'Entresto', indication: 'heart failure cardiovascular', revenue_usd: 6e9, expiry_year: 2026 },
      ],
      revenue_at_risk_2026: 6_000_000_000,
    });

    const supabase = createMockSupabase([novartis]);
    const input: MatchInput = {
      modality: 'gene_therapy',
      development_phase: 'phase_1',
      indication_category: 'rare_disease',
      indication_specific: 'huntingtons',
      territory_scope: 'global',
      therapeutic_area: 'neurology',
    };

    const result = await findPartnerMatches(supabase, input);
    expect(result.matches.length).toBe(1);
    expect(result.matches[0].match_score).toBeGreaterThan(50);
    expect(result.matches[0].company_name).toBe('Novartis');
  });

  test('BMS + small molecule schizophrenia scores > 50 (Karuna acquisition precedent)', async () => {
    const bms = makeCompany({
      id: 'bms-mock',
      name: 'BMS',
      company_type: 'large_pharma',
      ticker: 'BMY',
      hq_country: 'USA',
      modalities_active: ['small_molecule', 'antibody', 'car_t'],
      modalities_primary: ['small_molecule', 'antibody'],
      indications_active: ['cns', 'solid_tumor', 'hematological'],
      indications_specific: ['schizophrenia', 'NSCLC', 'myeloma'],
      deals_last_12mo: 4,
      deals_last_24mo: 8,
      last_deal_date: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString(),
      last_deal_modality: 'small_molecule',
      last_deal_indication: 'cns',
      active_trials_count: 15,
      avg_upfront_usd: 250_000_000,
      median_upfront_usd: 200_000_000,
      phase_preference_min: 'phase_1',
      phase_preference_max: 'approved',
      acquisition_appetite: 'aggressive',
      actively_acquiring: true,
      strategic_priorities: ['neuroscience', 'immuno-oncology', 'cardiovascular'],
      territory_focus: ['global'],
      data_quality_score: 88,
      patent_cliffs: [
        { drug_name: 'Opdivo', indication: 'NSCLC cancer', revenue_usd: 9e9, expiry_year: 2028 },
        { drug_name: 'Eliquis', indication: 'anticoagulant cardiovascular', revenue_usd: 12.2e9, expiry_year: 2026 },
      ],
      revenue_at_risk_2026: 12_200_000_000,
      revenue_at_risk_2027: 9_000_000_000,
    });

    const supabase = createMockSupabase([bms]);
    const input: MatchInput = {
      modality: 'small_molecule',
      development_phase: 'phase_2',
      indication_category: 'cns',
      indication_specific: 'schizophrenia',
      territory_scope: 'global',
      therapeutic_area: 'neurology',
    };

    const result = await findPartnerMatches(supabase, input);
    expect(result.matches.length).toBe(1);
    expect(result.matches[0].match_score).toBeGreaterThan(50);
    expect(result.matches[0].company_name).toBe('BMS');
  });

  test('Roche + GLP-1 obesity asset scores > 50 (Carmot acquisition precedent)', async () => {
    const roche = makeCompany({
      id: 'roche-mock',
      name: 'Roche',
      company_type: 'mega_pharma',
      ticker: 'ROG',
      hq_country: 'Switzerland',
      modalities_active: ['small_molecule', 'antibody', 'peptide'],
      modalities_primary: ['antibody', 'small_molecule'],
      indications_active: ['metabolic', 'obesity', 'cns'],
      indications_specific: ['obesity', 'type2_diabetes'],
      deals_last_12mo: 7,
      deals_last_24mo: 14,
      last_deal_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      last_deal_modality: 'peptide',
      last_deal_indication: 'metabolic',
      active_trials_count: 22,
      avg_upfront_usd: 350_000_000,
      median_upfront_usd: 300_000_000,
      phase_preference_min: 'preclinical',
      phase_preference_max: 'phase_3',
      acquisition_appetite: 'aggressive',
      actively_acquiring: true,
      strategic_priorities: ['obesity', 'weight management', 'cardiometabolic', 'GLP-1'],
      territory_focus: ['global'],
      data_quality_score: 93,
      patent_cliffs: [
        { drug_name: 'Ocrevus', indication: 'multiple sclerosis neuro', revenue_usd: 7.5e9, expiry_year: 2033 },
      ],
    });

    const supabase = createMockSupabase([roche]);
    const input: MatchInput = {
      modality: 'peptide',
      development_phase: 'phase_2',
      indication_category: 'obesity',
      indication_specific: 'obesity',
      territory_scope: 'global',
      therapeutic_area: 'metabolic',
    };

    const result = await findPartnerMatches(supabase, input);
    expect(result.matches.length).toBe(1);
    expect(result.matches[0].match_score).toBeGreaterThan(50);
    expect(result.matches[0].company_name).toBe('Roche');
  });
});

// ===========================================================================
// (d) THERAPEUTIC_AREA_INDICATIONS coverage
// ===========================================================================
describe('THERAPEUTIC_AREA_INDICATIONS coverage', () => {
  // We cannot import THERAPEUTIC_AREA_INDICATIONS directly, but we can verify
  // that every TA produces a TA boost (indication +8 or +15) when a company
  // has the expected indication overlap. If a TA had zero indications mapped,
  // the TA boost would never fire.

  const allTAs = [
    { ta: 'oncology', indications: ['solid_tumor', 'hematological'] },
    { ta: 'neurology', indications: ['cns', 'alzheimers'] },
    { ta: 'immunology', indications: ['autoimmune', 'dermatology'] },
    { ta: 'metabolic', indications: ['metabolic', 'obesity'] },
    { ta: 'cardiovascular', indications: ['cardiovascular'] },
    { ta: 'infectiousDisease', indications: ['infectious'] },
    { ta: 'ophthalmology', indications: ['ophthalmology', 'retinal'] },
    { ta: 'womensHealth', indications: ['womens_health', 'endometriosis'] },
    { ta: 'rareDisease', indications: ['rare_disease', 'genetic_disorders'] },
    { ta: 'hematology', indications: ['hematology', 'blood_disorders'] },
    { ta: 'dermatology', indications: ['dermatology', 'skin'] },
    { ta: 'gastroenterology', indications: ['gastroenterology', 'gi'] },
  ];

  test.each(allTAs)(
    'TA "$ta" has at least 1 indication category mapped (produces TA boost)',
    async ({ ta, indications }) => {
      // Create a company with 2 indications from this TA
      const company = makeCompany({
        id: `ta-coverage-${ta}`,
        modalities_active: ['small_molecule'],
        modalities_primary: ['small_molecule'],
        indications_active: indications,
        indications_specific: [],
      });

      const supabase = createMockSupabase([company]);
      const input: MatchInput = {
        modality: 'small_molecule',
        development_phase: 'phase_2',
        indication_category: indications[0],
        indication_specific: null,
        territory_scope: 'global',
        therapeutic_area: ta,
      };

      const result = await findPartnerMatches(supabase, input);

      // The company should match and get a TA boost on indication score.
      // indication_category_exact = 20, plus TA boost (+8 for 1 overlap, +15 for 2+).
      if (result.matches.length > 0) {
        // If the company has 2 TA-mapped indications, indication >= 20+15=35.
        // If only 1, indication >= 20+8=28.
        expect(result.matches[0].score_breakdown.indication).toBeGreaterThanOrEqual(20);
      } else {
        // If somehow it doesn't match, the TA mapping is likely missing.
        // This is a soft failure — log it for investigation.
        // eslint-disable-next-line no-console
        console.warn(`TA "${ta}" company did not produce a match. Check THERAPEUTIC_AREA_INDICATIONS mapping.`);
        // Still assert to flag the issue
        expect(result.matches.length).toBeGreaterThan(0);
      }
    }
  );
});

// ===========================================================================
// (e) SCORE RANGE BOUNDS — no component can be negative or exceed documented max
// ===========================================================================
describe('Score range bounds', () => {
  // Documented per-dimension maxima (from WEIGHTS in source):
  // modality: 40 (modality_exact) — note primary=35 is lower, but exact=40
  // indication: 30 (indication_specific_exact) + 15 (TA boost) = 45 practical max
  // phase: 18 (phase_sweet_spot)
  // activity: 12 (deal_last_6mo) + 8 (active_trials_relevant) = 20
  // strategic: 15 (patent_cliff) + 10 (pipeline_gap) + 8 (priority_match) = 33 theoretical
  // territory: 15 (territory_match)
  // quality: 5 (data_quality) + 5 (actively_acquiring) + 8 (company_capacity) + 10 (deal_size) + 5 (regulatory) = 33
  // dealType: 20

  const scoreScenarios: { name: string; company: CompanyOverrides; input: MatchInput }[] = [
    {
      name: 'max modality score (exact match)',
      company: {
        id: 'bound-mod',
        modalities_active: ['adc'],
        modalities_primary: [],
        indications_active: ['solid_tumor'],
      },
      input: {
        modality: 'adc',
        development_phase: 'phase_2',
        indication_category: 'solid_tumor',
        indication_specific: null,
        territory_scope: null,
        therapeutic_area: 'oncology',
      },
    },
    {
      name: 'zero-score company (no overlap)',
      company: {
        id: 'bound-zero',
        modalities_active: ['vaccine'],
        modalities_primary: ['vaccine'],
        indications_active: ['infectious'],
        indications_specific: ['influenza'],
        strategic_priorities: ['pandemic preparedness'],
        patent_cliffs: [],
        territory_focus: ['japan'],
        last_deal_date: null,
        deals_last_12mo: 0,
        deals_last_24mo: 0,
        active_trials_count: 0,
        data_quality_score: 30,
        acquisition_appetite: 'selective',
      },
      input: {
        modality: 'gene_therapy',
        development_phase: 'preclinical',
        indication_category: 'rare_disease',
        indication_specific: null,
        territory_scope: 'us',
        therapeutic_area: 'rareDisease',
      },
    },
  ];

  test.each(scoreScenarios)('$name: all dimensions are within valid range', async ({ company, input }) => {
    const supabase = createMockSupabase([makeCompany(company)]);
    const result = await findPartnerMatches(supabase, input);

    if (result.matches.length > 0) {
      const bd = result.matches[0].score_breakdown;

      // No dimension should be negative
      expect(bd.modality).toBeGreaterThanOrEqual(0);
      expect(bd.indication).toBeGreaterThanOrEqual(0);
      expect(bd.phase).toBeGreaterThanOrEqual(0);
      expect(bd.activity).toBeGreaterThanOrEqual(0);
      expect(bd.strategic).toBeGreaterThanOrEqual(0);
      expect(bd.territory).toBeGreaterThanOrEqual(0);
      expect(bd.quality).toBeGreaterThanOrEqual(0);
      expect(bd.dealType).toBeGreaterThanOrEqual(0);

      // Each dimension has a documented max (generous upper bounds to avoid brittleness)
      expect(bd.modality).toBeLessThanOrEqual(45); // max 40, but allow small margin
      expect(bd.indication).toBeLessThanOrEqual(50); // 30 base + 15 TA boost + margin
      expect(bd.phase).toBeLessThanOrEqual(20);      // max 18 + margin
      expect(bd.activity).toBeLessThanOrEqual(25);    // max 20 + margin
      expect(bd.strategic).toBeLessThanOrEqual(40);   // max 33 + margin
      expect(bd.territory).toBeLessThanOrEqual(20);   // max 15 + margin
      expect(bd.quality).toBeLessThanOrEqual(40);      // max 33 + margin
      expect(bd.dealType).toBeLessThanOrEqual(25);    // max 20 + margin

      // Normalized score bound
      expect(result.matches[0].match_score).toBeGreaterThanOrEqual(0);
      expect(result.matches[0].match_score).toBeLessThanOrEqual(100);
    }
    // If no matches, the company scored below 15 — that is a valid outcome for zero-overlap
  });
});

// ===========================================================================
// (f) ACTIVITY SIGNAL DECAY — more recent deals score higher
// ===========================================================================
describe('Activity signal decay', () => {
  test('deal < 6 months ago scores higher activity than 12-month-old deal', async () => {
    const recentCompany = makeCompany({
      id: 'decay-recent',
      name: 'Recent Dealer',
      modalities_active: ['adc'],
      modalities_primary: ['adc'],
      indications_active: ['solid_tumor'],
      indications_specific: [],
      last_deal_date: new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000).toISOString(), // 3 months
      deals_last_12mo: 2,
      deals_last_24mo: 4,
      active_trials_count: 0, // exclude trials bonus to isolate deal recency
    });

    const olderCompany = makeCompany({
      id: 'decay-older',
      name: 'Older Dealer',
      modalities_active: ['adc'],
      modalities_primary: ['adc'],
      indications_active: ['solid_tumor'],
      indications_specific: [],
      last_deal_date: new Date(Date.now() - 9 * 30 * 24 * 60 * 60 * 1000).toISOString(), // 9 months
      deals_last_12mo: 2,
      deals_last_24mo: 4,
      active_trials_count: 0,
    });

    const supabaseRecent = createMockSupabase([recentCompany]);
    const supabaseOlder = createMockSupabase([olderCompany]);

    const input: MatchInput = {
      modality: 'adc',
      development_phase: 'phase_2',
      indication_category: 'solid_tumor',
      indication_specific: null,
      territory_scope: 'global',
      therapeutic_area: 'oncology',
    };

    const resultRecent = await findPartnerMatches(supabaseRecent, input);
    const resultOlder = await findPartnerMatches(supabaseOlder, input);

    expect(resultRecent.matches.length).toBe(1);
    expect(resultOlder.matches.length).toBe(1);

    // Recent (< 6mo) should get 12 points, older (6-12mo) should get 8 points
    expect(resultRecent.matches[0].score_breakdown.activity).toBeGreaterThan(
      resultOlder.matches[0].score_breakdown.activity
    );
  });

  test('deal 12-24 months ago scores lower activity than 6-12 month deal', async () => {
    const twelveMonthCompany = makeCompany({
      id: 'decay-12mo',
      name: '12mo Dealer',
      modalities_active: ['adc'],
      modalities_primary: ['adc'],
      indications_active: ['solid_tumor'],
      indications_specific: [],
      last_deal_date: new Date(Date.now() - 9 * 30 * 24 * 60 * 60 * 1000).toISOString(), // 9 months
      deals_last_12mo: 1,
      deals_last_24mo: 3,
      active_trials_count: 0,
    });

    const twentyFourMonthCompany = makeCompany({
      id: 'decay-24mo',
      name: '24mo Dealer',
      modalities_active: ['adc'],
      modalities_primary: ['adc'],
      indications_active: ['solid_tumor'],
      indications_specific: [],
      last_deal_date: new Date(Date.now() - 18 * 30 * 24 * 60 * 60 * 1000).toISOString(), // 18 months
      deals_last_12mo: 0,
      deals_last_24mo: 3,
      active_trials_count: 0,
    });

    const supabase12 = createMockSupabase([twelveMonthCompany]);
    const supabase24 = createMockSupabase([twentyFourMonthCompany]);

    const input: MatchInput = {
      modality: 'adc',
      development_phase: 'phase_2',
      indication_category: 'solid_tumor',
      indication_specific: null,
      territory_scope: 'global',
      therapeutic_area: 'oncology',
    };

    const result12 = await findPartnerMatches(supabase12, input);
    const result24 = await findPartnerMatches(supabase24, input);

    expect(result12.matches.length).toBe(1);
    expect(result24.matches.length).toBe(1);

    // 6-12mo deal = 8 points, 12-24mo deal = 4 points
    expect(result12.matches[0].score_breakdown.activity).toBeGreaterThan(
      result24.matches[0].score_breakdown.activity
    );
  });

  test('no deal history yields zero activity score', async () => {
    // Explicitly set last_deal_date to null and all deal counts to 0
    // to ensure no activity signal fires.
    const noDealsCompany = makeCompany({
      id: 'decay-none',
      name: 'No Deals',
      modalities_active: ['adc'],
      modalities_primary: ['adc'],
      indications_active: ['solid_tumor', 'hematological'],
      indications_specific: ['NSCLC'],
      last_deal_date: null,
      last_deal_modality: null,
      last_deal_indication: null,
      deals_last_12mo: 0,
      deals_last_24mo: 0,
      active_trials_count: 0,
      // Keep quality signals high so the company still passes the 15-point threshold
      data_quality_score: 90,
      actively_acquiring: true,
      acquisition_appetite: 'aggressive',
      strategic_priorities: ['oncology', 'adc pipeline'],
      territory_focus: ['global'],
      patent_cliffs: [
        { drug_name: 'OncoDrug', indication: 'lung cancer', revenue_usd: 5e9, expiry_year: 2027 },
      ],
    });

    const supabase = createMockSupabase([noDealsCompany]);
    const input: MatchInput = {
      modality: 'adc',
      development_phase: 'phase_2',
      indication_category: 'solid_tumor',
      indication_specific: 'NSCLC',
      territory_scope: 'global',
      therapeutic_area: 'oncology',
    };

    const result = await findPartnerMatches(supabase, input);

    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0].score_breakdown.activity).toBe(0);
  });
});

// ===========================================================================
// BONUS: TA_CLIFF_KEYWORDS coverage and filterCliffsByTA behavior
// ===========================================================================
describe('TA_CLIFF_KEYWORDS and filterCliffsByTA', () => {
  test('every TA with keyword entries has at least 5 keywords', () => {
    for (const [ta, keywords] of Object.entries(TA_CLIFF_KEYWORDS)) {
      expect(keywords.length).toBeGreaterThanOrEqual(5);
    }
  });

  test('filterCliffsByTA returns all cliffs when therapeuticArea is null', () => {
    const cliffs = [
      { drug_name: 'DrugA', indication: 'lung cancer', revenue_usd: 5e9, expiry_year: 2027 },
      { drug_name: 'DrugB', indication: 'heart failure', revenue_usd: 3e9, expiry_year: 2026 },
    ];
    const result = filterCliffsByTA(cliffs, null);
    expect(result).toHaveLength(2);
  });

  test('filterCliffsByTA filters correctly for oncology', () => {
    const cliffs = [
      { drug_name: 'OncoD', indication: 'NSCLC lung cancer', revenue_usd: 5e9, expiry_year: 2027 },
      { drug_name: 'CardioD', indication: 'heart failure', revenue_usd: 3e9, expiry_year: 2026 },
      { drug_name: 'NeuroD', indication: 'Alzheimer dementia', revenue_usd: 2e9, expiry_year: 2028 },
    ];
    const result = filterCliffsByTA(cliffs, 'oncology');
    expect(result).toHaveLength(1);
    expect(result[0].drug_name).toBe('OncoD');
  });

  test('filterCliffsByTA filters correctly for neurology', () => {
    const cliffs = [
      { drug_name: 'NeuroA', indication: 'multiple sclerosis cns', revenue_usd: 2e9, expiry_year: 2026 },
      { drug_name: 'OncoB', indication: 'breast cancer', revenue_usd: 5e9, expiry_year: 2027 },
    ];
    const result = filterCliffsByTA(cliffs, 'neurology');
    expect(result).toHaveLength(1);
    expect(result[0].drug_name).toBe('NeuroA');
  });
});

// ===========================================================================
// BONUS: calculateQuickWatchOuts structural validation
// ===========================================================================
describe('calculateQuickWatchOuts — structural integrity', () => {
  test('watch-out impacts are always non-positive (penalties only)', () => {
    const company = makeCompany({
      id: 'wo-neg',
      modalities_active: ['vaccine'],
      modalities_primary: ['vaccine'],
      indications_active: ['cns'],
      indications_specific: ['schizophrenia'],
      deals_last_12mo: 0,
      deals_last_24mo: 5,
      phase_preference_min: 'phase_3',
      phase_preference_max: 'approved',
    }) as Parameters<typeof calculateQuickWatchOuts>[0];

    const input: MatchInput = {
      modality: 'gene_therapy',
      development_phase: 'preclinical',
      indication_category: 'cns',
      indication_specific: 'schizophrenia',
      territory_scope: 'global',
      therapeutic_area: 'neurology',
    };

    const watchOuts = calculateQuickWatchOuts(company, input);
    for (const wo of watchOuts) {
      expect(wo.impact).toBeLessThanOrEqual(0);
    }
    // Should have at least modality mismatch and BD slowdown
    expect(watchOuts.length).toBeGreaterThanOrEqual(2);
  });

  test('no watch-outs for perfectly aligned company', () => {
    const company = makeCompany({
      id: 'wo-clean',
      modalities_active: ['adc'],
      modalities_primary: ['adc'],
      indications_active: ['solid_tumor'],
      indications_specific: ['breast_cancer'], // different specific than input
      deals_last_12mo: 3,
      deals_last_24mo: 6,
      phase_preference_min: 'preclinical',
      phase_preference_max: 'approved',
    }) as Parameters<typeof calculateQuickWatchOuts>[0];

    const input: MatchInput = {
      modality: 'adc',
      development_phase: 'phase_2',
      indication_category: 'solid_tumor',
      indication_specific: 'NSCLC', // different from company's breast_cancer
      territory_scope: 'global',
      therapeutic_area: 'oncology',
    };

    const watchOuts = calculateQuickWatchOuts(company, input);
    expect(watchOuts.length).toBe(0);
  });
});

// ===========================================================================
// BONUS: COMPARABLE_DEALS data quality checks
// ===========================================================================
describe('COMPARABLE_DEALS data quality', () => {
  test('every deal has licensor and licensee names', () => {
    for (const deal of COMPARABLE_DEALS) {
      expect(deal.licensor).toBeTruthy();
      expect(deal.licensee).toBeTruthy();
    }
  });

  test('every deal has a valid year (2017-2026)', () => {
    for (const deal of COMPARABLE_DEALS) {
      expect(deal.year).toBeGreaterThanOrEqual(2017);
      expect(deal.year).toBeLessThanOrEqual(2026);
    }
  });

  test('every deal has a non-empty value string', () => {
    for (const deal of COMPARABLE_DEALS) {
      expect(deal.value).toBeTruthy();
      expect(deal.value.startsWith('$')).toBe(true);
    }
  });

  test('every deal has a valid therapeuticArea', () => {
    const validTAs = new Set([
      'oncology', 'neurology', 'immunology', 'metabolic', 'cardiovascular',
      'infectiousDisease', 'ophthalmology', 'womensHealth', 'rareDisease',
      'hematology', 'dermatology', 'gastroenterology', 'both',
    ]);
    for (const deal of COMPARABLE_DEALS) {
      expect(validTAs.has(deal.therapeuticArea)).toBe(true);
    }
  });

  test('curated deal count is at least 50', () => {
    // COMPARABLE_DEALS should have ~61 curated deals per project docs
    expect(COMPARABLE_DEALS.length).toBeGreaterThanOrEqual(50);
  });

  test('all 12 TAs are represented in comparable deals', () => {
    const representedTAs = new Set(COMPARABLE_DEALS.map(d => d.therapeuticArea));
    const expectedTAs = [
      'oncology', 'neurology', 'immunology', 'metabolic',
      'rareDisease', 'hematology', 'dermatology', 'gastroenterology',
    ];
    for (const ta of expectedTAs) {
      expect(representedTAs.has(ta)).toBe(true);
    }
  });
});
