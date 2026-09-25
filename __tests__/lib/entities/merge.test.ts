import {
  COMPANY_REFERENCING_COLUMNS,
  columnKey,
  differOnlyByMarker,
  planCompanyMerges,
  rankCanonical,
  repointPlan,
  splitNameMarkers,
  stripParentAliases,
  unionAliases,
  type MergeCompanyRow,
} from '@/lib/entities/merge';
import { assertApplyGuards, assertMigrationPresent, MERGE_APPLY_ENV } from '@/lib/entities/merge-apply';
import { resolveCompany, followMergedInto, pickBestCompany, type CompanyRow } from '@/lib/entities/resolve';
import { lookupCompany } from '@/lib/entities/lookup';
import { createStubSupabase, COMPANIES, UUID } from './stub-supabase';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function row(o: Partial<MergeCompanyRow> & { id: string; name: string }): MergeCompanyRow {
  return {
    name_variations: [o.name],
    company_type: null,
    owner_type: 'industry',
    hq_country: null,
    hq_region: null,
    ticker: null,
    cik: null,
    sec_cik: null,
    website_url: null,
    data_quality_score: 0,
    total_annual_revenue: null,
    deals_last_24mo: 0,
    source_registry: 'ctgov',
    created_at: '2026-01-01T00:00:00Z',
    ...o,
  };
}

const lilly = row({ id: id(1), name: 'Eli Lilly', name_variations: ['Eli Lilly', 'Lilly'], company_type: 'large_pharma', data_quality_score: 100, ticker: 'LLY', cik: '59478', source_registry: null });
const lillyCo = row({ id: id(2), name: 'Eli Lilly and Company', name_variations: ['Eli Lilly and Company', 'Eli Lilly & Co.'] });
const lillyInc = row({ id: id(3), name: 'Eli Lilly & Company, Inc.', name_variations: null });
const astra = row({ id: id(10), name: 'AstraZeneca', company_type: 'large_pharma', data_quality_score: 100, ticker: 'AZN', source_registry: null });
const astraPlc = row({ id: id(11), name: 'AstraZeneca PLC', name_variations: ['AstraZeneca PLC', 'AZ'] });
const alexion = row({ id: id(12), name: 'Alexion (AstraZeneca)', name_variations: ['Alexion (AstraZeneca)', 'AstraZeneca', 'Alexion', 'Alexion Pharmaceuticals'], company_type: 'large_pharma', data_quality_score: 95, source_registry: null });
const pfizer = row({ id: id(20), name: 'Pfizer', company_type: 'large_pharma', data_quality_score: 100, ticker: 'PFE', source_registry: null });
const pfizerOnc = row({ id: id(21), name: 'Pfizer Oncology', name_variations: ['Pfizer Oncology', 'Pfizer'], data_quality_score: 40 });

