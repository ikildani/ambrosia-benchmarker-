import {
  resolveCompany,
  resolveAsset,
  resolveDeal,
  resolveBatch,
  pickBestCompany,
  companyPopulationScore,
  scoreDealRow,
  usdToM,
  type CompanyRow,
  type DealRow,
} from '@/lib/entities/resolve';
import { lookupCompany, lookupAsset, lookupDeal } from '@/lib/entities/lookup';
import { RESOLVE_BATCH_MAX } from '@/lib/entities/types';
import type { CompanyMeta } from '@/lib/entities/types';
import { fixtureClient, UUID, COMPANIES } from './stub-supabase';

const client = () => fixtureClient() as unknown as Parameters<typeof resolveCompany>[0];

describe('resolveCompany — match order', () => {
  it('id wins and reports duplicates', async () => {
    const r = await resolveCompany(client(), { id: UUID.lilly, name: 'Something Else' });
    expect(r.match?.matchedOn).toBe('id');
    expect(r.match?.confidence).toBe(1);
    expect(r.match?.id).toBe(UUID.lilly);
    expect((r.match?.meta as CompanyMeta).duplicateIds).toEqual([UUID.lillyDup]);
    expect(r.candidates).toEqual([]);
  });

  it('a non-uuid id resolves to nothing rather than falling through', async () => {
    const r = await resolveCompany(client(), { id: 'nope' });
    expect(r.match).toBeNull();
  });

  it('ticker and cik are id-grade matches', async () => {
    const t = await resolveCompany(client(), { ticker: 'pfe' });
    expect(t.match?.id).toBe(UUID.pfizer);
    expect(t.match?.matchedOn).toBe('id');
    const c = await resolveCompany(client(), { cik: '78003' });
    expect(c.match?.id).toBe(UUID.pfizer);
    const c2 = await resolveCompany(client(), { cik: '0000059478' });
    expect(c2.match?.id).toBe(UUID.lilly);
  });

  it('exact normalised name beats alias and fuzzy', async () => {
    const r = await resolveCompany(client(), { name: 'Pfizer Inc.' });
    expect(r.match?.id).toBe(UUID.pfizer);
    expect(r.match?.matchedOn).toBe('exact');
    expect(r.match?.confidence).toBe(0.98);
  });

  it('spacing differences are still exact', async () => {
    const r = await resolveCompany(client(), { name: 'Kyowa  Kirin, Ltd' });
    expect(r.match?.id).toBe(UUID.kyowa);
    expect(r.match?.matchedOn).toBe('exact');
  });

  it('alias (name_variations) when no exact name exists', async () => {
    const r = await resolveCompany(client(), { name: 'MSD' });
    expect(r.match?.id).toBe(UUID.merck);
    expect(r.match?.matchedOn).toBe('alias');
    expect(r.match?.confidence).toBe(0.95);
    expect(r.match?.aliases).toContain('Merck Sharp & Dohme');
  });

  it('Genentech resolves to Roche only because the row lists it as a variation, not by fuzzy', async () => {
    const r = await resolveCompany(client(), { name: 'Genentech' });
    expect(r.match?.id).toBe(UUID.roche);
    expect(r.match?.matchedOn).toBe('alias');
  });

  it('Roche Holding AG is its own exact row, not merged into Roche', async () => {
    const r = await resolveCompany(client(), { name: 'Roche Holding AG' });
    expect(r.match?.id).toBe(UUID.rocheHolding);
    expect(r.match?.matchedOn).toBe('exact');
    expect((r.match?.meta as CompanyMeta).duplicateIds).toEqual([]);
  });

  it('fuzzy below threshold returns null with up to 3 candidates', async () => {
    const r = await resolveCompany(client(), { name: 'Pfizzer' });
    expect(r.match).toBeNull();
    expect(r.candidates.length).toBeGreaterThan(0);
    expect(r.candidates.length).toBeLessThanOrEqual(3);
    expect(r.candidates[0].id).toBe(UUID.pfizer);
    expect(r.candidates[0].score).toBeLessThan(0.85);
    expect(r.candidates[0].score).toBeGreaterThan(0);
  });

  it('fuzzy above threshold matches with the similarity as confidence', async () => {
    // "vertex pharmaceutical" vs "vertex pharmaceuticals": 21 shared trigrams of 24 = 0.875.
    const r = await resolveCompany(client(), { name: 'Vertex Pharmaceutical Inc' });
    expect(r.match?.id).toBe(UUID.vertex);
    expect(r.match?.matchedOn).toBe('fuzzy');
    expect(r.match?.confidence).toBeGreaterThanOrEqual(0.85);
    expect(r.match?.confidence).toBeLessThan(1);
  });

  it('a one-letter slip in a short name stays below the threshold (candidate only)', async () => {
    const r = await resolveCompany(client(), { name: 'Kyowa Kirinn' });
    expect(r.match).toBeNull();
    expect(r.candidates[0]?.id).toBe(UUID.kyowa);
    expect(r.candidates[0]?.score).toBeCloseTo(10 / 13, 2);
  });

  it('unknown names resolve to null with no candidates', async () => {
    const r = await resolveCompany(client(), { name: 'Zzyzx Nonexistent Bio' });
    expect(r.match).toBeNull();
    expect(r.candidates).toEqual([]);
  });

  it('empty query resolves to null without querying', async () => {
    const stub = fixtureClient();
    const r = await resolveCompany(stub as unknown as Parameters<typeof resolveCompany>[0], { name: '   ' });
    expect(r.match).toBeNull();
    expect(stub.calls).toHaveLength(0);
  });
});

