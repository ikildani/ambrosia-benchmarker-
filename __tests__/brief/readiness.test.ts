import { computeReadiness, stageWindow, readinessSummary } from '@/lib/brief/readiness';
import { buildTopupQueries } from '@/lib/ingestion/indication-topup';
import { parseVerdict } from '@/lib/ingestion/deal-status';
import type { RawDealRow } from '@/lib/brief/comp-set';

const row = (o: Partial<RawDealRow>): RawDealRow => ({
  id: Math.random().toString(36).slice(2), licensor_name: 'A', licensee_name: 'B', asset_name: 'X', announced_date: '2024-05-01', phase_at_signing: 'preclinical',
  deal_type: 'license', modality: 'smallMolecule', indication_category: null, indication_specific: null, therapeutic_area: 'neurology', territory: 'global',
  upfront_usd: 20e6, total_deal_value_usd: 500e6, milestones_total_usd: null, royalty_low_pct: null, royalty_high_pct: null, equity_investment_usd: null,
  verified: true, source_type: null, source_url: null, ...o,
} as unknown as RawDealRow);

describe('readiness', () => {
  it('stage window is the phase and one step either side', () => {
    expect(stageWindow('preclinical')).toEqual(['discovery', 'preclinical', 'phase_1']);
    expect(stageWindow('phase2')).toEqual(['phase_1', 'phase_2', 'phase_3']);
  });

  it('scores a thin indication red and queues a top-up; a deep one green', async () => {
    const thin: RawDealRow[] = [
      row({ indication_specific: 'amyotrophic lateral sclerosis', licensee_name: 'Pfizer' }),
      ...Array.from({ length: 12 }, (_, i) => row({ indication_specific: "Alzheimer's disease", licensee_name: `Buyer ${i}`, verified: i % 2 === 0, deal_status_checked_at: i < 3 ? '2026-09-01' : null })),
    ];
    const r = await computeReadiness({} as never, { therapeuticArea: 'Neurology', indication: 'ALS', phase: 'Preclinical', rows: thin, skipTerrain: true });
    expect(r.profile.therapeuticArea).toBe('neurology');
    expect(r.profile.indicationKey).toBe('als');
    expect(r.lines[0].status).toBe('red');
    expect(r.topUpRecommended).toBe(true);
    expect(r.lines[3].value).toMatch(/local \$180K/);
    expect(readinessSummary(r)).toMatch(/^RED/);

    const deep: RawDealRow[] = Array.from({ length: 14 }, (_, i) => row({ indication_specific: 'amyotrophic lateral sclerosis', licensee_name: `Buyer ${i}`, deal_status_checked_at: '2026-09-01' }));
    const g = await computeReadiness({} as never, { therapeuticArea: 'Neurology', indication: 'ALS', phase: 'Preclinical', rows: deep, skipTerrain: true });
    expect(g.lines[0].status).toBe('green');
    expect(g.lines[2].status).toBe('green');
    expect(g.lines[4].status).toBe('green');
    expect(g.topUpRecommended).toBe(false);
  });

  it('the indication decides the area, as in resolveIntake', async () => {
    const r = await computeReadiness({} as never, { therapeuticArea: 'Oncology', indication: 'ALS', phase: 'Preclinical', rows: [], skipTerrain: true });
    expect(r.profile.therapeuticArea).toBe('neurology');
  });
});

describe('indication top-up queries', () => {
  it('scopes every query to the indication and adds a mechanism query when known', () => {
    const q = buildTopupQueries({ indication: 'ALS', phase: 'Preclinical', mechanism: 'SOD1 antisense', target: 'SOD1', therapeutic_area: 'neurology' });
    expect(q).toHaveLength(4);
    expect(q.every(s => /ALS|SOD1/.test(s))).toBe(true);
    expect(q[1]).toMatch(/preclinical/i);
    expect(buildTopupQueries({ indication: 'NSCLC', phase: 'Phase 2', mechanism: null, target: null, therapeutic_area: 'oncology' })).toHaveLength(3);
  });
});

describe('deal status verdict parsing', () => {
  it('accepts the five statuses and drops anything else to unknown', () => {
    expect(parseVerdict('Here: {"status":"terminated","confidence":88,"date":"2025-03","reason":"rights returned"}')).toEqual({ status: 'terminated', confidence: 88, date: '2025-03', reason: 'rights returned' });
    expect(parseVerdict('{"status":"cancelled","confidence":90,"reason":"x"}')?.status).toBe('unknown');
    expect(parseVerdict('no json')).toBeNull();
  });
});