describe('planCompanyMerges — grouping and canonical choice', () => {
  it('groups rows by normalised name (legal forms and spacing ignored) and picks the best-populated row', () => {
    const r = planCompanyMerges([lilly, lillyCo, lillyInc, astra, astraPlc]);
    expect(r.stats.groups).toBe(2);
    expect(r.plans).toHaveLength(2);
    const lillyPlan = r.plans.find(p => p.canonicalId === lilly.id)!;
    expect(lillyPlan.key).toBe('elililly');
    expect(lillyPlan.merged.map(m => m.id).sort()).toEqual([lillyCo.id, lillyInc.id]);
    expect(lillyPlan.reason).toBe('same_normalized_name');
    expect(lillyPlan.merged[0].reasons[0]).toMatch(/same normalised name/);
    const azPlan = r.plans.find(p => p.canonicalId === astra.id)!;
    expect(azPlan.merged.map(m => m.id)).toEqual([astraPlc.id]);
    expect(r.stats.rowsToMerge).toBe(3);
    expect(r.review).toEqual([]);
  });

  it('singletons and rows already merged produce no plan', () => {
    const merged = row({ id: id(4), name: 'Eli Lilly Ltd', merged_into: lilly.id });
    const r = planCompanyMerges([lilly, merged, pfizer]);
    expect(r.plans).toEqual([]);
    expect(r.stats.alreadyMerged).toBe(1);
    expect(r.stats.groups).toBe(0);
  });

  it('reference counts break population-score ties, then non-registry rows, then the oldest row', () => {
    const a = row({ id: id(30), name: 'Kyowa Kirin', created_at: '2026-02-01T00:00:00Z' });
    const b = row({ id: id(31), name: 'Kyowa Kirin Co., Ltd.', created_at: '2025-01-01T00:00:00Z' });
    const c = row({ id: id(32), name: 'Kyowa Kirin Inc', created_at: '2024-01-01T00:00:00Z', source_registry: null });
    expect(rankCanonical([a, b, c])[0].id).toBe(c.id); // non-registry wins over older registry rows
    expect(rankCanonical([a, b])[0].id).toBe(b.id); // oldest
    expect(rankCanonical([a, b, c], new Map([[a.id, 12]]))[0].id).toBe(a.id); // references beat both
    const r = planCompanyMerges([a, b, c], { referenceCounts: new Map([[a.id, 12], [b.id, 3]]) });
    expect(r.plans[0].canonicalId).toBe(a.id);
    expect(r.plans[0].referenceCount).toBe(3);
    expect(r.plans[0].canonicalReferenceCount).toBe(12);
  });

  it('plans are ordered by references to re-point, descending', () => {
    const r = planCompanyMerges([lilly, lillyCo, astra, astraPlc], { referenceCounts: new Map([[astraPlc.id, 40], [lillyCo.id, 2]]) });
    expect(r.plans.map(p => p.canonicalId)).toEqual([astra.id, lilly.id]);
    expect(r.stats.referencesToRepoint).toBe(42);
  });
});

describe('planCompanyMerges — alias union', () => {
  it('unions name_variations canonical-first, exact-string deduped, and includes every folded row name', () => {
    const r = planCompanyMerges([lilly, lillyCo, lillyInc]);
    expect(r.plans[0].aliasUnion).toEqual(['Eli Lilly', 'Lilly', 'Eli Lilly and Company', 'Eli Lilly & Co.', 'Eli Lilly & Company, Inc.']);
    expect(unionAliases(lilly, [lillyCo])).toEqual(['Eli Lilly', 'Lilly', 'Eli Lilly and Company', 'Eli Lilly & Co.']);
  });

  it('ignores empty and whitespace-only variations', () => {
    const a = row({ id: id(40), name: 'Acme Bio', name_variations: ['Acme Bio', ' ', ''] });
    const b = row({ id: id(41), name: 'Acme Bio Inc', name_variations: null });
    expect(unionAliases(a, [b])).toEqual(['Acme Bio', 'Acme Bio Inc']);
  });
});

