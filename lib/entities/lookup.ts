/**
 * Shared entity graph — canonical entity lookups by id (GET
 * /api/entities/:kind/:id). Read-only. Returns null when the id is unknown
 * or, for deals, fails the quality filter.
 */

import { normalizeAssetName, normalizeCompanyName, sameCompanyKey } from './normalize';
import {
  COMPANY_COLS,
  DRUG_COLS,
  applyDealQualityFilter,
  followMergedInto,
  usdToM,
  type CompanyRow,
  type DrugRow,
  type EntityClient,
} from './resolve';
import type { AssetLookup, CompanyLookup, DealLookup, EntityKind, EntityLookup } from './types';
import { isUuid, orValue, anchorToken } from './normalize';
import { escapeLike } from './resolve';

export const ENTITY_KINDS: readonly EntityKind[] = ['company', 'asset', 'deal'];

export function isEntityKind(k: string): k is EntityKind {
  return (ENTITY_KINDS as readonly string[]).includes(k);
}

export async function lookupCompany(supabase: EntityClient, id: string): Promise<CompanyLookup | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await supabase.from('companies').select(COMPANY_COLS).eq('id', id).maybeSingle();
  if (error) throw new Error(`companies lookup failed: ${error.message}`);
  if (!data) return null;
  // A folded duplicate id (companies.merged_into) returns its canonical record.
  const row = (await followMergedInto(supabase, data as CompanyRow)) ?? (data as CompanyRow);
  const key = normalizeCompanyName(row.name);
  let duplicates: CompanyRow[] = [];
  const anchor = anchorToken(key);
  if (anchor) {
    const { data: pool, error: poolErr } = await supabase
      .from('companies')
      .select(COMPANY_COLS)
      .ilike('name', `%${escapeLike(anchor)}%`)
      .limit(300);
    if (poolErr) throw new Error(`companies duplicate scan failed: ${poolErr.message}`);
    duplicates = ((pool ?? []) as CompanyRow[]).filter(r => r.id !== row.id && sameCompanyKey(normalizeCompanyName(r.name), key));
  }
  const aliases = new Set<string>();
  for (const r of [row, ...duplicates]) {
    if (r.name?.trim()) aliases.add(r.name.trim());
    for (const v of r.name_variations ?? []) if (v?.trim()) aliases.add(v.trim());
  }
  return {
    kind: 'company',
    id: row.id,
    name: row.name,
    aliases: [...aliases],
    hq: { country: row.hq_country ?? null, region: row.hq_region ?? null },
    type: row.company_type ?? null,
    ownerType: row.owner_type ?? null,
    ids: { ticker: row.ticker ?? null, cik: row.cik ?? row.sec_cik ?? null, website: row.website_url ?? null },
    dataQualityScore: row.data_quality_score ?? null,
    duplicateIds: duplicates.map(d => d.id),
  };
}

interface DrugFullRow extends DrugRow {
  mechanism: string | null;
  drugbank_id: string | null;
  cas_number: string | null;
  pubchem_cid: number | null;
  component_drug_ids: string[] | null;
}

const DRUG_FULL_COLS = `${DRUG_COLS},mechanism,drugbank_id,cas_number,pubchem_cid,component_drug_ids`;

export async function lookupAsset(supabase: EntityClient, id: string): Promise<AssetLookup | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await supabase.from('drug_master').select(DRUG_FULL_COLS).eq('id', id).maybeSingle();
  if (error) throw new Error(`drug_master lookup failed: ${error.message}`);
  if (!data) return null;
  const row = data as DrugFullRow;
  const [{ data: aliasRows, error: aErr }, { data: ownerRows, error: oErr }] = await Promise.all([
    supabase.from('drug_aliases').select('alias').eq('drug_id', id).limit(60),
    supabase.from('drug_owners').select('company_id,role,territory').eq('drug_id', id).limit(50),
  ]);
  if (aErr) throw new Error(`drug_aliases lookup failed: ${aErr.message}`);
  if (oErr) throw new Error(`drug_owners lookup failed: ${oErr.message}`);
  const aliases = new Set<string>();
  if (row.preferred_name) aliases.add(row.preferred_name);
  if (row.inn) aliases.add(row.inn);
  for (const a of (aliasRows ?? []) as Array<{ alias: string }>) if (a.alias) aliases.add(a.alias);
  return {
    kind: 'asset',
    id: row.id,
    preferredName: row.preferred_name,
    inn: row.inn ?? null,
    aliases: [...aliases],
    modality: row.modality ?? null,
    target: row.target ?? null,
    mechanism: row.mechanism ?? null,
    maxPhase: row.max_phase ?? null,
    isCombination: !!row.is_combination,
    componentDrugIds: row.component_drug_ids ?? [],
    originatorCompanyId: row.originator_company_id ?? null,
    ids: {
      unii: row.unii ?? null,
      chemblId: row.chembl_id ?? null,
      drugbankId: row.drugbank_id ?? null,
      casNumber: row.cas_number ?? null,
      pubchemCid: row.pubchem_cid ?? null,
    },
    owners: ((ownerRows ?? []) as Array<{ company_id: string; role: string | null; territory: string | null }>)
      .filter(o => o.company_id)
      .map(o => ({ companyId: o.company_id, role: o.role ?? null, territory: o.territory ?? null })),
  };
}

