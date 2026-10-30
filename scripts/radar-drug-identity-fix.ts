/**
 * Drug identity repair for Search & Evaluation (migration 173).
 *
 *   npx tsx scripts/radar-drug-identity-fix.ts                 # dry run → stats + plan files in OUT_DIR
 *   npx tsx scripts/radar-drug-identity-fix.ts --stage         # also upload the plan to radar_drug_identity_plan
 *
 * Applying is SQL-side and reversible: radar_drug_identity_apply(batch) (migration 173) copies each
 * row's previous drug_master_id / status / confidence into radar_drug_identity_log before changing it.
 * Nothing here writes to clinical_assets, drug_master or drug_aliases directly.
 *
 * Rules (lib/radar/drug-identity.ts): an asset keeps or gains a drug_master link only when its own
 * name (or, when the name names nothing registered, its own aliases, unambiguously) writes a key
 * the node is trusted to carry. Registry nodes trust registry aliases + preferred name + INN + keys
 * co-written beside them in one asset name; internal nodes trust their preferred name + INN.
 *
 * Env: ENV_FILE (default .env.local), OUT_DIR (default ./tmp/drug-identity).
 * No paid API calls.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: process.env.ENV_FILE ?? '.env.local' });
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  addTrustedKey,
  buildTrustedIndex,
  coWrittenKeys,
  isRegistrySource,
  judgeAssetLink,
  keyVariants,
  type AliasIdentityRow,
  type DrugIdentityRow,
  type LinkVerdict,
} from '../lib/radar/drug-identity';
import { codePrefixOf } from '../lib/radar/ownership';
import { containsCJK, looksLikeInn, normalizeDrugName, normalizeKey, splitCombination, classifyAlias, inferModalityFromName } from '../lib/radar/drug-name';
import { pickNcitConcept, searchNcit, usefulSynonyms, type NcitConcept } from '../lib/radar/ncit';
import { existsSync, readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { uniqueDrugForKeys } from '../lib/radar/drug-identity';

const OUT = process.env.OUT_DIR ?? 'tmp/drug-identity';
const STAGE = process.argv.includes('--stage');
const NO_NCIT = process.argv.includes('--no-ncit');
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface Drug extends DrugIdentityRow {
  confidence: number;
  ncit_code?: string | null;
  unii?: string | null;
  chembl_id?: string | null;
  component_drug_ids: string[] | null;
  max_phase: string | null;
  originator_company_id: string | null;
}
interface Alias extends AliasIdentityRow { id: string; alias_normalized: string; alias_type: string }
interface Asset {
  id: string; company_id: string | null; company_name: string | null; owner_type: string | null; asset_name: string;
  asset_aliases: string[] | null; drug_master_id: string | null; drug_resolution_status: string | null;
  drug_resolution_confidence: number | null; ownership_status: string | null; partner_company_id: string | null;
}

async function paged<T>(supabase: SupabaseClient, table: string, cols: string, order = 'id'): Promise<T[]> {
  const out: T[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let res: { data: unknown[] | null; error: { message: string } | null } = { data: null, error: null };
    for (let attempt = 1; attempt <= 6; attempt++) {
      res = await supabase.from(table).select(cols).order(order).range(from, from + PAGE - 1);
      if (!res.error) break;
      await sleep(1500 * attempt);
    }
    if (res.error) throw new Error(`${table} read failed at ${from}: ${res.error.message}`);
    const rows = (res.data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
    if (from % 20000 === 0) console.log(`  ${table}: ${out.length}`);
  }
  return out;
}

/** "Akeso" / "Akesobio Australia Pty Ltd" / "Merck Sharp & Dohme LLC": first significant name token. */
function companyRoot(name: string | null): string {
  const t = (name ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !['the', 'a'].includes(w));
  return (t[0] ?? '').slice(0, 5);
}

export interface PlanRow {
  asset_id: string;
  action: 'keep_status' | 'relink' | 'unlink' | 'new_link' | 'status_only';
  verdict: LinkVerdict;
  old_drug_master_id: string | null;
  new_drug_master_id: string | null;
  new_status: string;
  new_confidence: number;
  key: string | null;
  via: string | null;
  new_combo_components: string[] | null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  mkdirSync(OUT, { recursive: true });