describe('resolveCompany — duplicate preference', () => {
  it('prefers the best-populated row and lists the others', async () => {
    const r = await resolveCompany(client(), { name: 'Eli Lilly and Company' });
    expect(r.match?.id).toBe(UUID.lilly);
    expect(r.match?.canonicalName).toBe('Eli Lilly');
    expect((r.match?.meta as CompanyMeta).duplicateIds).toEqual([UUID.lillyDup]);
    expect(r.match?.aliases).toEqual(expect.arrayContaining(['Eli Lilly', 'Eli Lilly and Company', 'Lilly']));
  });

  it('three Kyowa Kirin spellings collapse onto the enriched row', async () => {
    const r = await resolveCompany(client(), { name: 'Kyowa Kirin Co., Ltd.' });
    expect(r.match?.id).toBe(UUID.kyowa);
    expect((r.match?.meta as CompanyMeta).duplicateIds.sort()).toEqual([UUID.kyowaDup1, UUID.kyowaDup2].sort());
  });

  it('pickBestCompany ranks by population score, ties by id', () => {
    const rows = COMPANIES.filter(c => String(c.name).toLowerCase().startsWith('kyowa')) as unknown as CompanyRow[];
    const picked = pickBestCompany(rows)!;
    expect(picked.best.id).toBe(UUID.kyowa);
    expect(picked.duplicates.map(d => d.id)).toEqual([UUID.kyowaDup1, UUID.kyowaDup2]);
    expect(pickBestCompany([])).toBeNull();
    const base = { data_quality_score: 0, total_annual_revenue: null, deals_last_24mo: 0, company_type: null, ticker: null, cik: null, sec_cik: null, name_variations: null };
    expect(companyPopulationScore({ ...base, data_quality_score: 10, total_annual_revenue: 1, deals_last_24mo: 3 })).toBe(63);
    expect(companyPopulationScore(base)).toBe(0);
  });
});

describe('resolveAsset', () => {
  it('id', async () => {
    const r = await resolveAsset(client(), { id: UUID.pembro });
    expect(r.match?.matchedOn).toBe('id');
    expect(r.match?.canonicalName).toBe('pembrolizumab');
    expect(r.match?.aliases).toEqual(expect.arrayContaining(['Keytruda', 'MK-3475']));
  });

  it('unii / chembl_id are id-grade', async () => {
    expect((await resolveAsset(client(), { unii: 'dpt0o3t46p' })).match?.id).toBe(UUID.pembro);
    expect((await resolveAsset(client(), { chembl_id: 'CHEMBL2108738' })).match?.id).toBe(UUID.nivo);
  });

  it('inn / preferred_name exact, preferring the externally-resolved row over the internal placeholder', async () => {
    const r = await resolveAsset(client(), { name: 'Pembrolizumab' });
    expect(r.match?.id).toBe(UUID.pembro);
    expect(r.match?.matchedOn).toBe('exact');
    expect(r.candidates.map(c => c.id)).toContain(UUID.pembroInternal);
  });

  it('brand and code aliases resolve through drug_aliases', async () => {
    const k = await resolveAsset(client(), { name: 'KEYTRUDA' });
    expect(k.match?.id).toBe(UUID.pembro);
    expect(k.match?.matchedOn).toBe('alias');
    const c = await resolveAsset(client(), { name: 'MK 3475' });
    expect(c.match?.id).toBe(UUID.pembro);
  });

  it('code names never fuzzy-match', async () => {
    const r = await resolveAsset(client(), { name: 'MK-3476' });
    expect(r.match).toBeNull();
    expect(r.candidates).toEqual([]);
  });

  it('fuzzy INN typo below threshold gives candidates only', async () => {
    const r = await resolveAsset(client(), { name: 'pembrolizumap' });
    expect(r.match).toBeNull();
    expect(r.candidates[0]?.id).toBe(UUID.pembro);
  });
});