describe('planCompanyMerges — guard rails', () => {
  it('never merges two rows carrying distinct tickers', () => {
    const a = row({ id: id(50), name: 'Merck', ticker: 'MRK', data_quality_score: 100 });
    const b = row({ id: id(51), name: 'Merck KGaA', ticker: 'MRK.DE' });
    const c = row({ id: id(52), name: 'Merck & Co.', ticker: 'mrk ' }); // same ticker after trim/upper: fine
    const conflict = planCompanyMerges([a, row({ id: id(53), name: 'Merck Inc', ticker: 'MKGAF' })]);
    expect(conflict.plans).toEqual([]);
    expect(conflict.review).toHaveLength(1);
    expect(conflict.review[0].reason).toBe('ticker_conflict');
    expect(conflict.review[0].detail).toContain('MRK');
    expect(conflict.stats.rowsInReview).toBe(2);
    const ok = planCompanyMerges([a, c, b]);
    expect(ok.plans).toHaveLength(1); // Merck KGaA is its own key; a + c share the ticker
    expect(ok.plans[0].merged.map(m => m.id)).toEqual([c.id]);
  });

  it('never merges two rows carrying distinct ciks (cik or sec_cik, zero-padding ignored)', () => {
    const a = row({ id: id(60), name: 'Vertex Pharmaceuticals', cik: '875320' });
    const b = row({ id: id(61), name: 'Vertex Pharmaceuticals Inc', sec_cik: '0000875320' });
    const c = row({ id: id(62), name: 'Vertex Pharmaceuticals, Inc.', sec_cik: '1234567' });
    expect(planCompanyMerges([a, b]).plans).toHaveLength(1);
    const r = planCompanyMerges([a, b, c]);
    expect(r.plans).toEqual([]);
    expect(r.review[0].reason).toBe('cik_conflict');
  });

  it('a row with a ticker and a row without one still merge', () => {
    const r = planCompanyMerges([lilly, lillyCo]);
    expect(r.plans).toHaveLength(1);
  });

  it('sends rows that differ only by a subsidiary / division marker to review, never to a plan', () => {
    const a = row({ id: id(70), name: 'Novartis Pharma AG (UK)', data_quality_score: 65 });
    const b = row({ id: id(71), name: 'Novartis Pharma AG UK' });
    const r = planCompanyMerges([a, b]);
    expect(r.plans).toEqual([]);
    expect(r.review).toHaveLength(1);
    expect(r.review[0].reason).toBe('subsidiary_marker');
    expect(r.review[0].rows.map(x => x.id)).toEqual([a.id, b.id]);
  });

  it('a subsidiary or division row next to its parent is never merged and is listed for marker review', () => {
    const r = planCompanyMerges([pfizer, pfizerOnc, astra, alexion]);
    expect(r.plans).toEqual([]);
    // "Pfizer Oncology" → stem "pfizer" exists; "Alexion (AstraZeneca)" → stem "alexion" does not.
    expect(r.markerReview.map(m => [m.rowId, m.stemRowId])).toEqual([[pfizerOnc.id, pfizer.id]]);
    const onc = r.markerReview.find(m => m.rowId === pfizerOnc.id)!;
    expect(onc.markers).toEqual(['oncology']);
    expect(onc.stemRowName).toBe('Pfizer');
  });

  it('splitNameMarkers / differOnlyByMarker recognise parentheticals, division words and known subsidiaries', () => {
    expect(splitNameMarkers('Alexion (AstraZeneca)')).toEqual({ stem: 'alexion', markers: ['astrazeneca'] });
    expect(splitNameMarkers('Pfizer Oncology')).toEqual({ stem: 'pfizer', markers: ['oncology'] });
    expect(splitNameMarkers('Sanofi Consumer Health')).toEqual({ stem: 'sanofi', markers: ['consumer health'] });
    expect(splitNameMarkers('Roche Genentech')).toEqual({ stem: 'roche', markers: ['genentech'] });
    expect(splitNameMarkers('Kyowa Kirin Co., Ltd.')).toEqual({ stem: 'kyowa kirin', markers: [] });
    expect(splitNameMarkers('Genentech')).toEqual({ stem: 'genentech', markers: [] });
    expect(differOnlyByMarker('Pfizer', 'Pfizer Oncology')).toBe(true);
    expect(differOnlyByMarker('Pfizer Inc.', 'Pfizer (Upjohn)')).toBe(true);
    expect(differOnlyByMarker('Pfizer Inc.', 'Pfizer')).toBe(false);
    expect(differOnlyByMarker('Pfizer', 'Novartis')).toBe(false);
  });
});