  console.log('loading drug_master, drug_aliases, clinical_assets …');
  const drugs = await paged<Drug>(supabase, 'drug_master', 'id, preferred_name, inn, source, confidence, is_combination, component_drug_ids, max_phase, originator_company_id, ncit_code, unii, chembl_id');
  const aliases = await paged<Alias>(supabase, 'drug_aliases', 'id, drug_id, alias, alias_normalized, alias_type, source');
  const assets = await paged<Asset>(supabase, 'clinical_assets', 'id, company_id, company_name, owner_type, asset_name, asset_aliases, drug_master_id, drug_resolution_status, drug_resolution_confidence, ownership_status, partner_company_id');
  console.log(`drugs ${drugs.length}, aliases ${aliases.length}, assets ${assets.length}`);

  const drugById = new Map(drugs.map(d => [d.id, d]));
  const aliasesByDrug = new Map<string, Alias[]>();
  for (const a of aliases) {
    let l = aliasesByDrug.get(a.drug_id);
    if (!l) { l = []; aliasesByDrug.set(a.drug_id, l); }
    l.push(a);
  }
  const isRegistry = (id: string) => isRegistrySource(drugById.get(id)?.source);

  // 1. Trusted index (registry + co-written keys), then the NCIt lane, then rebuild.
  let index = buildIndex(drugs, aliasesByDrug, assets, isRegistry);
  const newDrugs: Drug[] = [];
  const newAliases: Alias[] = [];
  if (!NO_NCIT) {
    const res = await ncitLane(assets, drugs, drugById, aliasesByDrug, index, isRegistry);
    newDrugs.push(...res.newDrugs);
    newAliases.push(...res.newAliases);
    for (const d of res.newDrugs) { drugs.push(d); drugById.set(d.id, d); }
    for (const a of res.newAliases) { const l = aliasesByDrug.get(a.drug_id) ?? []; l.push(a); aliasesByDrug.set(a.drug_id, l); }
    index = buildIndex(drugs, aliasesByDrug, assets, isRegistry);
  }
  if (!process.argv.includes('--no-chembl')) {
    // Registry confirmation for links the gate would drop: does ChEMBL say the name the
    // company wrote ("Taxol", "PF-04360365") is this drug? Industry rows on registry nodes only.
    const lost: string[] = [];
    for (const a of assets) {
      if (a.owner_type !== 'industry' || !a.drug_master_id || !isRegistry(a.drug_master_id)) continue;
      const cur = drugById.get(a.drug_master_id);
      const r = judgeAssetLink({ assetName: a.asset_name, aliases: a.asset_aliases, drugMasterId: a.drug_master_id, combinationComponents: cur?.is_combination ? cur.component_drug_ids ?? [] : null }, index, isRegistry);
      if (r.verdict === 'unlink') lost.push(a.asset_name);
    }
    const res = await chemblLane(lost, drugs, aliasesByDrug, index, isRegistry);
    newDrugs.push(...res.newDrugs);
    newAliases.push(...res.newAliases);
    for (const d of res.newDrugs) { drugs.push(d); drugById.set(d.id, d); }
    for (const a of res.newAliases) { const l = aliasesByDrug.get(a.drug_id) ?? []; l.push(a); aliasesByDrug.set(a.drug_id, l); }
    index = buildIndex(drugs, aliasesByDrug, assets, isRegistry);
  }