describe('resolveDeal', () => {
  it('id, subject to the quality filter', async () => {
    const ok = await resolveDeal(client(), { id: UUID.deal1 });
    expect(ok.match?.matchedOn).toBe('id');
    expect(ok.match?.canonicalName).toContain('Kyowa Kirin');
    expect(ok.match?.meta).toMatchObject({ upfrontM: 50, totalM: 500, licenseeId: UUID.lilly });
    for (const id of [UUID.dealRejected, UUID.dealSynthetic, UUID.dealNonCanonical]) {
      expect((await resolveDeal(client(), { id })).match).toBeNull();
    }
  });

  it('parties + date exact', async () => {
    const r = await resolveDeal(client(), { licensor: 'Kyowa Kirin', licensee: 'Eli Lilly', announced_date: '2026-03-01' });
    expect(r.match?.id).toBe(UUID.deal1);
    expect(r.match?.matchedOn).toBe('exact');
  });

  it('date within the window still matches; excluded rows never appear', async () => {
    const r = await resolveDeal(client(), { licensor: 'Kyowa Kirin', licensee: 'Eli Lilly', announced_date: '2026-03-10' });
    expect(r.match?.id).toBe(UUID.deal1);
    expect(r.match?.matchedOn).toBe('fuzzy');
    const ids = [r.match?.id, ...r.candidates.map(c => c.id)];
    expect(ids).not.toContain(UUID.dealRejected);
    expect(ids).not.toContain(UUID.dealSynthetic);
    expect(ids).not.toContain(UUID.dealNonCanonical);
  });

  it('one party only is ambiguous across two deals: candidates, no match', async () => {
    const r = await resolveDeal(client(), { licensor: 'Kyowa Kirin' });
    expect(r.match).toBeNull();
    expect(r.candidates.map(c => c.id).sort()).toEqual([UUID.deal1, UUID.deal2].sort());
  });

  it('swapped parties still find the deal but not as exact', async () => {
    const r = await resolveDeal(client(), { licensor: 'Eli Lilly', licensee: 'Kyowa Kirin', announced_date: '2026-03-01' });
    expect(r.match?.id).toBe(UUID.deal1);
    expect(r.match?.matchedOn).toBe('fuzzy');
  });

  it('scoreDealRow / usdToM', () => {
    const row: DealRow = { id: 'x', licensor_name: 'Kyowa Kirin', licensor_id: null, licensee_name: 'Pfizer', licensee_id: null, asset_name: null, announced_date: '2025-01-15', deal_type: null, phase_at_signing: null, upfront_usd: null, total_deal_value_usd: null };
    expect(scoreDealRow(row, { licensor: 'Kyowa Kirin', licensee: 'Pfizer Inc', announced_date: '2025-01-15' })).toEqual({ score: 1, exact: true });
    expect(scoreDealRow(row, { licensor: 'Kyowa Kirin', announced_date: '2025-01-30' }).score).toBeCloseTo(0.7 + 0.3 * (1 - 15 / 45), 5);
    expect(scoreDealRow(row, {})).toEqual({ score: 0, exact: false });
    expect(usdToM(50_000_000)).toBe(50);
    expect(usdToM(1_234_567)).toBe(1.235);
    expect(usdToM(null)).toBeNull();
  });
});

