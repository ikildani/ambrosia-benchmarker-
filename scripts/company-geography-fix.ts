/**
 * Re-derives headquarters country for Search & Evaluation pool companies from independent evidence
 * (lib/radar/company-geography.ts) and, with --apply, writes the changes.
 *
 *   npx tsx scripts/company-geography-fix.ts                 # dry run: plan to scripts/output/
 *   npx tsx scripts/company-geography-fix.ts --apply         # write companies + their programs
 *   npx tsx scripts/company-geography-fix.ts --limit 200     # first N companies only
 *
 * Network: SEC EDGAR submissions (companies with a CIK) and the Wikidata API, both free; answers are
 * cached in scripts/output/geo-cache.json so a rerun does not refetch. No AI calls.
 * Apply writes companies.headquarters_country / headquarters_region, re-points the company's programs
 * whose region came from the company (originator_region_source IS NULL), and logs every change in
 * radar_trust_fix_log (step GEOGRAPHY_FIX_STEP; old values kept for revert).
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { deriveRegion } from '../lib/ingestion/company-geography';
import { normalizeCountryCode } from '../lib/radar/asset-universe';
import {
  GEOGRAPHY_FIX_STEP, decideCompanyCountry, edgarAddressCountry,
  type GeographyDecision, type SiteCount,
} from '../lib/radar/company-geography';

const OUT = 'scripts/output';
const CACHE = `${OUT}/geo-cache.json`;
const SEC_UA = process.env.SEC_USER_AGENT?.trim() || 'Solidus research@ambrosiaventures.co';
const WD_UA = 'Solidus/1.0 (research@ambrosiaventures.co)';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;

interface Company { id: string; name: string; cik: string | null; stored: string | null; storedSource: string | null }
type Cache = { edgar: Record<string, string | null>; wikidata: Record<string, string | null> };
const cache: Cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : { edgar: {}, wikidata: {} };
const saveCache = () => writeFileSync(CACHE, JSON.stringify(cache));

async function poolCompanies(supabase: SupabaseClient): Promise<Company[]> {
  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('radar_thesis_eligible_assets').select('company_id').range(from, from + 999);
    if (error) throw new Error(`pool read: ${error.message}`);
    for (const r of data ?? []) if (r.company_id) ids.add(r.company_id as string);
    if ((data ?? []).length < 1000) break;
  }
  const out: Company[] = [];
  const list = [...ids];
  for (let i = 0; i < list.length; i += 300) {
    const { data, error } = await supabase.from('companies')
      .select('id, name, sec_cik, cik, headquarters_country, hq_country, data_sources').in('id', list.slice(i, i + 300));
    if (error) throw new Error(`companies read: ${error.message}`);
    for (const c of data ?? []) {
      out.push({
        id: c.id as string, name: c.name as string,
        cik: (c.sec_cik as string | null) ?? (c.cik as string | null),
        stored: normalizeCountryCode(c.headquarters_country as string | null) ?? normalizeCountryCode(c.hq_country as string | null),
        storedSource: ((c.data_sources as string[] | null) ?? [])[0] ?? null,
      });
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

async function siteCounts(supabase: SupabaseClient, companyIds: string[]): Promise<Map<string, SiteCount[]>> {
  const by = new Map<string, Map<string, number>>();
  for (let i = 0; i < companyIds.length; i += 200) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('company_trials').select('company_id, locations_countries')
        .in('company_id', companyIds.slice(i, i + 200)).range(from, from + 999);
      if (error) throw new Error(`company_trials read: ${error.message}`);
      for (const t of data ?? []) {
        const m = by.get(t.company_id as string) ?? new Map<string, number>();
        for (const raw of (t.locations_countries as string[] | null) ?? []) {
          const iso = normalizeCountryCode(raw);
          if (iso) m.set(iso, (m.get(iso) ?? 0) + 1);
        }
        by.set(t.company_id as string, m);
      }
      if ((data ?? []).length < 1000) break;
    }
  }
  return new Map([...by].map(([k, m]) => [k, [...m].map(([iso, n]) => ({ iso, n }))]));
}

async function edgarCountry(cik: string): Promise<string | null> {
  const key = cik.replace(/\D/g, '').padStart(10, '0');
  if (key in cache.edgar) return cache.edgar[key];
  const res = await fetch(`https://data.sec.gov/submissions/CIK${key}.json`, { headers: { 'User-Agent': SEC_UA, Accept: 'application/json' } });
  await sleep(120);
  const iso = res.ok ? edgarAddressCountry(((await res.json()) as { addresses?: { business?: Record<string, string | null> } }).addresses?.business) : null;
  cache.edgar[key] = iso;
  return iso;
}

const BUSINESS = /pharma|biotech|bio-?pharm|therapeutic|laborator|drug|medic|vaccine|biolog|life science|health|company|corporation|manufacturer|business|enterprise|conglomerate|chemical/i;
const cleanName = (n: string) => n.replace(/\(.*?\)/g, ' ')
  .replace(/,?\s*\b(inc|incorporated|ltd|limited|llc|plc|corp|corporation|co|company|gmbh|ag|s\.?a\.?|s\.?p\.?a\.?|a\/s|ab|bv|b\.v\.|nv|n\.v\.|k\.k\.|holdings?|group|sas|srl|pty|oy|asa)\b\.?/gi, ' ')
  .replace(/[.,]+$/, '').replace(/\s+/g, ' ').trim();

async function wd(params: Record<string, string>): Promise<any> {
  const url = 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({ format: 'json', ...params });
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': WD_UA } });
    if (res.ok) return res.json();
    await sleep(1500);
  }
  return null;
}
const isoByQid = new Map<string, string | null>();
async function qidIso(qid: string): Promise<string | null> {
  if (!isoByQid.has(qid)) {
    const j = await wd({ action: 'wbgetclaims', entity: qid, property: 'P297' });
    isoByQid.set(qid, j?.claims?.P297?.[0]?.mainsnak?.datavalue?.value ?? null);
  }
  return isoByQid.get(qid)!;
}

/** Wikidata country for an exact-label business match: HQ location's country, else the item's country. */
async function wikidataCountry(name: string): Promise<string | null> {
  const q = cleanName(name);
  if (q.length < 3) return null;
  if (q in cache.wikidata) return cache.wikidata[q];
  let iso: string | null = null;
  const s = await wd({ action: 'wbsearchentities', search: q, language: 'en', type: 'item', limit: '3' });
  const hit = (s?.search ?? []).find((x: any) => BUSINESS.test(x.description ?? '') && cleanName(x.label ?? '').toLowerCase() === q.toLowerCase());
  if (hit) {
    const e = (await wd({ action: 'wbgetentities', ids: hit.id, props: 'claims' }))?.entities?.[hit.id];
    const first = (p: string) => e?.claims?.[p]?.[0]?.mainsnak?.datavalue?.value?.id as string | undefined;
    const hq = first('P159');
    if (hq) {
      const c = (await wd({ action: 'wbgetclaims', entity: hq, property: 'P17' }))?.claims?.P17?.[0]?.mainsnak?.datavalue?.value?.id;
      if (c) iso = await qidIso(c);
    }
    if (!iso && first('P17')) iso = await qidIso(first('P17')!);
  }
  cache.wikidata[q] = iso;
  await sleep(100);
  return iso;
}