  // 2. Judge every asset.
  const plan: PlanRow[] = [];
  const verdicts = new Map<string, number>();
  const verdictByAsset = new Map<string, LinkVerdict>();
  const finalDrug = new Map<string, string | null>();
  const comboNeeds = new Map<string, string[]>(); // combo key → component ids
  for (const a of assets) {
    const cur = a.drug_master_id ? drugById.get(a.drug_master_id) : undefined;
    const r = judgeAssetLink({
      assetName: a.asset_name,
      aliases: a.asset_aliases,
      drugMasterId: cur ? cur.id : null,
      combinationComponents: cur?.is_combination ? cur.component_drug_ids ?? [] : null,
    }, index, isRegistry);
    verdicts.set(r.verdict, (verdicts.get(r.verdict) ?? 0) + 1);
    verdictByAsset.set(a.id, r.verdict);

    let target: string | null = r.drugId;
    let combo: string[] | null = null;
    if (!target && r.componentIds && r.componentIds.length > 1 && (r.verdict === 'relink' || r.verdict === 'new_link')) {
      combo = r.componentIds;
      const ck = `combination:${[...combo].sort().join('+')}`;
      comboNeeds.set(ck, combo);
    }
    finalDrug.set(a.id, target);

    // status: resolved only for registry singles, or combinations whose every component is registry
    const statusFor = (id: string | null, comps: string[] | null, via: string | undefined): { s: string; c: number } => {
      if (comps) return comps.every(isRegistry) ? { s: 'resolved', c: 75 } : { s: 'unresolvable', c: 30 };
      if (!id) return { s: 'unresolvable', c: 0 };
      const d = drugById.get(id)!;
      if (d.is_combination) {
        const cs = d.component_drug_ids ?? [];
        return cs.length > 1 && cs.every(isRegistry) ? { s: 'resolved', c: Math.max(75, Math.min(d.confidence, 90)) } : { s: 'unresolvable', c: d.confidence };
      }
      if (!isRegistry(id)) return { s: 'unresolvable', c: d.confidence };
      return { s: 'resolved', c: via === 'alias' ? 75 : Math.max(80, Math.min(d.confidence, 92)) };
    };

    if (r.verdict === 'verified_name' || r.verdict === 'verified_alias' || r.verdict === 'verified_combination') {
      const st = statusFor(a.drug_master_id, null, r.via);
      if (st.s !== a.drug_resolution_status) {
        plan.push({ asset_id: a.id, action: 'status_only', verdict: r.verdict, old_drug_master_id: a.drug_master_id, new_drug_master_id: a.drug_master_id, new_status: st.s, new_confidence: st.c, key: r.key ?? null, via: r.via ?? null, new_combo_components: null });
      }
    } else if (r.verdict === 'relink' || r.verdict === 'new_link') {
      const st = statusFor(target, combo, r.via);
      plan.push({ asset_id: a.id, action: r.verdict, verdict: r.verdict, old_drug_master_id: a.drug_master_id, new_drug_master_id: target, new_status: st.s, new_confidence: st.c, key: r.key ?? null, via: r.via ?? null, new_combo_components: combo });
    } else if (r.verdict === 'unlink') {
      plan.push({ asset_id: a.id, action: 'unlink', verdict: r.verdict, old_drug_master_id: a.drug_master_id, new_drug_master_id: null, new_status: 'unresolvable', new_confidence: 0, key: null, via: null, new_combo_components: null });
    }
  }
  console.log('verdicts', Object.fromEntries(verdicts));

  // 3. Coverage before → after (industry).
  const industry = assets.filter(a => a.owner_type === 'industry');
  const planByAsset = new Map(plan.map(p => [p.asset_id, p]));
  const before = industry.filter(a => a.drug_resolution_status === 'resolved').length;
  const after = industry.filter(a => (planByAsset.get(a.id)?.new_status ?? a.drug_resolution_status) === 'resolved').length;
  const newlyResolved = industry.filter(a => a.drug_resolution_status !== 'resolved' && planByAsset.get(a.id)?.new_status === 'resolved');
  const lost = industry.filter(a => a.drug_resolution_status === 'resolved' && planByAsset.has(a.id) && planByAsset.get(a.id)!.new_status !== 'resolved');
  console.log(`industry resolved ${before}/${industry.length} (${(100 * before / industry.length).toFixed(1)}%) → ${after} (${(100 * after / industry.length).toFixed(1)}%); +${newlyResolved.length} −${lost.length}`);

