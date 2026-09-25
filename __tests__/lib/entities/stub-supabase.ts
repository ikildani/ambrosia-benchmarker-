/**
 * In-memory stand-in for the subset of supabase-js the entity resolvers use.
 * Evaluates eq / in / ilike / like / not / gte / lte / or / order / limit /
 * maybeSingle against fixture rows so the resolve order can be tested
 * without a database. `calls` records every query for assertions.
 */

type Row = Record<string, unknown>;

export interface StubCall {
  table: string;
  ops: Array<{ op: string; args: unknown[] }>;
}

function likeToRegex(pattern: string): RegExp {
  let out = '^';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\' && i + 1 < pattern.length) {
      out += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } else if (ch === '%') out += '.*';
    else if (ch === '_') out += '.';
    else out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(out + '$', 'i');
}

function unquote(v: string): string {
  const t = v.trim();
  if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  return t;
}

/** Split a PostgREST or() string on commas outside quotes/braces. */
function splitOr(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  let depth = 0;
  for (const ch of s) {
    if (ch === '"') inQ = !inQ;
    if (!inQ && (ch === '{' || ch === '(')) depth++;
    if (!inQ && (ch === '}' || ch === ')')) depth--;
    if (ch === ',' && !inQ && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function evalOrTerm(row: Row, term: string): boolean {
  const m = term.match(/^([a-z_]+)\.(ilike|like|eq|cs)\.([^]*)$/);
  if (!m) throw new Error(`stub: unsupported or() term ${term}`);
  const [, col, op, rawVal] = m;
  const v = row[col];
  if (op === 'ilike' || op === 'like') return typeof v === 'string' && likeToRegex(unquote(rawVal)).test(v);
  if (op === 'eq') return String(v ?? '') === unquote(rawVal);
  if (op === 'cs') {
    const inner = rawVal.replace(/^\{|\}$/g, '');
    const wanted = unquote(inner);
    return Array.isArray(v) && v.includes(wanted);
  }
  return false;
}

export function createStubSupabase(tables: Record<string, Row[]>) {
  const calls: StubCall[] = [];

  function from(table: string) {
    const call: StubCall = { table, ops: [] };
    calls.push(call);
    let single = false;

    const run = (): Row[] => {
      let rows = [...(tables[table] ?? [])];
      let limit: number | null = null;
      for (const { op, args } of call.ops) {
        switch (op) {
          case 'select':
            break;
          case 'eq':
            rows = rows.filter(r => r[args[0] as string] === args[1]);
            break;
          case 'in':
            rows = rows.filter(r => (args[1] as unknown[]).includes(r[args[0] as string]));
            break;
          case 'ilike':
          case 'like': {
            const re = likeToRegex(args[1] as string);
            rows = rows.filter(r => typeof r[args[0] as string] === 'string' && re.test(r[args[0] as string] as string));
            break;
          }
          case 'not': {
            const [col, cmp, val] = args as [string, string, unknown];
            if (cmp === 'is') rows = rows.filter(r => r[col] !== val);
            else if (cmp === 'in') {
              const set = String(val).replace(/^\(|\)$/g, '').split(',').map(unquote);
              rows = rows.filter(r => !set.includes(String(r[col])));
            } else if (cmp === 'ilike') {
              const re = likeToRegex(String(val));
              rows = rows.filter(r => !(typeof r[col] === 'string' && re.test(r[col] as string)));
            } else throw new Error(`stub: unsupported not(${cmp})`);
            break;
          }
          case 'gte':
            rows = rows.filter(r => String(r[args[0] as string] ?? '') >= String(args[1]));
            break;
          case 'lte':
            rows = rows.filter(r => String(r[args[0] as string] ?? '') <= String(args[1]));
            break;
          case 'or': {
            const terms = splitOr(args[0] as string);
            rows = rows.filter(r => terms.some(t => evalOrTerm(r, t)));
            break;
          }
          case 'order': {
            const [col, opts] = args as [string, { ascending?: boolean } | undefined];
            const asc = opts?.ascending !== false;
            rows.sort((a, b) => {
              const x = a[col] as number | string | null;
              const y = b[col] as number | string | null;
              if (x == null && y == null) return 0;
              if (x == null) return 1;
              if (y == null) return -1;
              return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1);
            });
            break;
          }
          case 'limit':
            limit = args[0] as number;
            break;
          case 'maybeSingle':
            single = true;
            break;
          default:
            throw new Error(`stub: unsupported op ${op}`);
        }
      }
      return limit != null ? rows.slice(0, limit) : rows;
    };

    const builder: Record<string, unknown> = {};
    const chain = (op: string) => (...args: unknown[]) => {
      call.ops.push({ op, args });
      return builder;
    };
    for (const op of ['select', 'eq', 'in', 'ilike', 'like', 'not', 'gte', 'lte', 'or', 'order', 'limit']) builder[op] = chain(op);
    builder.maybeSingle = () => {
      call.ops.push({ op: 'maybeSingle', args: [] });
      const rows = run();
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    };
    builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      try {
        const rows = run();
        return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve, reject);
      } catch (e) {
        return Promise.reject(e).then(resolve, reject);
      }
    };
    return builder;
  }

  return { from, calls };
}

