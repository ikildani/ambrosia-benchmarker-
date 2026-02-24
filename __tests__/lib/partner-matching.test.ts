/**
 * Partner Matching Scoring Algorithm Tests
 *
 * Tests findPartnerMatches() from lib/services/partner-matching.ts
 * which scores companies against a user's asset profile and returns ranked matches.
 */

import { findPartnerMatches, MatchInput } from '@/lib/services/partner-matching';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------
function createMockSupabase(resolvedValue: { data: unknown[] | null; error: unknown }) {
  const mock = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(resolvedValue),
  };
  return mock as unknown as SupabaseClient;
}

// ---------------------------------------------------------------------------
// Company fixture factory
// ---------------------------------------------------------------------------
function makeCompany(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    name: 'Pharma Corp',
    company_type: 'large_pharma',
    ticker: 'PH',
    hq_country: 'USA',
    modalities_active: ['adc', 'bispecific'],
    modalities_primary: ['adc'],
    indications_active: ['solid_tumor'],
    indications_specific: ['NSCLC'],
    deals_last_12mo: 5,
    deals_last_24mo: 10,
    last_deal_date: new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000).toISOString(), // 3 months ago
    last_deal_modality: 'adc',
    last_deal_indication: 'solid_tumor',
    active_trials_count: 8,
    avg_upfront_usd: 50_000_000,
    median_upfront_usd: 45_000_000,
    phase_preference_min: 'phase_1',
    phase_preference_max: 'phase_3',
    acquisition_appetite: 'aggressive',
    actively_acquiring: true,
    strategic_priorities: ['oncology', 'adc pipeline'],
    territory_focus: ['global'],
    data_quality_score: 85,
    patent_cliffs: [
      {
        drug_name: 'DrugX',
        indication: 'NSCLC cancer',
        revenue_usd: 5_000_000_000,
        expiry_year: 2027,
      },
    ],
    revenue_at_risk_2025: 0,
    revenue_at_risk_2026: 1_000_000_000,
    revenue_at_risk_2027: 5_000_000_000,
    ...overrides,
  };
}

// Default input that matches the base company well
const defaultInput: MatchInput = {
  modality: 'adc',
  development_phase: 'phase_2',
  indication_category: 'solid_tumor',
  indication_specific: 'NSCLC',
  territory_scope: 'global',
  therapeutic_area: 'oncology',
};