  // 4. Classify the cross-company groups as they are now.
  const ownedStatuses = new Set(['originator', 'licensee', 'co_developer', 'unknown']);
  const groups = new Map<string, Asset[]>();
  for (const a of industry) {
    if (!a.drug_master_id || !a.company_id) continue;
    const g = groups.get(a.drug_master_id) ?? [];
    g.push(a);
    groups.set(a.drug_master_id, g);
  }
  type Cls = 'wrong_match' | 'comparator_or_background' | 'legit_multi_owner' | 'other';
  const classes: Record<Cls, number> = { wrong_match: 0, comparator_or_background: 0, legit_multi_owner: 0, other: 0 };
  const legitWhy: Record<string, number> = {};
  const examples: Record<Cls, string[]> = { wrong_match: [], comparator_or_background: [], legit_multi_owner: [], other: [] };
  const groupRows: Array<Record<string, unknown>> = [];
  const isMarketed = (d: Drug | undefined) => d?.max_phase === 'approved';
  const codeRe = /\b[A-Z]{1,6}-?[A-Z]?\d{2,8}[A-Za-z]?\b/;
  for (const [drugId, rows] of groups) {
    const companies = new Set(rows.map(r => r.company_id));
    if (companies.size < 2) continue;
    const d = drugById.get(drugId);
    const verified = rows.filter(r => (verdictByAsset.get(r.id) ?? '').startsWith('verified'));
    const vCompanies = new Set(verified.map(r => r.company_id));
    let cls: Cls;
    let why = '';
    if (vCompanies.size < 2) {
      cls = 'wrong_match';
    } else {
      // owners: verified rows that are not comparator / someone else's marketed drug,
      // and, for a marketed drug, that carry the company's own development code
      const owners = new Map<string, Asset[]>();
      for (const r of verified) {
        if (!ownedStatuses.has(r.ownership_status ?? '')) continue;
        if (isMarketed(d) && !codeRe.test(r.asset_name)) continue;
        const l = owners.get(r.company_id!) ?? [];
        l.push(r);
        owners.set(r.company_id!, l);
      }
      if (owners.size < 2) {
        cls = 'comparator_or_background';
      } else {
        const ownerIds = [...owners.keys()];
        const ownerRows = [...owners.values()].flat();
        const roots = new Set(ownerRows.map(r => companyRoot(r.company_name)));
        const partnered = ownerRows.some(r => r.partner_company_id && owners.has(r.partner_company_id));
        const roles = ownerRows.some(r => r.ownership_status === 'licensee' || r.ownership_status === 'co_developer');
        const biosim = ownerRows.some(r => /biosimilar|generic/i.test(r.asset_name));
        if (roots.size === 1) why = 'same_corporate_family';
        else if (partnered) why = 'partner_on_record';
        else if (roles) why = 'licensee_or_co_developer';
        else if (biosim) why = 'biosimilar_or_generic';
        else if (isMarketed(d)) why = 'marketed_own_codes';
        cls = why ? 'legit_multi_owner' : 'other';
        if (why) legitWhy[why] = (legitWhy[why] ?? 0) + 1;
        void ownerIds;
      }
    }
    classes[cls]++;
    const sample = `${d?.preferred_name} (${d?.source}): ${[...new Set(rows.map(r => `${r.company_name} / ${r.asset_name}`))].slice(0, 4).join(' | ')}`;
    if (examples[cls].length < 12) examples[cls].push(sample);
    groupRows.push({ drug_master_id: drugId, preferred_name: d?.preferred_name, source: d?.source, companies: companies.size, assets: rows.length, verified_companies: vCompanies.size, cls, why });
  }
  console.log('group classes (current links):', classes, legitWhy);

  // 5. Aliases that are not trusted for their node: dropped so the lookup cannot re-match them.
  const dropAliases: string[] = [];
  for (const a of aliases) {
    if (TRUSTED_SOURCE(a.source)) continue;
    const d = drugById.get(a.drug_id);
    if (!d || d.is_combination) continue;
    const trusted = index.byDrug.get(a.drug_id);
    const ks = keyVariants(a.alias);
    if (trusted && ks.some(k => trusted.has(k))) continue;
    if (!trusted && normalizeKey(a.alias) === normalizeKey(d.preferred_name)) continue;
    dropAliases.push(a.id);
  }
  console.log(`aliases to drop: ${dropAliases.length} of ${aliases.length}`);

  // 6. Originator by code series: the company whose development-code prefix is a registry code of the drug.
  const prefixCounts = new Map<string, Map<string, number>>(); // prefix → company → n
  for (const a of industry) {
    const p = codePrefixOf(a.asset_name);
    if (!p || !a.company_id) continue;
    const m = prefixCounts.get(p) ?? new Map();
    m.set(a.company_id, (m.get(a.company_id) ?? 0) + 1);
    prefixCounts.set(p, m);
  }
  const prefixOwner = new Map<string, string>();
  for (const [p, m] of prefixCounts) {
    const sorted = [...m.entries()].sort((x, y) => y[1] - x[1]);
    if (sorted[0][1] >= 3 && (sorted.length === 1 || sorted[0][1] >= 2 * sorted[1][1])) prefixOwner.set(p, sorted[0][0]);
  }
  const verifiedHolders = new Map<string, Set<string>>();
  for (const a of industry) {
    const v = verdictByAsset.get(a.id) ?? '';
    const target = v.startsWith('verified') ? a.drug_master_id : (v === 'relink' || v === 'new_link') ? finalDrug.get(a.id) : null;
    if (!target || !a.company_id) continue;
    const s = verifiedHolders.get(target) ?? new Set();
    s.add(a.company_id);
    verifiedHolders.set(target, s);
  }
  const originators: Array<{ drug_id: string; old: string | null; new: string | null; prefix: string | null }> = [];
  for (const d of drugs) {
    if (d.is_combination || !isRegistrySource(d.source)) continue;
    let found: { company: string; prefix: string } | null = null;
    for (const al of aliasesByDrug.get(d.id) ?? []) {
      if (!TRUSTED_SOURCE(al.source)) continue;
      const p = codePrefixOf(al.alias);
      const owner = p ? prefixOwner.get(p) : undefined;
      if (owner && verifiedHolders.get(d.id)?.has(owner)) { found = { company: owner, prefix: p! }; break; }
    }
    const next = found?.company ?? null;
    if (next !== d.originator_company_id) originators.push({ drug_id: d.id, old: d.originator_company_id, new: next, prefix: found?.prefix ?? null });
  }
  console.log(`registry originators: ${originators.filter(o => o.new).length} set by code series, ${originators.filter(o => !o.new).length} cleared`);