export type StubSupabase = ReturnType<typeof createStubSupabase>;

// ─── Fixtures ────────────────────────────────────────────────────────────────

export const UUID = {
  lilly: '3c849b12-4a78-4d75-b1c3-e3e5a9d6a83a',
  lillyDup: '3c849b12-4a78-4d75-b1c3-e3e5a9d6a83b',
  roche: '11c02925-0000-4000-8000-000000000001',
  rocheHolding: 'b0bde7cb-0000-4000-8000-000000000002',
  pfizer: '946a722b-0000-4000-8000-000000000003',
  pfizerOnc: '946a722b-0000-4000-8000-000000000004',
  kyowa: '80badeac-0000-4000-8000-000000000005',
  kyowaDup1: '80badeac-0000-4000-8000-000000000006',
  kyowaDup2: '80badeac-0000-4000-8000-000000000007',
  merck: '76beeae2-0000-4000-8000-000000000008',
  vertex: '76beeae2-0000-4000-8000-000000000009',
  pembro: '406be07b-0000-4000-8000-000000000010',
  nivo: '406be07b-0000-4000-8000-000000000011',
  pembroInternal: '406be07b-0000-4000-8000-000000000012',
  deal1: 'cbb8b877-0000-4000-8000-000000000020',
  deal2: 'cbb8b877-0000-4000-8000-000000000021',
  dealRejected: 'cbb8b877-0000-4000-8000-000000000022',
  dealSynthetic: 'cbb8b877-0000-4000-8000-000000000023',
  dealNonCanonical: 'cbb8b877-0000-4000-8000-000000000024',
};

const company = (o: Partial<Row> & { id: string; name: string }): Row => ({
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
  ...o,
});

export const COMPANIES: Row[] = [
  company({ id: UUID.lilly, name: 'Eli Lilly', name_variations: ['Eli Lilly and Company', 'Lilly', 'Eli Lilly & Co.', 'Eli Lilly'], company_type: 'large_pharma', hq_country: 'US', ticker: 'LLY', cik: '59478', data_quality_score: 100, total_annual_revenue: 34e9, deals_last_24mo: 12 }),
  company({ id: UUID.lillyDup, name: 'Eli Lilly and Company', data_quality_score: 0 }),
  company({ id: UUID.roche, name: 'Roche', name_variations: ['Roche Holding', 'F. Hoffmann-La Roche', 'Genentech', 'Roche'], company_type: 'large_pharma', hq_country: 'CH', data_quality_score: 100, deals_last_24mo: 20 }),
  company({ id: UUID.rocheHolding, name: 'Roche Holding AG', name_variations: ['Roche Holding AG', 'Roche'], company_type: 'large_pharma', data_quality_score: 65 }),
  company({ id: UUID.pfizer, name: 'Pfizer', name_variations: ['Pfizer Inc.', 'Pfizer Inc', 'Pfizer'], company_type: 'large_pharma', ticker: 'PFE', sec_cik: '0000078003', data_quality_score: 100, deals_last_24mo: 15 }),
  company({ id: UUID.pfizerOnc, name: 'Pfizer Oncology', name_variations: ['Pfizer Oncology'], company_type: 'large_pharma', data_quality_score: 40 }),
  company({ id: UUID.kyowa, name: 'Kyowa Kirin', name_variations: ['Kyowa Kirin', 'Kyowa Hakko Kirin'], company_type: 'large_pharma', data_quality_score: 75, deals_last_24mo: 1 }),
  company({ id: UUID.kyowaDup1, name: 'Kyowa Kirin Co., Ltd.', data_quality_score: 5 }),
  company({ id: UUID.kyowaDup2, name: 'Kyowa Kirin Inc.', data_quality_score: 0 }),
  company({ id: UUID.merck, name: 'Merck', name_variations: ['Merck & Co.', 'MSD', 'Merck Sharp & Dohme', 'Merck'], company_type: 'large_pharma', data_quality_score: 100 }),
  company({ id: UUID.vertex, name: 'Vertex Pharmaceuticals Incorporated', name_variations: ['Vertex Pharmaceuticals Incorporated', 'Vertex'], company_type: 'large_biotech', data_quality_score: 45 }),
];