interface DealFullRow {
  id: string;
  licensor_name: string | null;
  licensor_id: string | null;
  licensee_name: string | null;
  licensee_id: string | null;
  asset_name: string | null;
  announced_date: string | null;
  deal_type: string | null;
  phase_at_signing: string | null;
  therapeutic_area: string | null;
  indication_specific: string | null;
  indication_category: string | null;
  upfront_usd: number | null;
  milestones_total_usd: number | null;
  total_deal_value_usd: number | null;
  royalty_low_pct: number | null;
  royalty_high_pct: number | null;
  terms_disclosed: boolean | null;
  source_url: string | null;
  press_release_url: string | null;
  verification_status: string | null;
}

const DEAL_FULL_COLS =
  'id,licensor_name,licensor_id,licensee_name,licensee_id,asset_name,announced_date,deal_type,phase_at_signing,therapeutic_area,indication_specific,indication_category,upfront_usd,milestones_total_usd,total_deal_value_usd,royalty_low_pct,royalty_high_pct,terms_disclosed,source_url,press_release_url,verification_status';

/** Verify a party id still points at a companies row; drop dangling ids. */
async function verifiedCompanyIds(supabase: EntityClient, ids: Array<string | null>): Promise<Set<string>> {
  const uniq = [...new Set(ids.filter((x): x is string => !!x && isUuid(x)))];
  if (!uniq.length) return new Set();
  const { data, error } = await supabase.from('companies').select('id').in('id', uniq);
  if (error) throw new Error(`companies id check failed: ${error.message}`);
  return new Set(((data ?? []) as Array<{ id: string }>).map(r => r.id));
}

/** Resolve a party by name when the row carries no id: exact normalised name or alias only. */
async function partyIdByName(supabase: EntityClient, name: string | null): Promise<string | null> {
  const raw = (name ?? '').trim();
  const key = normalizeCompanyName(raw);
  if (!key) return null;
  const anchor = anchorToken(key);
  const filters = [`name.ilike.${orValue(`%${escapeLike(anchor)}%`)}`, `name_variations.cs.{${orValue(raw)}}`];
  const { data, error } = await supabase
    .from('companies')
    .select(COMPANY_COLS)
    .or(filters.join(','))
    .order('data_quality_score', { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) throw new Error(`companies party lookup failed: ${error.message}`);
  const rows = (data ?? []) as CompanyRow[];
  const hit = rows.find(r => sameCompanyKey(normalizeCompanyName(r.name), key)) ?? rows.find(r => (r.name_variations ?? []).some(v => sameCompanyKey(normalizeCompanyName(v), key)));
  return hit?.id ?? null;
}

async function assetIdByName(supabase: EntityClient, name: string | null): Promise<string | null> {
  const key = normalizeAssetName(name ?? '');
  if (!key) return null;
  const { data, error } = await supabase.from('drug_aliases').select('drug_id').eq('alias_normalized', key).limit(5);
  if (error) throw new Error(`drug_aliases lookup failed: ${error.message}`);
  const rows = (data ?? []) as Array<{ drug_id: string }>;
  return rows.length === 1 || (rows.length > 1 && rows.every(r => r.drug_id === rows[0].drug_id)) ? rows[0].drug_id : null;
}

export async function lookupDeal(supabase: EntityClient, id: string): Promise<DealLookup | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await applyDealQualityFilter(supabase.from('deals').select(DEAL_FULL_COLS).eq('id', id)).maybeSingle();
  if (error) throw new Error(`deals lookup failed: ${error.message}`);
  if (!data) return null;
  const row = data as DealFullRow;
  const valid = await verifiedCompanyIds(supabase, [row.licensor_id, row.licensee_id]);
  const licensorId = row.licensor_id && valid.has(row.licensor_id) ? row.licensor_id : await partyIdByName(supabase, row.licensor_name);
  const licenseeId = row.licensee_id && valid.has(row.licensee_id) ? row.licensee_id : await partyIdByName(supabase, row.licensee_name);
  const assetId = await assetIdByName(supabase, row.asset_name);
  return {
    kind: 'deal',
    id: row.id,
    parties: {
      licensor: { id: licensorId, name: row.licensor_name ?? '' },
      licensee: { id: licenseeId, name: row.licensee_name ?? '' },
    },
    asset: { id: assetId, name: row.asset_name ?? null },
    announcedDate: row.announced_date ?? null,
    dealType: row.deal_type ?? null,
    phaseAtSigning: row.phase_at_signing ?? null,
    therapeuticArea: row.therapeutic_area ?? null,
    indication: row.indication_specific ?? row.indication_category ?? null,
    terms: {
      upfrontM: usdToM(row.upfront_usd),
      milestonesM: usdToM(row.milestones_total_usd),
      totalM: usdToM(row.total_deal_value_usd),
      royaltyLowPct: row.royalty_low_pct ?? null,
      royaltyHighPct: row.royalty_high_pct ?? null,
      termsDisclosed: row.terms_disclosed ?? null,
    },
    sourceUrl: row.source_url ?? row.press_release_url ?? null,
    verificationStatus: row.verification_status ?? null,
  };
}

export async function lookupEntity(supabase: EntityClient, kind: EntityKind, id: string): Promise<EntityLookup | null> {
  switch (kind) {
    case 'company':
      return lookupCompany(supabase, id);
    case 'asset':
      return lookupAsset(supabase, id);
    case 'deal':
      return lookupDeal(supabase, id);
    default:
      return null;
  }
}