  const verdictCounts = Object.fromEntries(verdicts);
  writeFileSync(join(OUT, 'stats.json'), JSON.stringify({
    verdicts: verdictCounts, coverage: { before, after, industry: industry.length, newly: newlyResolved.length, lost: lost.length },
    groups: classes, legitWhy, examples, aliasesToDrop: dropAliases.length, originators: originators.length, combosNeeded: comboNeeds.size,
  }, null, 2));
  writeFileSync(join(OUT, 'groups.json'), JSON.stringify(groupRows));
  writeFileSync(join(OUT, 'plan.json'), JSON.stringify(plan));
  writeFileSync(join(OUT, 'newly-resolved.json'), JSON.stringify(newlyResolved.map(a => ({ id: a.id, company: a.company_name, asset: a.asset_name, aliases: a.asset_aliases, drug: drugById.get(planByAsset.get(a.id)!.new_drug_master_id ?? '')?.preferred_name ?? planByAsset.get(a.id)!.new_combo_components?.map(c => drugById.get(c)?.preferred_name).join(' + '), via: planByAsset.get(a.id)!.via, key: planByAsset.get(a.id)!.key, action: planByAsset.get(a.id)!.action }))));
  writeFileSync(join(OUT, 'unlinked.json'), JSON.stringify(plan.filter(p => p.action === 'unlink' || p.action === 'relink').slice(0, 3000).map(p => {
    const a = assets.find(x => x.id === p.asset_id)!;
    return { asset: a.asset_name, company: a.company_name, from: drugById.get(p.old_drug_master_id ?? '')?.preferred_name, to: drugById.get(p.new_drug_master_id ?? '')?.preferred_name, action: p.action };
  })));

  if (!STAGE) { console.log(`dry run done → ${OUT}`); return; }