describe('planCompanyMerges — hazard 1 parent-name stripping', () => {
  it('strips a parent name from a subsidiary row when the parent is a separate canonical row, and records it', () => {
    const r = planCompanyMerges([astra, astraPlc, alexion]);
    expect(r.plans).toHaveLength(1);
    expect(r.plans[0].canonicalId).toBe(astra.id);
    // Alexion is outside any plan: its strip is a singleton strip.
    expect(r.singletonStrips).toEqual([
      { rowId: alexion.id, rowName: 'Alexion (AstraZeneca)', alias: 'AstraZeneca', parentId: astra.id, parentName: 'AstraZeneca' },
    ]);
    expect(r.stats.aliasStrips).toBe(1);
  });

  it('keeps the subsidiary its own stem and variations that are nobody else\'s name', () => {
    const byKey = new Map<string, MergeCompanyRow>([
      ['astrazeneca', astra],
      ['alexionastrazeneca', alexion],
      ['alexion', row({ id: id(13), name: 'Alexion' })],
    ]);
    const { kept, strips } = stripParentAliases(alexion, 'alexionastrazeneca', alexion.name_variations!, byKey);
    expect(kept).toEqual(['Alexion (AstraZeneca)', 'Alexion', 'Alexion Pharmaceuticals']);
    expect(strips.map(s => s.alias)).toEqual(['AstraZeneca']);
  });

  it('strips inside a merge plan too: the union written to the canonical never carries another company\'s name', () => {
    const kite = row({ id: id(80), name: 'Kite (Gilead)', name_variations: ['Kite (Gilead)', 'Gilead', 'Kite'], data_quality_score: 95 });
    const kite2 = row({ id: id(81), name: 'Kite (Gilead) Inc.', name_variations: ['Kite (Gilead) Inc.', 'Gilead Sciences'] });
    const gilead = row({ id: id(82), name: 'Gilead', data_quality_score: 100, source_registry: null });
    const gileadSci = row({ id: id(83), name: 'Gilead Sciences', data_quality_score: 90, source_registry: null });
    const r = planCompanyMerges([kite, kite2, gilead, gileadSci]);
    const plan = r.plans.find(p => p.canonicalId === kite.id)!;
    expect(plan.aliasUnion).toEqual(['Kite (Gilead)', 'Kite', 'Kite (Gilead) Inc.']);
    expect(plan.aliasStrips.map(s => [s.alias, s.parentId])).toEqual([
      ['Gilead', gilead.id],
      ['Gilead Sciences', gileadSci.id],
    ]);
  });

  it('does not strip when no separate row carries that name', () => {
    const r = planCompanyMerges([alexion, row({ id: id(14), name: 'Alexion (AstraZeneca) Ltd' })]);
    expect(r.plans[0].aliasStrips).toEqual([]);
    expect(r.plans[0].aliasUnion).toContain('AstraZeneca');
  });

  it('skipAliasStrips leaves every variation in place', () => {
    const r = planCompanyMerges([astra, astraPlc, alexion], { skipAliasStrips: true });
    expect(r.singletonStrips).toEqual([]);
    expect(r.stats.aliasStrips).toBe(0);
  });
});

describe('repointPlan', () => {
  it('lists one UPDATE per referencing column per merged row, then the alias union and merged_into writes', () => {
    const r = planCompanyMerges([lilly, lillyCo, lillyInc]);
    const stmts = repointPlan(r.plans[0]);
    const perRow = COMPANY_REFERENCING_COLUMNS.length;
    expect(stmts).toHaveLength(perRow * 2 + 1 + 2);
    const deals = stmts.find(s => s.table === 'deals' && s.column === 'licensor_id' && s.mergedId === lillyCo.id)!;
    expect(deals.sql).toBe(`UPDATE deals SET licensor_id = '${lilly.id}' WHERE licensor_id = '${lillyCo.id}';`);
    const trials = stmts.find(s => s.table === 'company_trials' && s.mergedId === lillyCo.id)!;
    expect(trials.uniqueWith).toEqual(['nct_id']);
    expect(trials.sql).toContain('NOT EXISTS');
    expect(trials.sql).toContain('x.nct_id IS NOT DISTINCT FROM t.nct_id');
    const press = stmts.find(s => s.table === 'press_releases')!;
    expect(press.kind).toBe('uuid[]');
    expect(press.sql).toContain('array_replace(company_ids');
    const aliases = stmts.find(s => s.table === 'companies' && s.column === 'name_variations')!;
    expect(aliases.sql).toContain(`ARRAY['Eli Lilly', 'Lilly', 'Eli Lilly and Company', 'Eli Lilly & Co.', 'Eli Lilly & Company, Inc.']::text[]`);
    const merged = stmts.filter(s => s.table === 'companies' && s.column === 'merged_into');
    expect(merged.map(s => s.mergedId).sort()).toEqual([lillyCo.id, lillyInc.id]);
    expect(merged[0].sql).toContain('merged_into IS NULL');
  });

  it('the referencing-column list covers every table the doc names and nothing writes DELETE', () => {
    const keys = COMPANY_REFERENCING_COLUMNS.map(columnKey);
    for (const k of ['deals.licensor_id', 'deals.licensee_id', 'drug_owners.company_id', 'clinical_assets.company_id', 'clinical_assets.partner_company_id', 'counterparty_premiums.company_id', 'company_trials.company_id', 'company_financials.company_id', 'company_intent_signals.company_id', 'company_patents.company_id', 'licensing_signals.company_id', 'radar_deal_opportunities.acquirer_company_id', 'radar_deal_opportunities.asset_company_id', 'radar_score_snapshots.company_id', 'portfolio_deal_pipelines.partner_company_id', 'press_releases.company_ids']) {
      expect(keys).toContain(k);
    }
    expect(new Set(keys).size).toBe(keys.length);
    const r = planCompanyMerges([lilly, lillyCo]);
    for (const s of repointPlan(r.plans[0])) expect(s.sql).not.toMatch(/DELETE/i);
  });
});