describe('resolveBatch', () => {
  it('keeps input order and caps at RESOLVE_BATCH_MAX', async () => {
    const out = await resolveBatch(client(), [
      { kind: 'asset', name: 'Keytruda' },
      { kind: 'company', name: 'Nobody Here' },
      { kind: 'deal', id: UUID.deal1 },
      { kind: 'company', ticker: 'LLY' },
    ]);
    expect(out.map(r => r.match?.kind ?? null)).toEqual(['asset', null, 'deal', 'company']);
    const tooMany = Array.from({ length: RESOLVE_BATCH_MAX + 1 }, () => ({ kind: 'company' as const, name: 'Pfizer' }));
    await expect(resolveBatch(client(), tooMany)).rejects.toThrow(/Batch too large/);
    const exactly = Array.from({ length: RESOLVE_BATCH_MAX }, () => ({ kind: 'company' as const, name: 'Pfizer' }));
    expect((await resolveBatch(client(), exactly)).length).toBe(RESOLVE_BATCH_MAX);
  });

  it('one failing item does not fail the batch', async () => {
    const broken = fixtureClient();
    const origFrom = broken.from;
    broken.from = (table: string) => {
      if (table === 'drug_master') throw new Error('boom');
      return origFrom(table);
    };
    const out = await resolveBatch(broken as unknown as Parameters<typeof resolveBatch>[0], [
      { kind: 'asset', id: UUID.pembro },
      { kind: 'company', name: 'Pfizer' },
    ]);
    expect(out[0]).toEqual({ match: null, candidates: [] });
    expect(out[1].match?.id).toBe(UUID.pfizer);
  });
});

describe('lookup by id', () => {
  it('company carries aliases, ids and duplicates', async () => {
    const c = await lookupCompany(client(), UUID.lilly);
    expect(c).toMatchObject({ kind: 'company', name: 'Eli Lilly', type: 'large_pharma', ids: { ticker: 'LLY', cik: '59478' }, duplicateIds: [UUID.lillyDup] });
    expect(c?.aliases).toContain('Lilly');
    expect(await lookupCompany(client(), '00000000-0000-4000-8000-000000000000')).toBeNull();
    expect(await lookupCompany(client(), 'bad')).toBeNull();
  });

  it('asset carries inn, modality, target, originator and owners', async () => {
    const a = await lookupAsset(client(), UUID.pembro);
    expect(a).toMatchObject({ kind: 'asset', preferredName: 'pembrolizumab', inn: 'pembrolizumab', modality: 'antibody', target: 'PD-1', maxPhase: 'approved', originatorCompanyId: UUID.merck });
    expect(a?.owners).toEqual([{ companyId: UUID.merck, role: 'originator', territory: 'global' }]);
    expect(a?.aliases).toContain('Keytruda');
  });

  it('deal returns canonical party ids, $M terms and source url; filtered rows are null', async () => {
    const d = await lookupDeal(client(), UUID.deal1);
    expect(d?.parties.licensor).toEqual({ id: UUID.kyowaDup1, name: 'Kyowa Kirin Co., Ltd.' });
    expect(d?.parties.licensee).toEqual({ id: UUID.lilly, name: 'Eli Lilly and Company' });
    expect(d?.asset).toEqual({ id: UUID.pembro, name: 'Keytruda' });
    expect(d?.terms).toEqual({ upfrontM: 50, milestonesM: 450, totalM: 500, royaltyLowPct: 8, royaltyHighPct: 12, termsDisclosed: true });
    expect(d?.sourceUrl).toBe('https://example.com/pr');
    expect(await lookupDeal(client(), UUID.dealRejected)).toBeNull();
  });

  it('deal with a dangling party id falls back to a name resolve', async () => {
    const custom = fixtureClient({
      deals: [
        {
          id: UUID.deal2, licensor_name: 'Kyowa Kirin', licensor_id: '00000000-0000-4000-8000-00000000dead', licensee_name: 'Pfizer Inc.', licensee_id: null,
          asset_name: 'unknown-thing', announced_date: '2025-01-15', deal_type: 'license', phase_at_signing: 'phase_2', therapeutic_area: 'oncology',
          indication_specific: null, indication_category: null, upfront_usd: null, milestones_total_usd: null, total_deal_value_usd: null,
          royalty_low_pct: null, royalty_high_pct: null, terms_disclosed: false, source_url: null, press_release_url: 'https://example.com/press',
          verification_status: 'pending', is_synthetic: false, is_canonical: true,
        },
      ],
    });
    const d = await lookupDeal(custom as unknown as Parameters<typeof lookupDeal>[0], UUID.deal2);
    expect(d?.parties.licensor.id).toBe(UUID.kyowa);
    expect(d?.parties.licensee.id).toBe(UUID.pfizer);
    expect(d?.asset.id).toBeNull();
    expect(d?.sourceUrl).toBe('https://example.com/press');
  });
});