  // 7. Stage: combos first (new nodes), then plan rows, alias drops and originators.
  const comboIds = new Map<string, string>();
  {
    const keys = [...comboNeeds.keys()];
    for (let i = 0; i < keys.length; i += 40) {
      const { data, error } = await withRetry(() => supabase.from('drug_aliases').select('drug_id, alias_normalized').in('alias_normalized', keys.slice(i, i + 40).map(k => normalizeKey(k))));
      if (error) throw new Error(error.message);
      for (const r of (data ?? []) as Array<{ drug_id: string; alias_normalized: string }>) {
        const k = keys.find(x => normalizeKey(x) === r.alias_normalized);
        if (k && drugById.get(r.drug_id)?.is_combination) comboIds.set(k, r.drug_id);
      }
    }
  }
  const stagedCombos: Array<Record<string, unknown>> = [];
  for (const [k, comps] of comboNeeds) {
    if (comboIds.has(k)) continue;
    const id = randomUUID();
    comboIds.set(k, id);
    stagedCombos.push({ id, combo_key: k, components: comps, preferred_name: comps.map(c => drugById.get(c)?.preferred_name ?? '?').join(' + ').slice(0, 200) });
  }
  const runId = `drugid_${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;
  const rows = plan.map(p => {
    let target = p.new_drug_master_id;
    if (!target && p.new_combo_components) target = comboIds.get(`combination:${[...p.new_combo_components].sort().join('+')}`) ?? null;
    return { run_id: runId, kind: 'asset', asset_id: p.asset_id, action: p.action, old_drug_master_id: p.old_drug_master_id, new_drug_master_id: target, new_status: target || p.action === 'unlink' ? p.new_status : 'unresolvable', new_confidence: p.new_confidence, match_key: p.key, match_via: p.via };
  });
  const upload = async (table: string, recs: Array<Record<string, unknown>>) => {
    for (let i = 0; i < recs.length; i += 1000) {
      for (let attempt = 1; attempt <= 5; attempt++) {
        const { error } = await supabase.from(table).insert(recs.slice(i, i + 1000)).then(r => r, (e: unknown) => ({ error: { message: String(e) } }));
        if (!error) break;
        if (attempt === 5) throw new Error(`${table} insert failed: ${error.message}`);
        await sleep(2000 * attempt);
      }
    }
  };
  await upload('radar_drug_identity_plan', [
    ...stagedCombos.map(c => ({ run_id: runId, kind: 'drug_new', drug_id: c.id, payload: { preferred_name: c.preferred_name, source: 'combination', confidence: 75, is_combination: true, component_drug_ids: c.components, alias: c.combo_key } })),
    ...newDrugs.map(d => ({ run_id: runId, kind: 'drug_new', drug_id: d.id, payload: { preferred_name: d.preferred_name, inn: d.inn, source: d.source, confidence: d.confidence, is_combination: false, ncit_code: d.ncit_code ?? null, unii: d.unii ?? null, chembl_id: d.chembl_id ?? null, modality: inferModalityFromName(d.preferred_name) } })),
  ]);
  await upload('radar_drug_identity_plan', newAliases.map(a => ({ run_id: runId, kind: 'alias_add', drug_id: a.drug_id, payload: { alias: a.alias, alias_normalized: a.alias_normalized, alias_type: a.alias_type, source: a.source } })));
  await upload('radar_drug_identity_plan', rows);
  await upload('radar_drug_identity_plan', dropAliases.map(id => ({ run_id: runId, kind: 'alias_drop', alias_id: id })));
  await upload('radar_drug_identity_plan', originators.map(o => ({ run_id: runId, kind: 'originator', drug_id: o.drug_id, new_originator_company_id: o.new, match_key: o.prefix })));
  console.log(`staged run ${runId}: ${newDrugs.length} NCIt nodes, ${newAliases.length} NCIt aliases, ${rows.length} asset rows (${stagedCombos.length} new combination nodes), ${dropAliases.length} alias drops, ${originators.length} originator changes`);
}

// A dropped connection rejects instead of returning { error }; retry those.
async function withRetry<T>(fn: () => PromiseLike<T>, attempts = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) { if (i >= attempts) throw e; await sleep(2000 * i); }
  }
}

function TRUSTED_SOURCE(s: string): boolean {
  return s === 'gsrs' || s === 'chembl' || s === 'pubchem' || s === 'ncit';
}

function buildIndex(
  drugs: Drug[],
  aliasesByDrug: Map<string, Alias[]>,
  assets: Asset[],
  isRegistry: (id: string) => boolean,
) {
  const index = buildTrustedIndex(drugs, aliasesByDrug);
  let coAdded = 0;
  for (let round = 0; round < 2; round++) {
    const adds: Array<{ drugId: string; key: string }> = [];
    for (const a of assets) for (const c of coWrittenKeys(a.asset_name, index, isRegistry)) adds.push(c);
    // a key co-written for two different drugs is trusted for neither
    const byKey = new Map<string, Set<string>>();
    for (const c of adds) { const s = byKey.get(c.key) ?? new Set(); s.add(c.drugId); byKey.set(c.key, s); }
    for (const [k, ids] of byKey) if (ids.size === 1) { addTrustedKey(index, [...ids][0], k); coAdded++; }
  }
  console.log(`trusted keys: ${index.byKey.size} (co-written added ${coAdded})`);
  return index;
}

/** Query strings an asset name writes, codes first. */
function queryStrings(assetName: string): string[] {
  const out: string[] = [];
  const split = splitCombination(assetName);
  for (const c of split.components) {
    if (containsCJK(c)) continue;
    const n = normalizeDrugName(c);
    if (n.reason) continue;
    const ordered = [...n.codeNames, ...n.candidates];
    for (const q of ordered) if (q.length >= 4 && q.length <= 60 && !out.includes(q)) out.push(q);
  }
  return out.slice(0, 4);
}

interface ChemblMolecule { chembl: string; pref: string | null; synonyms: string[] }

async function chemblSearch(q: string): Promise<ChemblMolecule[] | 'error'> {
  const url = `https://www.ebi.ac.uk/chembl/api/data/molecule/search.json?q=${encodeURIComponent(q)}&limit=10`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { Accept: 'application/json' } });
    if (!res.ok) return 'error';
    const body = (await res.json()) as { molecules?: Array<{ molecule_chembl_id: string; pref_name: string | null; molecule_synonyms?: Array<{ molecule_synonym: string }> }> };
    return (body.molecules ?? []).map(m => ({ chembl: m.molecule_chembl_id, pref: m.pref_name, synonyms: [...new Set((m.molecule_synonyms ?? []).map(s => s.molecule_synonym))] }));
  } catch {
    return 'error';
  }
}