describe('apply path refusals', () => {
  const env = { [MERGE_APPLY_ENV]: 'yes' };

  it('refuses without --apply, without --run-id, and without MERGE_APPLY=yes', () => {
    expect(() => assertApplyGuards({ apply: false, runId: 'r1', env })).toThrow(/--apply/);
    expect(() => assertApplyGuards({ apply: true, runId: null, env })).toThrow(/--run-id/);
    expect(() => assertApplyGuards({ apply: true, runId: 'r', env })).toThrow(/--run-id/);
    expect(() => assertApplyGuards({ apply: true, runId: 'merge-2026-09-26', env: {} })).toThrow(/MERGE_APPLY=yes/);
    expect(() => assertApplyGuards({ apply: true, runId: 'merge-2026-09-26', env: { MERGE_APPLY: 'true' } })).toThrow(/MERGE_APPLY=yes/);
    expect(() => assertApplyGuards({ apply: true, runId: 'merge-2026-09-26', env })).not.toThrow();
  });

  it('refuses when migration 124 is absent (company_merges table or merged_into column missing)', async () => {
    const missingTable = {
      from: (table: string) => ({
        select: () => ({
          limit: () => Promise.resolve(table === 'company_merges' ? { data: null, error: { code: '42P01', message: 'relation "company_merges" does not exist' } } : { data: [], error: null }),
        }),
      }),
    };
    await expect(assertMigrationPresent(missingTable)).rejects.toThrow(/migration 124 not applied \(company_merges/);

    const missingColumn = {
      from: (table: string) => ({
        select: (cols: string) => ({
          limit: () => Promise.resolve(table === 'companies' && cols === 'merged_into' ? { data: null, error: { code: '42703', message: 'column companies.merged_into does not exist' } } : { data: [], error: null }),
        }),
      }),
    };
    await expect(assertMigrationPresent(missingColumn)).rejects.toThrow(/merged_into/);

    const present = { from: () => ({ select: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) };
    await expect(assertMigrationPresent(present)).resolves.toBeUndefined();
  });
});

describe('resolver follows merged_into', () => {
  const mergedRow = {
    ...COMPANIES.find(c => c.id === UUID.lillyDup)!,
    merged_into: UUID.lilly,
  };
  const client = () =>
    createStubSupabase({
      companies: [...COMPANIES.filter(c => c.id !== UUID.lillyDup), mergedRow],
      drug_master: [],
      drug_aliases: [],
      drug_owners: [],
      deals: [],
    }) as unknown as Parameters<typeof resolveCompany>[0];

  it('an old (folded) id resolves to the canonical row with matchedOn "merged"', async () => {
    const r = await resolveCompany(client(), { id: UUID.lillyDup });
    expect(r.match?.id).toBe(UUID.lilly);
    expect(r.match?.matchedOn).toBe('merged');
    expect(r.match?.confidence).toBe(1);
    expect(r.match?.canonicalName).toBe('Eli Lilly');
  });

  it('a canonical id still reports matchedOn "id" and the schema without the column is tolerated', async () => {
    const r = await resolveCompany(client(), { id: UUID.lilly });
    expect(r.match?.matchedOn).toBe('id');
    const noColumn = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: { code: '42703', message: 'column does not exist' } }) }) }) }) };
    expect(await followMergedInto(noColumn, { id: UUID.lilly, name: 'Eli Lilly' } as CompanyRow)).toBeNull();
  });

  it('lookup by a folded id returns the canonical record', async () => {
    const r = await lookupCompany(client(), UUID.lillyDup);
    expect(r?.id).toBe(UUID.lilly);
    expect(r?.name).toBe('Eli Lilly');
  });

  it('a merged row never wins pickBestCompany even with a higher score', () => {
    const a = { id: id(90), name: 'X', data_quality_score: 100, merged_into: id(91) } as CompanyRow;
    const b = { id: id(91), name: 'X Inc', data_quality_score: 10 } as CompanyRow;
    expect(pickBestCompany([a, b])?.best.id).toBe(b.id);
  });
});
