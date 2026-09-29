/**
 * FDA orphan drug designations → asset_designations, assets and evidence.
 *
 * Source: the Orphan Drug Designations and Approvals database
 * (accessdata.fda.gov/scripts/opdlisting/oopd), which answers a form POST
 * with an HTML table marked as Excel. One request returns every designation
 * since a start date, with sponsor company and country. No model calls.
 *
 * For each designation:
 *   1. sponsor → company (normalised name match on companies.name and
 *      name_variations; a new industry company when the sponsor reads like a
 *      company rather than an institution);
 *   2. generic name → the sponsor's asset (name / alias / drug_master key);
 *      matched: stamp regulatory_designations + disclosure fields when empty;
 *      no asset and not FDA-approved: create a preclinical asset with
 *      asset_origin = 'designation' (the designation is the disclosure);
 *   3. always upsert the designation row keyed by (agency, designation_key).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { normalizeKey } from '@/lib/radar/drug-name';

export const FDA_OOPD_URL = 'https://www.accessdata.fda.gov/scripts/opdlisting/oopd/OOPD_Results.cfm';
export const FDA_OOPD_SEARCH_URL = 'https://www.accessdata.fda.gov/scripts/opdlisting/oopd/index.cfm';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
export const DESIGNATION_ASSET_CONFIDENCE = 35;

export interface FdaOrphanRow {
  generic_name: string;
  trade_name: string | null;
  designated_at: string | null;
  indication: string | null;
  status: string | null;
  withdrawn_at: string | null;
  approval_status: string | null;
  approved_indication: string | null;
  approved_at: string | null;
  exclusivity_end: string | null;
  sponsor_name: string;
  sponsor_country: string | null;
  sponsor_city: string | null;
}

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** mm/dd/yyyy → yyyy-mm-dd; anything else null. */
export function usDateToIso(s: string | null | undefined): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((s ?? '').trim());
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
}