/** The one ChEMBL molecule whose own name or a synonym is exactly the query key. */
function pickChembl(q: string, mols: ChemblMolecule[]): ChemblMolecule | null {
  const k = normalizeKey(q);
  const exact = mols.filter(m => [m.pref ?? '', ...m.synonyms].some(s => normalizeKey(s) === k));
  return exact.length === 1 ? exact[0] : null;
}

async function chemblLane(
  names: string[],
  drugs: Drug[],
  aliasesByDrug: Map<string, Alias[]>,
  index: ReturnType<typeof buildTrustedIndex>,
  isRegistry: (id: string) => boolean,
): Promise<{ newDrugs: Drug[]; newAliases: Alias[] }> {
  const queries = new Set<string>();
  for (const n of names) for (const q of queryStrings(n).slice(0, 2)) queries.add(q);
  const cachePath = join(OUT, 'chembl-cache.json');
  const cache: Record<string, ChemblMolecule[] | null> = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
  const todo = [...queries].filter(q => !(normalizeKey(q) in cache));
  console.log(`ChEMBL: ${queries.size} query strings, ${todo.length} not cached`);
  let done = 0;
  let errors = 0;
  const CONC = 4;
  for (let i = 0; i < todo.length; i += CONC) {
    await Promise.all(todo.slice(i, i + CONC).map(async q => {
      const r = await Promise.race([chemblSearch(q), sleep(45_000).then(() => 'error' as const)]);
      if (r === 'error') { errors++; return; }
      cache[normalizeKey(q)] = r.length ? r.map(m => ({ ...m, synonyms: m.synonyms.slice(0, 80) })) : null;
    }));
    done += CONC;
    if (done % 400 === 0) { writeFileSync(cachePath, JSON.stringify(cache)); console.log(`  ChEMBL ${done}/${todo.length} (errors ${errors})`); }
    await sleep(150);
  }
  writeFileSync(cachePath, JSON.stringify(cache));

  const byChembl = new Map(drugs.filter(d => d.chembl_id).map(d => [d.chembl_id!, d.id]));
  const newDrugs: Drug[] = [];
  const newAliases: Alias[] = [];
  const molNode = new Map<string, string>();
  let existing = 0;
  for (const q of queries) {
    const mols = cache[normalizeKey(q)];
    if (!mols) continue;
    const m = pickChembl(q, mols);
    if (!m) continue;
    let nodeId = molNode.get(m.chembl) ?? byChembl.get(m.chembl);
    const names2 = [m.pref ?? '', ...m.synonyms].filter(s => s && s.length <= 80);
    if (!nodeId) {
      const hit = uniqueDrugForKeys(names2.flatMap(keyVariants), index, isRegistry);
      if (hit && isRegistry(hit.drugId)) nodeId = hit.drugId;
    }
    if (nodeId) existing++;
    else {
      const pref = m.pref ?? q;
      const inn = looksLikeInn(pref) ? pref.toLowerCase() : null;
      const d: Drug = { id: randomUUID(), preferred_name: (inn ?? pref).slice(0, 200), inn, source: 'chembl', confidence: 80, is_combination: false, component_drug_ids: [], max_phase: null, originator_company_id: null, chembl_id: m.chembl };
      newDrugs.push(d);
      nodeId = d.id;
    }
    molNode.set(m.chembl, nodeId);
    const have = new Set((aliasesByDrug.get(nodeId) ?? []).map(a => a.alias_normalized));
    for (const n of newAliases) if (n.drug_id === nodeId) have.add(n.alias_normalized);
    for (const sname of [q, ...names2].slice(0, 40)) {
      const k = normalizeKey(sname);
      if (!k || have.has(k)) continue;
      have.add(k);
      newAliases.push({ id: randomUUID(), drug_id: nodeId, alias: sname.slice(0, 200), alias_normalized: k, alias_type: classifyAlias(sname), source: 'chembl' });
    }
  }
  console.log(`ChEMBL: ${molNode.size} molecules accepted (${existing} existing nodes, ${newDrugs.length} new), ${newAliases.length} aliases`);
  return { newDrugs, newAliases };
}