// ---------------------------------------------------------------------------
// EMPTY / NO-MATCH CASES
// ---------------------------------------------------------------------------
describe('findPartnerMatches — empty / no-match cases', () => {
  test('1. returns empty matches when no companies found', async () => {
    const supabase = createMockSupabase({ data: [], error: null });

    const result = await findPartnerMatches(supabase, defaultInput);

    expect(result.total_matches).toBe(0);
    expect(result.matches).toEqual([]);
    expect(result.query_params).toEqual(defaultInput);
    expect(result.generated_at).toBeDefined();
  });

  test('2. throws when database returns an error', async () => {
    const supabase = createMockSupabase({
      data: null,
      error: { message: 'connection refused', code: 'PGRST301' },
    });

    await expect(findPartnerMatches(supabase, defaultInput)).rejects.toThrow(
      'Failed to fetch companies from database'
    );
  });

  test('3. returns empty matches when all companies score below threshold (15)', async () => {
    // Company with no overlap on modality, indication, or anything useful
    const lowScoreCompany = makeCompany({
      id: 'low-1',
      modalities_active: ['vaccine'],
      modalities_primary: ['vaccine'],
      indications_active: ['infectious'],
      indications_specific: ['influenza'],
      deals_last_12mo: 0,
      deals_last_24mo: 0,
      last_deal_date: null,
      active_trials_count: 0,
      acquisition_appetite: 'selective',
      strategic_priorities: ['infectious disease'],
      territory_focus: ['japan'],
      data_quality_score: 25,
      patent_cliffs: [],
      revenue_at_risk_2025: 0,
      revenue_at_risk_2026: 0,
      revenue_at_risk_2027: 0,
    });

    const supabase = createMockSupabase({ data: [lowScoreCompany], error: null });

    const result = await findPartnerMatches(supabase, {
      modality: 'gene_therapy',
      development_phase: 'discovery',
      indication_category: 'rare_disease',
      indication_specific: null,
      territory_scope: 'us',
      therapeutic_area: 'neurology',
    });

    expect(result.total_matches).toBe(0);
    expect(result.matches).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// MODALITY SCORING
// ---------------------------------------------------------------------------
describe('findPartnerMatches — modality scoring', () => {
  test('4. primary modality match yields high modality score (35 raw)', async () => {
    const company = makeCompany({
      id: 'mod-primary',
      modalities_primary: ['adc'],
      modalities_active: ['adc', 'bispecific'],
    });
    const supabase = createMockSupabase({ data: [company], error: null });

    const result = await findPartnerMatches(supabase, defaultInput);

    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    const match = result.matches[0];
    // Primary match = 35 raw points for modality
    expect(match.score_breakdown.modality).toBe(35);
  });

  test('5. active (non-primary) modality exact match yields 40 raw', async () => {
    const company = makeCompany({
      id: 'mod-active',
      modalities_primary: ['bispecific'], // primary is something else
      modalities_active: ['adc', 'bispecific'], // but adc is active
    });
    const supabase = createMockSupabase({ data: [company], error: null });

    const result = await findPartnerMatches(supabase, defaultInput);

    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    const match = result.matches[0];
    // Exact active (not primary) = 40
    expect(match.score_breakdown.modality).toBe(40);
  });

  test('6. adjacent modality match (input=adc, company has antibody) yields 20 raw', async () => {
    const company = makeCompany({
      id: 'mod-adjacent',
      modalities_primary: ['antibody'],
      modalities_active: ['antibody'],
      // 'antibody' is adjacent to 'adc' per MODALITY_ADJACENCY
    });
    const supabase = createMockSupabase({ data: [company], error: null });

    const result = await findPartnerMatches(supabase, defaultInput);

    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    const match = result.matches[0];
    // Adjacent = 20 (may be penalized by TA relevance, but raw modality should start at 20)
    // The TA relevance check could modify modality, so we check the pre-TA value indirectly:
    // Since this company has solid_tumor in indications_active, it has TA overlap with oncology.
    expect(match.score_breakdown.modality).toBe(20);
  });

  test('7. no modality overlap yields zero modality score', async () => {
    const company = makeCompany({
      id: 'mod-none',
      modalities_primary: ['mrna'],
      modalities_active: ['mrna', 'vaccine'],
      // mrna and vaccine are NOT adjacent to 'adc'
    });
    const supabase = createMockSupabase({ data: [company], error: null });

    const result = await findPartnerMatches(supabase, defaultInput);

    // May or may not pass threshold depending on other factors, but if it does
    // the modality should be 0
    if (result.matches.length > 0) {
      expect(result.matches[0].score_breakdown.modality).toBe(0);
    } else {
      // Company scored below threshold because no modality overlap
      expect(result.total_matches).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// INDICATION SCORING
// ---------------------------------------------------------------------------
describe('findPartnerMatches — indication scoring', () => {
  test('8. specific indication exact match yields 30 raw indication points', async () => {
    const company = makeCompany({
      id: 'ind-specific',
      indications_specific: ['NSCLC'],
      indications_active: ['solid_tumor'],
    });
    const supabase = createMockSupabase({ data: [company], error: null });

    const result = await findPartnerMatches(supabase, defaultInput);

    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    const match = result.matches[0];
    // 30 base + potential TA boost (oncology overlap via solid_tumor)
    expect(match.score_breakdown.indication).toBeGreaterThanOrEqual(30);
  });

  test('9. category match (no specific match) yields 20 raw indication points', async () => {
    const company = makeCompany({
      id: 'ind-category',
      indications_specific: ['breast_cancer'], // different specific
      indications_active: ['solid_tumor'],       // matches category
    });
    const supabase = createMockSupabase({ data: [company], error: null });

    const input: MatchInput = {
      ...defaultInput,
      indication_specific: 'ovarian_cancer', // not in company's specific list
    };

    const result = await findPartnerMatches(supabase, input);

    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    const match = result.matches[0];
    // 20 base category match + possible TA boost
    expect(match.score_breakdown.indication).toBeGreaterThanOrEqual(20);
  });

  test('10. adjacent indication category match yields 10 raw indication points', async () => {
    const company = makeCompany({
      id: 'ind-adjacent',
      indications_specific: [],
      indications_active: ['hematological'], // adjacent to solid_tumor
    });
    const supabase = createMockSupabase({ data: [company], error: null });

    const input: MatchInput = {
      ...defaultInput,
      indication_specific: null, // no specific
      indication_category: 'solid_tumor',
    };

    const result = await findPartnerMatches(supabase, input);

    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    const match = result.matches[0];
    // 10 base adjacent + TA boost (hematological is in oncology TA_INDICATIONS)
    expect(match.score_breakdown.indication).toBeGreaterThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// PHASE SCORING
// ---------------------------------------------------------------------------
describe('findPartnerMatches — phase scoring', () => {
  test('11. phase in sweet spot of company range yields 18 raw phase points', async () => {
    // Company range: phase_1 (rank 2) to phase_3 (rank 4), mid=3 => phase_2 is sweet spot
    const company = makeCompany({
      id: 'phase-sweet',
      phase_preference_min: 'phase_1',
      phase_preference_max: 'phase_3',
    });
    const supabase = createMockSupabase({ data: [company], error: null });

    const input: MatchInput = { ...defaultInput, development_phase: 'phase_2' };
    const result = await findPartnerMatches(supabase, input);

    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    expect(result.matches[0].score_breakdown.phase).toBe(18);
  });

  test('12. phase in range but not sweet spot yields 15 raw phase points', async () => {
    // Company range: preclinical (rank 1) to approved (rank 5). Mid=3. Range size=4.
    // phase_1 rank=2, distFromCenter = |2-3|=1, 0.25*4=1, so dist (1) <= 1 => sweet spot.
    // Use discovery (rank 0) which is outside preclinical..approved? No, 0 < 1 so outside.
    // Actually discovery rank=0, min=preclinical rank=1, so 0 < 1 => not in range at all.
    // Let's use: min=phase_1 (rank 2), max=approved (rank 5). Mid=3.5. Range=3.
    // phase_1 rank=2. distFromCenter = |2-3.5| = 1.5. 0.25*3 = 0.75. 1.5 > 0.75 => in range but NOT sweet spot.
    const company = makeCompany({
      id: 'phase-range',
      phase_preference_min: 'phase_1',
      phase_preference_max: 'approved',
    });
    const supabase = createMockSupabase({ data: [company], error: null });

    const input: MatchInput = { ...defaultInput, development_phase: 'phase_1' };
    const result = await findPartnerMatches(supabase, input);

    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    expect(result.matches[0].score_breakdown.phase).toBe(15);
  });

  test('13. phase adjacent to company range yields 8 raw phase points', async () => {
    // Company range: phase_2 (rank 3) to phase_3 (rank 4). Asset: phase_1 (rank 2).
    // |2 - 3| = 1 <= 1 => adjacent
    const company = makeCompany({
      id: 'phase-adj',
      phase_preference_min: 'phase_2',
      phase_preference_max: 'phase_3',
    });
    const supabase = createMockSupabase({ data: [company], error: null });

    const input: MatchInput = { ...defaultInput, development_phase: 'phase_1' };
    const result = await findPartnerMatches(supabase, input);

    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    expect(result.matches[0].score_breakdown.phase).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// ACTIVITY SCORING
// ---------------------------------------------------------------------------
describe('findPartnerMatches — activity scoring', () => {
  test('14. recent deal (< 6 months) gets highest activity score component', async () => {
    const company = makeCompany({
      id: 'act-recent',
      last_deal_date: new Date(Date.now() - 2 * 30 * 24 * 60 * 60 * 1000).toISOString(), // 2 months ago
      active_trials_count: 0,
    });
    const supabase = createMockSupabase({ data: [company], error: null });

    const result = await findPartnerMatches(supabase, defaultInput);

    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    // deal_last_6mo = 12. active_trials bonus = 8 (if indication > 0 and trials > 0, but trials=0 here)
    expect(result.matches[0].score_breakdown.activity).toBe(12);
  });

  test('15. no recent deals and no active trials yields zero activity score', async () => {
    const company = makeCompany({
      id: 'act-none',
      last_deal_date: null,
      deals_last_12mo: 0,
      deals_last_24mo: 0,
      active_trials_count: 0,
    });
    const supabase = createMockSupabase({ data: [company], error: null });

    const result = await findPartnerMatches(supabase, defaultInput);

    if (result.matches.length > 0) {
      expect(result.matches[0].score_breakdown.activity).toBe(0);
    }
    // If no matches, the company scored below 15 with no activity — also acceptable
  });
});

// ---------------------------------------------------------------------------
// TERRITORY SCORING
// ---------------------------------------------------------------------------
describe('findPartnerMatches — territory scoring', () => {
  test('16. global territory company matches any territory input (10 points)', async () => {
    const company = makeCompany({
      id: 'terr-global',
      territory_focus: ['global'],
    });
    const supabase = createMockSupabase({ data: [company], error: null });

    const input: MatchInput = { ...defaultInput, territory_scope: 'us' };
    const result = await findPartnerMatches(supabase, input);

    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    expect(result.matches[0].score_breakdown.territory).toBe(10);
  });

  test('17. US company with US territory input yields territory match (10 points)', async () => {
    const company = makeCompany({
      id: 'terr-us',
      territory_focus: ['us'],
    });
    const supabase = createMockSupabase({ data: [company], error: null });

    const input: MatchInput = { ...defaultInput, territory_scope: 'us' };
    const result = await findPartnerMatches(supabase, input);

    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    expect(result.matches[0].score_breakdown.territory).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// TA RELEVANCE
// ---------------------------------------------------------------------------
describe('findPartnerMatches — therapeutic area relevance', () => {
  test('18. strong TA alignment (multiple indication overlap) boosts indication by +15', async () => {
    // Company has both solid_tumor AND hematological (2 oncology TA indications)
    const company = makeCompany({
      id: 'ta-strong',
      indications_active: ['solid_tumor', 'hematological'],
      indications_specific: ['NSCLC'],
    });
    const supabase = createMockSupabase({ data: [company], error: null });

    const result = await findPartnerMatches(supabase, defaultInput);

    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    // indication_specific_exact = 30, TA boost = +15 => 45
    expect(result.matches[0].score_breakdown.indication).toBe(45);
  });

  test('19. company in different TA with same modality has modality score penalized (x0.4)', async () => {
    // Company is primarily immunology (autoimmune + dermatology = 2 overlap in immunology TA)
    // but has NO overlap with oncology TA indications.
    // Input is oncology, so modality gets penalized.
    const company = makeCompany({
      id: 'ta-different',
      modalities_primary: ['adc'],
      modalities_active: ['adc'],
      indications_active: ['autoimmune', 'dermatology'], // immunology TA, NOT oncology
      indications_specific: [],
      // Remove oncology-relevant patent cliffs to avoid strategic score inflating
      patent_cliffs: [],
      revenue_at_risk_2025: 0,
      revenue_at_risk_2026: 0,
      revenue_at_risk_2027: 0,
      strategic_priorities: ['autoimmune'],
    });
    const supabase = createMockSupabase({ data: [company], error: null });

    const result = await findPartnerMatches(supabase, defaultInput);

    // The company would normally get modality_primary = 35, but TA penalty => 35*0.4 = 14
    if (result.matches.length > 0) {
      expect(result.matches[0].score_breakdown.modality).toBe(14); // Math.round(35 * 0.4)
    } else {
      // Score fell below threshold due to TA penalty, which validates the penalty working
      expect(result.total_matches).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// OVERALL BEHAVIOR
// ---------------------------------------------------------------------------
describe('findPartnerMatches — overall behavior', () => {
  test('20. results are sorted by score descending', async () => {
    // Create three companies with varying match quality
    const highScoreCompany = makeCompany({
      id: 'high',
      name: 'HighScore Inc',
      modalities_primary: ['adc'],
      indications_specific: ['NSCLC'],
      indications_active: ['solid_tumor', 'hematological'],
      data_quality_score: 90,
    });

    const midScoreCompany = makeCompany({
      id: 'mid',
      name: 'MidScore Inc',
      modalities_primary: ['bispecific'], // not primary match for adc
      modalities_active: ['bispecific', 'adc'],
      indications_specific: [],
      indications_active: ['solid_tumor'],
      data_quality_score: 70,
      patent_cliffs: [],
      strategic_priorities: [],
    });

    const lowScoreCompany = makeCompany({
      id: 'low',
      name: 'LowScore Inc',
      modalities_primary: ['antibody'], // adjacent to adc
      modalities_active: ['antibody'],
      indications_specific: [],
      indications_active: ['solid_tumor'],
      data_quality_score: 50,
      patent_cliffs: [],
      strategic_priorities: [],
      acquisition_appetite: 'selective',
      last_deal_date: new Date(Date.now() - 18 * 30 * 24 * 60 * 60 * 1000).toISOString(), // 18 months
    });

    const supabase = createMockSupabase({
      data: [lowScoreCompany, midScoreCompany, highScoreCompany],
      error: null,
    });

    const result = await findPartnerMatches(supabase, defaultInput);

    expect(result.matches.length).toBeGreaterThanOrEqual(2);
    // Verify descending order
    for (let i = 1; i < result.matches.length; i++) {
      const prev = result.matches[i - 1];
      const curr = result.matches[i];
      if (prev.match_score !== curr.match_score) {
        expect(prev.match_score).toBeGreaterThan(curr.match_score);
      } else {
        // Tiebreaker: data_quality_score descending
        expect(prev.data_quality_score).toBeGreaterThanOrEqual(curr.data_quality_score);
      }
    }
  });

  test('21. matches limited by limit option', async () => {
    const companies = Array.from({ length: 10 }, (_, i) =>
      makeCompany({
        id: `lim-${i}`,
        name: `Company ${i}`,
        data_quality_score: 85 - i,
      })
    );

    const supabase = createMockSupabase({ data: companies, error: null });

    const result = await findPartnerMatches(supabase, defaultInput, { limit: 3 });

    expect(result.matches.length).toBeLessThanOrEqual(3);
    // total_matches reflects all qualifying matches, not just returned ones
    expect(result.total_matches).toBeGreaterThanOrEqual(result.matches.length);
  });

  test('22. match_score is normalized to 0-100 scale', async () => {
    const company = makeCompany({ id: 'norm-1' });
    const supabase = createMockSupabase({ data: [company], error: null });

    const result = await findPartnerMatches(supabase, defaultInput);

    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    const score = result.matches[0].match_score;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(Number.isInteger(score)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// STRATEGIC SCORING
// ---------------------------------------------------------------------------
describe('findPartnerMatches — strategic scoring', () => {
  test('23. patent cliff in relevant TA boosts strategic score (15 points)', async () => {
    const company = makeCompany({
      id: 'strat-cliff',
      patent_cliffs: [
        {
          drug_name: 'OncoBlocker',
          indication: 'NSCLC cancer',
          revenue_usd: 8_000_000_000,
          expiry_year: 2027, // <= 2029 threshold
        },
      ],
      // Remove strategic_priorities to isolate patent cliff scoring
      strategic_priorities: [],
    });
    const supabase = createMockSupabase({ data: [company], error: null });

    const result = await findPartnerMatches(supabase, defaultInput);

    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    // Patent cliff = 15 points. No priority match, so only 15.
    expect(result.matches[0].score_breakdown.strategic).toBe(15);
  });

  test('24. strategic priority match adds 8 points', async () => {
    const company = makeCompany({
      id: 'strat-priority',
      patent_cliffs: [], // no cliffs to isolate priority scoring
      revenue_at_risk_2025: 0,
      revenue_at_risk_2026: 0,
      revenue_at_risk_2027: 0,
      strategic_priorities: ['solid_tumor expansion', 'adc pipeline'], // matches indication_category and modality
    });
    const supabase = createMockSupabase({ data: [company], error: null });

    const result = await findPartnerMatches(supabase, defaultInput);

    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    // strategic_priority_match = 8. input.indication_category='solid_tumor' matches 'solid_tumor expansion'.
    expect(result.matches[0].score_breakdown.strategic).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// ADDITIONAL SCORING EDGE CASES
// ---------------------------------------------------------------------------
describe('findPartnerMatches — additional scoring edge cases', () => {
  test('25. activity bonus for active trials only given when indication score > 0', async () => {
    // Company with active trials but NO indication overlap => no trials bonus
    const companyNoIndication = makeCompany({
      id: 'trial-no-ind',
      indications_active: ['infectious'], // no overlap with solid_tumor
      indications_specific: [],
      active_trials_count: 20,
      last_deal_date: new Date(Date.now() - 2 * 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Company with active trials AND indication overlap => gets trials bonus
    const companyWithIndication = makeCompany({
      id: 'trial-with-ind',
      indications_active: ['solid_tumor'],
      indications_specific: ['NSCLC'],
      active_trials_count: 20,
      last_deal_date: new Date(Date.now() - 2 * 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const supabase1 = createMockSupabase({ data: [companyNoIndication], error: null });
    const supabase2 = createMockSupabase({ data: [companyWithIndication], error: null });

    const result1 = await findPartnerMatches(supabase1, defaultInput);
    const result2 = await findPartnerMatches(supabase2, defaultInput);

    // Company with indication overlap gets active_trials_relevant bonus (12 deal + 8 trials = 20)
    expect(result2.matches.length).toBeGreaterThanOrEqual(1);
    expect(result2.matches[0].score_breakdown.activity).toBe(20); // 12 (deal<6mo) + 8 (trials)

    // Company without indication overlap gets only deal bonus, no trials bonus
    if (result1.matches.length > 0) {
      expect(result1.matches[0].score_breakdown.activity).toBe(12); // 12 (deal<6mo) only
    }
  });
});