/** Parse the export's HTML table. Header names come from the file, so column order is not assumed. */
export function parseFdaOrphanExport(html: string): FdaOrphanRow[] {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1]);
  if (rows.length === 0) return [];
  const headers = [...rows[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(m => decode(m[1]).toLowerCase());
  const col = (name: RegExp) => headers.findIndex(h => name.test(h));
  const iGeneric = col(/^generic name/), iTrade = col(/^trade name/), iDate = col(/^date designated/), iDesig = col(/^orphan designation$/),
    iStatus = col(/^orphan designation status/), iWithdrawn = col(/withdrawn or revoked/), iApprStatus = col(/^fda orphan approval status/),
    iApprInd = col(/^approved labeled indication/), iApprDate = col(/^marketing approval date/), iExcl = col(/^exclusivity end date/),
    iSponsor = col(/^sponsor company/), iCountry = col(/^sponsor country/), iCity = col(/^sponsor city/);
  if (iGeneric < 0 || iSponsor < 0) return [];
  const out: FdaOrphanRow[] = [];
  for (const r of rows.slice(1)) {
    const cells = [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => decode(m[1]));
    if (cells.length < headers.length - 1) continue;
    const get = (i: number) => (i >= 0 && i < cells.length ? cells[i] : '');
    const generic = get(iGeneric);
    const sponsor = get(iSponsor);
    if (!generic || !sponsor) continue;
    out.push({
      generic_name: generic,
      trade_name: get(iTrade) || null,
      designated_at: usDateToIso(get(iDate)),
      indication: get(iDesig) || null,
      status: get(iStatus) || null,
      withdrawn_at: usDateToIso(get(iWithdrawn)),
      approval_status: get(iApprStatus) || null,
      approved_indication: get(iApprInd) || null,
      approved_at: usDateToIso(get(iApprDate)),
      exclusivity_end: usDateToIso(get(iExcl)),
      sponsor_name: sponsor,
      sponsor_country: get(iCountry) || null,
      sponsor_city: get(iCity) || null,
    });
  }
  return out;
}

export async function fetchFdaOrphanExport(sinceIso: string, now = new Date()): Promise<{ ok: boolean; status: number; html: string }> {
  const toUs = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
  // A first GET sets the session cookie the results page expects.
  const jar: string[] = [];
  try {
    const pre = await fetchWithTimeout(FDA_OOPD_SEARCH_URL, { timeoutMs: 30_000, retries: 1, headers: { 'User-Agent': UA } });
    const setCookie = (pre.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    for (const c of setCookie) jar.push(c.split(';')[0]);
  } catch {
    // the POST may still work without a cookie
  }
  const body = new URLSearchParams({
    Product_name: '', sponsor_name: '', Designation: '',
    Designation_Start_Date: toUs(sinceIso), Designation_End_Date: toUs(now.toISOString().slice(0, 10)),
    Search_param: 'DESDATE', Output_Format: 'Excel', Sort_order: 'Date_Reverse_Order', RecordsPerPage: '25', newSearch: 'Run Search',
  });
  const res = await fetchWithTimeout(FDA_OOPD_URL, {
    method: 'POST', body, timeoutMs: 120_000, retries: 1,
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Referer: FDA_OOPD_SEARCH_URL, ...(jar.length ? { Cookie: jar.join('; ') } : {}) },
  });
  const html = res.ok ? await res.text() : '';
  return { ok: res.ok && html.includes('<table'), status: res.status, html };
}

// ── Sponsor → company ──────────────────────────────────────────────────

const LEGAL_RE = /\b(?:inc|incorporated|corp|corporation|co|company|ltd|limited|llc|l\.l\.c|plc|gmbh|ag|s\.?a\.?|s\.?r\.?l|b\.?v|n\.?v|a\/s|ab|oy|as|kk|k\.k|pte|pty|sas|sarl|holdings?|group|the)\b\.?/gi;
export function companyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(LEGAL_RE, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const INSTITUTION_RE = /\b(?:universit\w*|hospital\w*|institut\w*|college|school of|foundation|nih|national institutes|clinic|medical cent\w*|health system|cancer cent\w*|children'?s|department of|ministry|government|county|city of|trust|charit\w*|academy|research council|laborator(?:y|ies) of)\b/i;
/** Sponsors that are companies rather than institutions or individuals. */
export function sponsorLooksLikeCompany(name: string): boolean {
  if (INSTITUTION_RE.test(name)) return false;
  if (/\b(?:inc|corp|ltd|llc|plc|gmbh|ag|s\.?a\.?|b\.?v|pty|pte|limited|company|co\.|therapeutics|pharma|bio|sciences|medical|labs?|holdings|technolog|genetics|oncology|health)\b/i.test(name)) return true;
  // "Firstname Lastname, MD" style sponsors are individuals.
  if (/,\s*(?:m\.?d\.?|ph\.?d\.?|pharmd|d\.?o\.?)\b/i.test(name) || /^(?:dr\.?|prof\.?)\s/i.test(name)) return false;
  return name.split(/\s+/).length >= 2;
}

const COUNTRY_CODES: Record<string, string> = {
  'united states': 'US', usa: 'US', 'u.s.a.': 'US', 'united kingdom': 'GB', uk: 'GB', england: 'GB', scotland: 'GB', germany: 'DE', france: 'FR', switzerland: 'CH', japan: 'JP', china: 'CN', korea: 'KR', 'south korea': 'KR', 'republic of korea': 'KR', canada: 'CA', australia: 'AU', israel: 'IL', netherlands: 'NL', 'the netherlands': 'NL', belgium: 'BE', denmark: 'DK', sweden: 'SE', norway: 'NO', finland: 'FI', ireland: 'IE', italy: 'IT', spain: 'ES', austria: 'AT', india: 'IN', singapore: 'SG', taiwan: 'TW', 'hong kong': 'HK', brazil: 'BR', mexico: 'MX', 'new zealand': 'NZ', poland: 'PL', portugal: 'PT', 'czech republic': 'CZ', hungary: 'HU', turkey: 'TR', russia: 'RU', 'russian federation': 'RU', argentina: 'AR', 'south africa': 'ZA', 'united arab emirates': 'AE', luxembourg: 'LU', iceland: 'IS', greece: 'GR', estonia: 'EE', lithuania: 'LT', latvia: 'LV', slovenia: 'SI', croatia: 'HR', romania: 'RO', bulgaria: 'BG', cyprus: 'CY', malta: 'MT', bermuda: 'BM', 'cayman islands': 'KY', 'puerto rico': 'PR', chile: 'CL', colombia: 'CO', peru: 'PE', thailand: 'TH', malaysia: 'MY', indonesia: 'ID', philippines: 'PH', vietnam: 'VN', egypt: 'EG', 'saudi arabia': 'SA', jordan: 'JO', lebanon: 'LB', pakistan: 'PK', bangladesh: 'BD', 'sri lanka': 'LK', nigeria: 'NG', kenya: 'KE', ukraine: 'UA', serbia: 'RS', slovakia: 'SK',
};
export function countryCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/^[A-Z]{2}$/.test(s)) return s;
  return COUNTRY_CODES[s.toLowerCase()] ?? null;
}


/**
 * Asset name from a designation: the trade name when there is one, else the
 * generic name cut to its first clause. FDA generic names are often full
 * descriptions ("antibody drug conjugate composed of ..."), which make poor
 * row titles; the full text stays in the aliases and the excerpt.
 */
export function assetNameFromDesignation(generic: string, trade: string | null): string {
  const g = generic.replace(/\s+/g, ' ').trim();
  if (trade && trade.length >= 3 && trade.length <= 60 && !/^n\/?a$/i.test(trade)) return trade.trim();
  if (g.length <= 80) return g;
  const clause = g.split(/,|;| composed of | comprising | consisting | modified by | encoding | targeting | conjugated | derived from | expressing | \(/)[0].trim();
  if (clause.length >= 6 && clause.length <= 80) return clause;
  return `${g.slice(0, 77).trim()}...`;
}

export interface CompanyIndex { byKey: Map<string, { id: string; name: string }> }

/** Every non-merged company name and variation, keyed by companyKey. */
export async function loadCompanyIndex(supabase: SupabaseClient): Promise<CompanyIndex> {
  const byKey = new Map<string, { id: string; name: string }>();
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase.from('companies').select('id, name, name_variations, owner_type').is('merged_into', null).order('id').range(from, from + page - 1);
    if (error) throw new Error(`companies read: ${error.message}`);
    for (const r of (data ?? []) as Array<{ id: string; name: string; name_variations: string[] | null; owner_type: string | null }>) {
      for (const n of [r.name, ...(r.name_variations ?? [])]) {
        const k = companyKey(String(n ?? ''));
        if (k.length >= 3 && !byKey.has(k)) byKey.set(k, { id: r.id, name: r.name });
      }
    }
    if ((data ?? []).length < page) break;
  }
  return { byKey };
}

// ── Run ────────────────────────────────────────────────────────────────

export interface OrphanRunOptions {
  sinceIso?: string;
  now?: Date;
  /** Never create companies or assets (report only). */
  dryRun?: boolean;
  limit?: number;
}

export interface OrphanRunResult {
  fetched: number;
  parsed: number;
  designationsUpserted: number;
  companiesMatched: number;
  companiesCreated: number;
  assetsMatched: number;
  assetsCreated: number;
  approvedSkipped: number;
  noCompany: number;
  errors: string[];
  sample: Array<{ sponsor: string; generic: string; outcome: string }>;
}

interface AssetLite { id: string; asset_name: string; asset_aliases: string[] | null; drug_master_id: string | null; regulatory_designations: string[] | null; disclosure_url: string | null }

async function assetsForCompany(supabase: SupabaseClient, companyId: string): Promise<AssetLite[]> {
  const { data, error } = await supabase.from('clinical_assets').select('id, asset_name, asset_aliases, drug_master_id, regulatory_designations, disclosure_url').eq('company_id', companyId).limit(2000);
  if (error) throw new Error(`clinical_assets read: ${error.message}`);
  return (data ?? []) as AssetLite[];
}

async function drugIdFor(supabase: SupabaseClient, keys: string[]): Promise<string | null> {
  if (keys.length === 0) return null;
  const { data } = await supabase.from('drug_aliases').select('drug_id').in('alias_normalized', keys).limit(1);
  return (data?.[0] as { drug_id?: string } | undefined)?.drug_id ?? null;
}

async function drugHasClinicalAsset(supabase: SupabaseClient, drugId: string): Promise<boolean> {
  const { data } = await supabase.from('clinical_assets').select('id').eq('drug_master_id', drugId).neq('phase', 'preclinical').limit(1);
  return (data ?? []).length > 0;
}

export function designationKey(r: Pick<FdaOrphanRow, 'generic_name' | 'sponsor_name' | 'designated_at' | 'indication'>): string {
  return `${normalizeKey(r.generic_name)}|${companyKey(r.sponsor_name)}|${r.designated_at ?? ''}|${normalizeKey((r.indication ?? '').slice(0, 80))}`;
}

export async function runFdaOrphanIngestion(supabase: SupabaseClient, opts: OrphanRunOptions = {}): Promise<OrphanRunResult> {
  const now = opts.now ?? new Date();
  const r: OrphanRunResult = { fetched: 0, parsed: 0, designationsUpserted: 0, companiesMatched: 0, companiesCreated: 0, assetsMatched: 0, assetsCreated: 0, approvedSkipped: 0, noCompany: 0, errors: [], sample: [] };
  const exp = await fetchFdaOrphanExport(opts.sinceIso ?? '2015-01-01', now);
  if (!exp.ok) { r.errors.push(`FDA export HTTP ${exp.status}`); return r; }
  r.fetched = exp.html.length;
  let rows = parseFdaOrphanExport(exp.html);
  if (opts.limit) rows = rows.slice(0, opts.limit);
  r.parsed = rows.length;
  if (rows.length === 0) { r.errors.push('export parsed to 0 rows'); return r; }

  const index = await loadCompanyIndex(supabase);
  const assetCache = new Map<string, AssetLite[]>();
  const nowIso = now.toISOString();

  for (const row of rows) {
    try {
      const key = companyKey(row.sponsor_name);
      let company = index.byKey.get(key) ?? null;
      if (!company && sponsorLooksLikeCompany(row.sponsor_name) && !opts.dryRun) {
        const { data, error } = await supabase
          .from('companies')
          .insert({ name: row.sponsor_name, owner_type: 'industry', hq_country: countryCode(row.sponsor_country), data_sources: ['fda_orphan'], source_registry: 'fda_oopd' })
          .select('id, name')
          .single();
        if (error) { r.errors.push(`${row.sponsor_name}: company insert ${error.message}`); }
        else if (data) { company = { id: String(data.id), name: String(data.name) }; index.byKey.set(key, company); r.companiesCreated++; }
      } else if (company) {
        r.companiesMatched++;
      }

      const genericKey = normalizeKey(row.generic_name);
      const approved = !!row.approved_at || /approved/i.test(row.approval_status ?? '') && !/not fda approved/i.test(row.approval_status ?? '');
      let assetId: string | null = null;
      let outcome: 'matched' | 'created' | 'no_company' | 'approved_skip' | 'unmatched' = 'unmatched';

      if (!company) {
        outcome = 'no_company';
        r.noCompany++;
      } else {
        let assets = assetCache.get(company.id);
        if (!assets) { assets = await assetsForCompany(supabase, company.id); assetCache.set(company.id, assets); }
        const drugId = await drugIdFor(supabase, [genericKey, ...(row.trade_name ? [normalizeKey(row.trade_name)] : [])].filter(k => k.length >= 3));
        const hit = assets.find(a => [a.asset_name, ...(a.asset_aliases ?? [])].some(n => normalizeKey(String(n)) === genericKey) || (drugId && a.drug_master_id === drugId)) ?? null;
        if (hit) {
          assetId = hit.id;
          outcome = 'matched';
          r.assetsMatched++;
          if (!opts.dryRun) {
            const designations = new Set(hit.regulatory_designations ?? []);
            designations.add('fda_orphan');
            const patch: Record<string, unknown> = { regulatory_designations: [...designations] };
            if (!hit.disclosure_url && row.designated_at) {
              patch.disclosure_source_type = 'fda_orphan_designation';
              patch.disclosure_url = FDA_OOPD_SEARCH_URL;
              patch.disclosure_date = row.designated_at;
              patch.disclosure_excerpt = `FDA orphan drug designation (${row.designated_at}): ${row.generic_name} for ${row.indication ?? 'undisclosed indication'}; sponsor ${row.sponsor_name}.`.slice(0, 600);
              patch.disclosed_last_seen_at = row.designated_at;
            }
            const { error } = await supabase.from('clinical_assets').update(patch).eq('id', hit.id);
            if (error) r.errors.push(`${row.generic_name}: asset update ${error.message}`);
          }
        } else if (approved || row.withdrawn_at || /withdrawn|revoked/i.test(row.status ?? '')) {
          outcome = 'approved_skip';
          r.approvedSkipped++;
        } else if (drugId && await drugHasClinicalAsset(supabase, drugId)) {
          // A known drug in the clinic elsewhere: the sponsor's program is real but its stage is not preclinical by definition; record only.
          outcome = 'unmatched';
        } else if (!opts.dryRun) {
          const excerpt = `FDA orphan drug designation (${row.designated_at ?? 'date n/a'}): ${row.generic_name} for ${row.indication ?? 'undisclosed indication'}; sponsor ${row.sponsor_name}${row.sponsor_country ? `, ${row.sponsor_country}` : ''}.`.slice(0, 600);
          const assetName = assetNameFromDesignation(row.generic_name, row.trade_name);
          const aliases = [...new Set([row.generic_name.slice(0, 200), ...(row.trade_name ? [row.trade_name] : [])])].filter(a => a !== assetName);
          const insert = {
            company_id: company.id, company_name: company.name, asset_name: assetName, asset_aliases: aliases,
            phase: 'preclinical', stage_detail: null, trial_status: null, nct_ids: [], trial_count: 0, enrollment_total: 0,
            first_posted_date: row.designated_at ?? nowIso.slice(0, 10), last_update_date: row.designated_at ?? nowIso.slice(0, 10),
            indication_specific: row.indication ? row.indication.replace(/^treatment of\s+/i, '').slice(0, 120) : null, indications_all: row.indication ? [row.indication.slice(0, 120)] : [],
            partnership_status: 'unpartnered', partnership_basis: 'no_evidence', partnership_confidence: 30,
            ownership_status: 'originator', ownership_evidence: { rule: 'designation_sponsor', agency: 'fda', designated_at: row.designated_at }, ownership_checked_at: nowIso,
            owner_type: 'industry', data_sources: ['fda_orphan'], confidence_score: DESIGNATION_ASSET_CONFIDENCE,
            classification_status: 'unclassified', regulatory_designations: ['fda_orphan'],
            drug_master_id: drugId, drug_resolution_status: drugId ? 'resolved' : 'unresolved',
            asset_origin: 'designation', disclosure_source_type: 'fda_orphan_designation', disclosure_accession: designationKey(row),
            disclosure_url: FDA_OOPD_SEARCH_URL, disclosure_date: row.designated_at ?? nowIso.slice(0, 10), disclosure_excerpt: excerpt, disclosed_last_seen_at: row.designated_at ?? nowIso.slice(0, 10),
          };
          const { data, error } = await supabase.from('clinical_assets').upsert(insert, { onConflict: 'company_name,asset_name', ignoreDuplicates: true }).select('id');
          if (error) { r.errors.push(`${row.generic_name}: asset insert ${error.message}`); }
          else if (data && data.length) { assetId = String(data[0].id); outcome = 'created'; r.assetsCreated++; assets.push({ id: assetId, asset_name: assetName, asset_aliases: aliases, drug_master_id: drugId, regulatory_designations: ['fda_orphan'], disclosure_url: FDA_OOPD_SEARCH_URL }); }
        } else {
          outcome = 'created';
        }
      }

      if (!opts.dryRun) {
        const { error } = await supabase.from('asset_designations').upsert({
          agency: 'fda', designation_type: 'orphan', designation_key: designationKey(row), generic_name: row.generic_name, generic_key: genericKey, trade_name: row.trade_name,
          indication: row.indication, designated_at: row.designated_at, status: row.status, withdrawn_at: row.withdrawn_at, approved_at: row.approved_at, approved_indication: row.approved_indication,
          sponsor_name: row.sponsor_name, sponsor_country: countryCode(row.sponsor_country) ?? row.sponsor_country, company_id: company?.id ?? null, asset_id: assetId, match_status: outcome,
          source_url: FDA_OOPD_SEARCH_URL, raw: row, last_seen_at: nowIso,
        }, { onConflict: 'agency,designation_key' });
        if (error) r.errors.push(`${row.generic_name}: designation upsert ${error.message}`);
        else r.designationsUpserted++;
      }
      if (r.sample.length < 15 && (outcome === 'created' || outcome === 'matched')) r.sample.push({ sponsor: row.sponsor_name, generic: row.generic_name, outcome });
    } catch (err) {
      r.errors.push(`${row.generic_name}: ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`);
      if (r.errors.length > 50) break;
    }
  }
  return r;
}