async function ncitLane(
  assets: Asset[],
  drugs: Drug[],
  drugById: Map<string, Drug>,
  aliasesByDrug: Map<string, Alias[]>,
  index: ReturnType<typeof buildTrustedIndex>,
  isRegistry: (id: string) => boolean,
): Promise<{ newDrugs: Drug[]; newAliases: Alias[] }> {
  // Industry assets whose own name does not already name a registry node.
  const queries = new Set<string>();
  for (const a of assets) {
    if (a.owner_type !== 'industry') continue;
    for (const q of queryStrings(a.asset_name)) {
      const hit = uniqueDrugForKeys(keyVariants(q), index, isRegistry);
      if (hit && isRegistry(hit.drugId)) continue;
      queries.add(q);
    }
  }
  const cachePath = join(OUT, 'ncit-cache.json');
  const cache: Record<string, NcitConcept[] | null> = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
  const todo = [...queries].filter(q => !(normalizeKey(q) in cache));
  console.log(`NCIt: ${queries.size} query strings, ${todo.length} not cached`);
  let done = 0;
  let errors = 0;
  const CONC = 4;
  for (let i = 0; i < todo.length; i += CONC) {
    await Promise.all(todo.slice(i, i + CONC).map(async q => {
      const r = await Promise.race([searchNcit(q), sleep(45_000).then(() => 'error' as const)]);
      if (r === 'error') { errors++; return; }
      cache[normalizeKey(q)] = r.length ? r : null;
    }));
    done += CONC;
    if (done % 400 === 0) {
      writeFileSync(cachePath, JSON.stringify(cache));
      console.log(`  NCIt ${done}/${todo.length} (errors ${errors})`);
    }
    await sleep(120);
  }
  writeFileSync(cachePath, JSON.stringify(cache));

  // Concept → node: existing ncit_code, UNII, a unique registry node its names write, else a new node.
  const byNcit = new Map(drugs.filter(d => d.ncit_code).map(d => [d.ncit_code!, d.id]));
  const byUnii = new Map(drugs.filter(d => d.unii && isRegistry(d.id)).map(d => [d.unii!, d.id]));
  const newDrugs: Drug[] = [];
  const newAliases: Alias[] = [];
  const conceptNode = new Map<string, string>();
  let matchedExisting = 0;
  for (const q of queries) {
    const concepts = cache[normalizeKey(q)];
    if (!concepts) continue;
    const c = pickNcitConcept(q, concepts);
    if (!c || conceptNode.has(c.code)) continue;
    const syn = usefulSynonyms(c);
    let nodeId = byNcit.get(c.code) ?? (c.unii ? byUnii.get(c.unii) : undefined);
    if (!nodeId) {
      const hit = uniqueDrugForKeys(syn.flatMap(keyVariants), index, isRegistry);
      if (hit && isRegistry(hit.drugId)) nodeId = hit.drugId;
    }
    if (nodeId) matchedExisting++;
    else {
      const name = looksLikeInn(c.name) ? c.name.toLowerCase() : c.name;
      const d: Drug = {
        id: randomUUID(), preferred_name: name.slice(0, 200), inn: looksLikeInn(c.name) ? c.name.toLowerCase() : null,
        source: 'ncit', confidence: 85, is_combination: false, component_drug_ids: [], max_phase: null,
        originator_company_id: null, ncit_code: c.code, unii: c.unii,
      };
      newDrugs.push(d);
      nodeId = d.id;
    }
    conceptNode.set(c.code, nodeId);
    const existing = new Set((aliasesByDrug.get(nodeId) ?? []).map(a => a.alias_normalized));
    for (const sname of syn) {
      const k = normalizeKey(sname);
      if (!k || existing.has(k)) continue;
      existing.add(k);
      newAliases.push({ id: randomUUID(), drug_id: nodeId, alias: sname.slice(0, 200), alias_normalized: k, alias_type: classifyAlias(sname), source: 'ncit' });
    }
  }
  console.log(`NCIt: ${conceptNode.size} concepts accepted (${matchedExisting} existing nodes, ${newDrugs.length} new), ${newAliases.length} aliases`);
  void drugById;
  return { newDrugs, newAliases };
}


main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
