/**
 * lib/radar/mandate-matcher.ts — standing matches are re-evaluated every run
 * (migration 127) instead of living forever.
 */

import { staleReason } from '@/lib/radar/mandate-matcher';

type Mandate = Parameters<typeof staleReason>[1];
type Asset = NonNullable<Parameters<typeof staleReason>[0]>;

function mandate(over: Partial<Mandate> = {}): Mandate {
  return {
    id: 'm1', user_id: 'u1', therapeutic_areas: ['oncology'], modalities: [], phase_min: 'phase_2', phase_max: 'phase_3',
    countries: [], regions: [], partnership_statuses: ['unpartnered', 'partially_partnered'],
    min_licensing_intent: 10, min_deal_readiness: 0, min_confidence: 0, match_count: 0, created_at: null, updated_at: null,
    ...over,
  } as Mandate;
}

function asset(over: Partial<Asset> = {}): Asset {
  return {
    id: 'a1', therapeutic_area: 'oncology', modality: 'antibody', phase: 'phase_2', originator_country: 'US', originator_region: 'north_america',
    partnership_status: 'unpartnered', licensing_intent_score: 22, deal_readiness_score: 40, confidence_score: 60, ownership_status: 'originator',
    ...over,
  };
}

describe('staleReason', () => {
  it('a match that still qualifies is not stale', () => {
    expect(staleReason(asset(), mandate())).toBeNull();
  });

  it('the asset row disappeared', () => {
    expect(staleReason(null, mandate())).toBe('asset_removed');
  });

  it('ownership re-attribution wins over everything else', () => {
    expect(staleReason(asset({ ownership_status: 'marketed_other', partnership_status: 'partnered' }), mandate())).toBe('ownership_excluded');
    expect(staleReason(asset({ ownership_status: 'comparator_or_background' }), mandate())).toBe('ownership_excluded');
    expect(staleReason(asset({ ownership_status: 'unknown' }), mandate())).toBeNull();
  });

  it('partnered since matching, unless the mandate asked for partnered assets', () => {
    expect(staleReason(asset({ partnership_status: 'partnered' }), mandate())).toBe('partnered');
    expect(staleReason(asset({ partnership_status: 'partnered' }), mandate({ partnership_statuses: ['partnered'] }))).toBeNull();
  });

  it('score fell below the mandate floor', () => {
    expect(staleReason(asset({ licensing_intent_score: 4 }), mandate({ min_licensing_intent: 10 }))).toBe('score_below_min');
  });

  it('asset moved out of the mandate filters (phase, TA)', () => {
    expect(staleReason(asset({ phase: 'phase_4' }), mandate())).toBe('filter_mismatch');
    expect(staleReason(asset({ therapeutic_area: 'neurology' }), mandate())).toBe('filter_mismatch');
  });
});