async function applyChanges(supabase: SupabaseClient, changes: Array<{ c: Company; d: GeographyDecision }>) {
  let companies = 0, programs = 0;
  for (const { c, d } of changes) {
    const region = d.country ? deriveRegion(d.country) : 'unknown';
    const regionOrNull = region === 'unknown' ? null : region;
    const { error } = await supabase.from('companies')
      .update({ headquarters_country: d.country, headquarters_region: regionOrNull }).eq('id', c.id);
    if (error) { console.error(`  ${c.name}: ${error.message}`); continue; }
    companies++;
    const { data: moved, error: aErr } = await supabase.from('clinical_assets')
      .update({ originator_country: d.country, originator_region: regionOrNull })
      .eq('company_id', c.id).is('originator_region_source', null).select('id');
    if (aErr) console.error(`  ${c.name} programs: ${aErr.message}`);
    programs += moved?.length ?? 0;
    await supabase.from('radar_trust_fix_log').insert({
      company_id: c.id, step: GEOGRAPHY_FIX_STEP,
      old_values: { headquarters_country: c.stored, source: c.storedSource },
      new_values: { headquarters_country: d.country, headquarters_region: regionOrNull, basis: d.basis, reason: d.reason, programs: moved?.length ?? 0 },
    });
  }
  console.log(`Applied: ${companies} companies, ${programs} programs re-pointed (log step ${GEOGRAPHY_FIX_STEP}).`);
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  mkdirSync(OUT, { recursive: true });
  const all = (await poolCompanies(supabase)).slice(0, limit);
  console.log(`${all.length} pool companies`);
  const sites = await siteCounts(supabase, all.map(c => c.id));

  const plan: Array<{ c: Company; d: GeographyDecision }> = [];
  const tally: Record<string, number> = {};
  for (const [i, c] of all.entries()) {
    const edgar = c.cik ? await edgarCountry(c.cik) : null;
    const wikidata = await wikidataCountry(c.name);
    const d = decideCompanyCountry({ name: c.name, stored: c.stored, storedSource: c.storedSource, edgar, wikidata, sites: sites.get(c.id) ?? [] });
    tally[d.reason] = (tally[d.reason] ?? 0) + 1;
    if (d.changed) plan.push({ c, d });
    if (i % 250 === 249) { saveCache(); console.log(`  ${i + 1}/${all.length}`, tally); }
  }
  saveCache();
  const file = `${OUT}/company-geography-plan-${new Date().toISOString().slice(0, 10)}.tsv`;
  writeFileSync(file, ['company_id\tname\tstored\tstored_source\tnew\treason\tbasis',
    ...plan.map(({ c, d }) => [c.id, c.name, c.stored ?? '', c.storedSource ?? '', d.country ?? '', d.reason, d.basis.join(',')].join('\t'))].join('\n') + '\n');
  console.log('Decisions:', tally);
  console.log(`${plan.length} changes planned → ${file}`);
  if (apply) await applyChanges(supabase, plan);
  else console.log('Dry run; rerun with --apply to write.');
}

main().catch(err => { console.error(err); process.exit(1); });