export const DRUGS: Row[] = [
  { id: UUID.pembro, preferred_name: 'pembrolizumab', inn: 'pembrolizumab', unii: 'DPT0O3T46P', chembl_id: 'CHEMBL3137343', modality: 'antibody', target: 'PD-1', max_phase: 'approved', is_combination: false, originator_company_id: UUID.merck, source: 'chembl', confidence: 90, mechanism: 'PD-1 blocker', drugbank_id: null, cas_number: null, pubchem_cid: null, component_drug_ids: [] },
  { id: UUID.nivo, preferred_name: 'nivolumab', inn: 'nivolumab', unii: '31YO63LBSN', chembl_id: 'CHEMBL2108738', modality: 'antibody', target: 'PD-1', max_phase: 'approved', is_combination: false, originator_company_id: null, source: 'chembl', confidence: 90, mechanism: null, drugbank_id: null, cas_number: null, pubchem_cid: null, component_drug_ids: [] },
  { id: UUID.pembroInternal, preferred_name: 'Pembrolizumab', inn: null, unii: null, chembl_id: null, modality: null, target: null, max_phase: null, is_combination: false, originator_company_id: null, source: 'internal', confidence: 30, mechanism: null, drugbank_id: null, cas_number: null, pubchem_cid: null, component_drug_ids: [] },
];

export const ALIASES: Row[] = [
  { id: 'al1', drug_id: UUID.pembro, alias: 'pembrolizumab', alias_normalized: 'pembrolizumab', alias_type: 'inn' },
  { id: 'al2', drug_id: UUID.pembro, alias: 'Keytruda', alias_normalized: 'keytruda', alias_type: 'brand' },
  { id: 'al3', drug_id: UUID.pembro, alias: 'MK-3475', alias_normalized: 'mk3475', alias_type: 'code' },
  { id: 'al4', drug_id: UUID.nivo, alias: 'nivolumab', alias_normalized: 'nivolumab', alias_type: 'inn' },
  { id: 'al5', drug_id: UUID.nivo, alias: 'Opdivo', alias_normalized: 'opdivo', alias_type: 'brand' },
  { id: 'al6', drug_id: UUID.pembroInternal, alias: 'Pembrolizumab', alias_normalized: 'pembrolizumab', alias_type: 'inn' },
  { id: 'al7', drug_id: UUID.pembro, alias: 'lambrolizumab', alias_normalized: 'lambrolizumab', alias_type: 'synonym' },
];

export const OWNERS: Row[] = [{ id: 'ow1', drug_id: UUID.pembro, company_id: UUID.merck, role: 'originator', territory: 'global' }];

const deal = (o: Partial<Row> & { id: string }): Row => ({
  licensor_name: null,
  licensor_id: null,
  licensee_name: null,
  licensee_id: null,
  asset_name: null,
  announced_date: null,
  deal_type: 'license',
  phase_at_signing: 'phase_2',
  therapeutic_area: 'oncology',
  indication_specific: null,
  indication_category: null,
  upfront_usd: null,
  milestones_total_usd: null,
  total_deal_value_usd: null,
  royalty_low_pct: null,
  royalty_high_pct: null,
  terms_disclosed: true,
  source_url: null,
  press_release_url: null,
  verification_status: 'verified',
  is_synthetic: false,
  is_canonical: true,
  ...o,
});

export const DEALS: Row[] = [
  deal({ id: UUID.deal1, licensor_name: 'Kyowa Kirin Co., Ltd.', licensor_id: UUID.kyowaDup1, licensee_name: 'Eli Lilly and Company', licensee_id: UUID.lilly, asset_name: 'Keytruda', announced_date: '2026-03-01', upfront_usd: 50_000_000, milestones_total_usd: 450_000_000, total_deal_value_usd: 500_000_000, royalty_low_pct: 8, royalty_high_pct: 12, source_url: 'https://example.com/pr' }),
  deal({ id: UUID.deal2, licensor_name: 'Kyowa Kirin', licensor_id: UUID.kyowa, licensee_name: 'Pfizer', licensee_id: UUID.pfizer, asset_name: 'KHK-1', announced_date: '2025-01-15', upfront_usd: 10_000_000 }),
  deal({ id: UUID.dealRejected, licensor_name: 'Kyowa Kirin', licensee_name: 'Eli Lilly', announced_date: '2026-03-01', verification_status: 'rejected' }),
  deal({ id: UUID.dealSynthetic, licensor_name: 'Kyowa Kirin', licensee_name: 'Eli Lilly', announced_date: '2026-03-01', is_synthetic: true }),
  deal({ id: UUID.dealNonCanonical, licensor_name: 'Kyowa Kirin', licensee_name: 'Eli Lilly', announced_date: '2026-03-02', is_canonical: false }),
];

export function fixtureClient(overrides: Partial<Record<string, Row[]>> = {}) {
  return createStubSupabase({
    companies: COMPANIES,
    drug_master: DRUGS,
    drug_aliases: ALIASES,
    drug_owners: OWNERS,
    deals: DEALS,
    ...overrides,
  });
}
