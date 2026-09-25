/**
 * Resolver candidate index (pure parts) — the identity pre-filter must surface
 * every deal scoreMatch could accept, and nothing for unrelated licensors.
 */

import { buildDealIndex, candidateDeals } from '@/lib/outcomes/resolver';
import type { CompanyAlias, DealCandidateRow, PredictionForMatch } from '@/lib/outcomes/types';

const deal = (id: string, over: Partial<DealCandidateRow>): DealCandidateRow => ({
  id, licensor_name: null, licensor_id: null, licensee_name: 'Buyer', licensee_id: null, asset_name: null,
  announced_date: '2027-02-10', phase_at_signing: 'phase_2', deal_type: 'license', indication_category: null,
  indication_specific: null, therapeutic_area: null, modality: null, territory: null, upfront_usd: null,
  total_deal_value_usd: null, royalty_low_pct: null, royalty_high_pct: null, created_at: null, ...over,
});

const prediction = (over: Partial<PredictionForMatch>): PredictionForMatch => ({
  id: 'p', company_id: null, asset_id: null, licensor_name: null, asset_name: null, indication: null,
  therapeutic_area: null, phase: null, resolve_after: '2026-10-01T00:00:00Z', upfront_low: null, upfront_mid: null,
  upfront_high: null, total_low: null, total_mid: null, total_high: null, predicted_buyers: [],
  predicted_window_start: null, predicted_window_end: null, ...over,
});

const companies: CompanyAlias[] = [
  { id: 'c1', name: 'Acme Therapeutics', name_variations: ['ACME Thera'] },
];

const deals = [
  deal('d-name', { licensor_name: 'Acme Therapeutics Inc' }),
  deal('d-id', { licensor_name: 'Some Spelling', licensor_id: 'c1' }),
  deal('d-alias', { licensor_name: 'ACME Thera' }),
  deal('d-asset', { licensor_name: 'Newco', asset_name: 'ACM-101' }),
  deal('d-token', { licensor_name: 'Acme Oncology Partners' }),
  deal('d-other', { licensor_name: 'Zeta Biologics' }),
];

describe('candidate index', () => {
  const index = buildDealIndex(deals, companies);

  it('surfaces name, id, alias, asset and token matches, not unrelated deals', () => {
    const ids = [...candidateDeals(prediction({ licensor_name: 'Acme Therapeutics', asset_name: 'ACM-101' }), index, companies)].map((i) => deals[i].id).sort();
    expect(ids).toEqual(['d-alias', 'd-asset', 'd-id', 'd-name', 'd-token']);
  });

  it('company_id alone finds the id and alias deals', () => {
    const ids = [...candidateDeals(prediction({ company_id: 'c1' }), index, companies)].map((i) => deals[i].id).sort();
    expect(ids).toEqual(['d-alias', 'd-id', 'd-name']);
  });

  it('returns nothing for a prediction with no identity', () => {
    expect(candidateDeals(prediction({}), index, companies).size).toBe(0);
  });
});
