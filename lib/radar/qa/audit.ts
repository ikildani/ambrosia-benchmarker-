/**
 * Human audit of the top of the Search & Evaluation feed (/admin/radar-audit).
 *
 * The scorecard's two heaviest accuracy measures, audit_owner and audit_availability, are the share
 * of reviewed top-500 programs whose owner and availability a person confirms (radar_qa_human_reviews,
 * fields 'owner' / 'availability' / 'duplicate', last 60 days, >= 50 reviews each). This module picks
 * the next program from radar_qa_audit_queue() (the scorecard's own population and order), gathers
 * the evidence a reviewer needs on one screen, and records a review: one row per field, plus the
 * correction where one can be applied:
 *
 *   owner wrong, other status       radar_ownership_overrides.ownership_status (rule manual_override)
 *   owner is a subsidiary / twin    company_relations row (source manual, decided_by human): the
 *                                   family refresh folds the company into its parent's family
 *   availability wrong              radar_ownership_overrides.partnership_status (availability uses it)
 *   duplicate of another program    radar_ownership_overrides.ownership_status = duplicate_program
 *
 * Corrections take effect on the next ownership pass (partnership-refresh cron, daily) and the next
 * percentiles/availability refresh.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OwnershipStatus } from '@/lib/radar/types';

export const AUDIT_FIELDS = ['owner', 'availability', 'duplicate'] as const;
export type AuditField = (typeof AUDIT_FIELDS)[number];

/** The scorecard counts reviews from this window. */
export const AUDIT_WINDOW_DAYS = 60;
export const AUDIT_TOP_N = 500;
/** Reviews per field the scorecard needs before the measure counts. */
export const AUDIT_MIN_SAMPLE = 50;

export const OWNER_CORRECTIONS: readonly { value: OwnershipStatus; label: string }[] = [
  { value: 'licensee', label: 'Licensee (in-licensed from someone else)' },
  { value: 'co_developer', label: 'Co-developer' },
  { value: 'unknown', label: 'Owner unclear' },
  { value: 'comparator_or_background', label: "Someone else's drug used as comparator / background" },
  { value: 'marketed_other', label: 'Marketed / generic product, not a program' },
  { value: 'not_a_program', label: 'Not a program (arm text, device, procedure)' },
];

export const AVAILABILITY_CORRECTIONS = [
  { value: 'unpartnered', label: 'Available: no partner holds rights' },
  { value: 'partially_partnered', label: 'Partly available: regional / partial rights out' },
  { value: 'partnered', label: 'Not available: partnered, out-licensed or acquired' },
] as const;
export type AvailabilityCorrection = (typeof AVAILABILITY_CORRECTIONS)[number]['value'];

export interface AuditQueueRow {
  asset_id: string;
  rank: number;
  reviewed_fields: string[];
  last_reviewed_at: string | null;
}

export interface AuditProgress {
  total: number;
  reviewed: number;
  byField: Record<AuditField, number>;
}

export interface AuditRelatedProgram {
  id: string;
  company_name: string;
  asset_name: string;
  program_name: string | null;
  phase: string | null;
  ownership_status: string | null;
  partnership_status: string | null;
}

export interface AuditDeal {
  id: string;
  announced_date: string | null;
  licensor_name: string | null;
  licensee_name: string | null;
  deal_type: string | null;
  asset_name: string | null;
  source_url: string | null;
}

export interface AuditEvidence {
  rank: number | null;
  asset: {
    id: string;
    asset_name: string;
    program_name: string | null;
    asset_aliases: string[];
    phase: string | null;
    therapeutic_area: string | null;
    modality: string | null;
    target: string | null;
    moa_short: string | null;
    indication_specific: string | null;
    ownership_status: string | null;
    ownership_rule: string | null;
    ownership_evidence: Record<string, unknown> | null;
    partnership_status: string | null;
    partnership_basis: string | null;
    partnership_evidence: unknown;
    partner_company_name: string | null;
    availability_reasons: string[];
    asset_origin: string | null;
    disclosure_url: string | null;
    disclosure_excerpt: string | null;
    first_posted_date: string | null;
    last_update_date: string | null;
    program_key: string | null;
    program_assets: number | null;
    registry: { id: string; url: string }[];
  };
  company: {
    id: string | null;
    name: string;
    company_type: string | null;
    country: string | null;
    website_url: string | null;
    family_root: string | null;
  };
  drug: {
    id: string;
    preferred_name: string | null;
    originator: string | null;
    originator_confidence: number | null;
    max_phase: string | null;
  } | null;
  members: AuditRelatedProgram[];
  sameDrugElsewhere: AuditRelatedProgram[];
  sameTargetInFamily: AuditRelatedProgram[];
  deals: AuditDeal[];
  override: Record<string, unknown> | null;
  previousReviews: { field: string; agrees: boolean | null; human_value: string | null; reviewer: string; reviewed_at: string }[];
}

/** Public registry page for a trial id; WHO ICTRP covers the registries without a stable deep link. */
export function registryUrl(id: string): string {
  const t = id.trim();
  if (/^NCT\d{8}$/i.test(t)) return `https://clinicaltrials.gov/study/${t.toUpperCase()}`;
  if (/^CTR\d{6,}$/i.test(t)) return `http://www.chinadrugtrials.org.cn/clinicaltrials.searchlist.dhtml?keywords=${encodeURIComponent(t)}`;
  if (/^\d{4}-5\d{5}-\d{2}-\d{2}$/.test(t)) return `https://euclinicaltrials.eu/search-for-clinical-trials/?lang=en&EUCT=${encodeURIComponent(t)}`;
  if (/^ISRCTN\d+$/i.test(t)) return `https://www.isrctn.com/${t.toUpperCase()}`;
  if (/^jRCT\w+$/i.test(t)) return `https://jrct.niph.go.jp/en-latest-detail/${encodeURIComponent(t)}`;
  return `https://trialsearch.who.int/Trial2.aspx?TrialID=${encodeURIComponent(t)}`;
}

const PARTNERSHIP_LABEL: Record<string, string> = {
  unpartnered: 'Available (no partner found)',
  partially_partnered: 'Partly available (regional or partial rights out)',
  partnered: 'Not available (partnered)',
};

/** What the product currently claims about availability, as a reviewer reads it. */
export function availabilityClaim(partnershipStatus: string | null, reasons: readonly string[]): string {
  const base = PARTNERSHIP_LABEL[partnershipStatus ?? ''] ?? (partnershipStatus ?? 'unknown');
  const flags = reasons.filter(r => r !== 'partnered');
  return flags.length ? `${base}; flags: ${flags.join(', ')}` : base;
}

export function ownerClaim(companyName: string, ownershipStatus: string | null): string {
  return `${companyName} (${ownershipStatus ?? 'unknown'})`;
}

export interface AuditSubmission {
  assetId: string;
  owner: {
    agrees: boolean;
    /** Corrected ownership status for this row (owner wrong). */
    status?: OwnershipStatus | null;
    /** The company that really owns the program, when known. */
    ownerCompanyId?: string | null;
    /** The row's company is the same entity as / a subsidiary of this company. */
    relation?: 'same_entity' | 'subsidiary' | null;
    relationParentId?: string | null;
  };
  availability: { agrees: boolean; partnership?: AvailabilityCorrection | null };
  duplicate: { agrees: boolean; duplicateOf?: string | null };
  comment?: string | null;
}

export interface ReviewRow {
  asset_id: string;
  reviewer: string;
  field: AuditField;
  model_value: string;
  human_value: string | null;
  agrees: boolean;
  comment: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OWNER_VALUES = new Set<string>(OWNER_CORRECTIONS.map(o => o.value));
const AVAILABILITY_VALUES = new Set<string>(AVAILABILITY_CORRECTIONS.map(o => o.value));

/** Validate a submission from the client. Returns an error message or null. */
export function validateSubmission(s: AuditSubmission): string | null {
  if (!s || typeof s !== 'object') return 'missing body';
  if (!UUID_RE.test(s.assetId ?? '')) return 'assetId must be a uuid';
  for (const f of AUDIT_FIELDS) {
    if (typeof s[f]?.agrees !== 'boolean') return `${f}.agrees must be true or false`;
  }
  if (s.owner.status && !OWNER_VALUES.has(s.owner.status)) return 'owner.status is not a correction value';
  if (s.owner.ownerCompanyId && !UUID_RE.test(s.owner.ownerCompanyId)) return 'owner.ownerCompanyId must be a uuid';
  if (s.owner.relation && !['same_entity', 'subsidiary'].includes(s.owner.relation)) return 'owner.relation must be same_entity or subsidiary';
  if (s.owner.relation && !UUID_RE.test(s.owner.relationParentId ?? '')) return 'owner.relationParentId must be a uuid';
  if (s.availability.partnership && !AVAILABILITY_VALUES.has(s.availability.partnership)) return 'availability.partnership is not a correction value';
  if (s.duplicate.duplicateOf && !UUID_RE.test(s.duplicate.duplicateOf)) return 'duplicate.duplicateOf must be a uuid';
  if (s.duplicate.duplicateOf === s.assetId) return 'a program cannot duplicate itself';
  if (s.comment && s.comment.length > 1000) return 'comment is too long';
  return null;
}

/** One radar_qa_human_reviews row per field. */
export function buildReviewRows(
  s: AuditSubmission,
  reviewer: string,
  current: { companyName: string; ownershipStatus: string | null; partnershipStatus: string | null; availabilityReasons: readonly string[] },
): ReviewRow[] {
  const comment = s.comment?.trim() || null;
  const ownerHuman = s.owner.agrees ? null : [
    s.owner.status ? `status=${s.owner.status}` : null,
    s.owner.ownerCompanyId ? `owner_company=${s.owner.ownerCompanyId}` : null,
    s.owner.relation ? `${s.owner.relation}_of=${s.owner.relationParentId}` : null,
  ].filter(Boolean).join('; ') || 'wrong';
  return [
    {
      asset_id: s.assetId, reviewer, field: 'owner', comment,
      model_value: ownerClaim(current.companyName, current.ownershipStatus),
      human_value: ownerHuman, agrees: s.owner.agrees,
    },
    {
      asset_id: s.assetId, reviewer, field: 'availability', comment,
      model_value: availabilityClaim(current.partnershipStatus, current.availabilityReasons),
      human_value: s.availability.agrees ? null : (s.availability.partnership ?? 'wrong'),
      agrees: s.availability.agrees,
    },
    {
      asset_id: s.assetId, reviewer, field: 'duplicate', comment,
      model_value: 'unique program',
      human_value: s.duplicate.agrees ? null : (s.duplicate.duplicateOf ? `duplicate_of=${s.duplicate.duplicateOf}` : 'duplicate'),
      agrees: s.duplicate.agrees,
    },
  ];
}

/** The override row a submission implies, merged over an existing one; null when nothing to override. */
export function buildOverride(
  s: AuditSubmission,
  reviewer: string,
  existing: Record<string, unknown> | null,
  nowIso: string,
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  if (!s.duplicate.agrees && s.duplicate.duplicateOf) {
    patch.ownership_status = 'duplicate_program';
    patch.duplicate_of = s.duplicate.duplicateOf;
  } else if (!s.owner.agrees && s.owner.status) {
    patch.ownership_status = s.owner.status;
  }
  if (!s.owner.agrees && s.owner.ownerCompanyId) patch.owner_company_id = s.owner.ownerCompanyId;
  if (!s.availability.agrees && s.availability.partnership) patch.partnership_status = s.availability.partnership;
  if (Object.keys(patch).length === 0) return null;
  return {
    ...(existing ?? {}),
    ...patch,
    asset_id: s.assetId,
    reviewer,
    note: s.comment?.trim() || (existing?.note as string | undefined) || null,
    updated_at: nowIso,
  };
}

export async function loadAuditQueue(supabase: SupabaseClient): Promise<AuditQueueRow[]> {
  const { data, error } = await supabase.rpc('radar_qa_audit_queue', { p_limit: AUDIT_TOP_N, p_days: AUDIT_WINDOW_DAYS });
  if (error) throw new Error(`radar_qa_audit_queue: ${error.message}`);
  return (data ?? []) as AuditQueueRow[];
}

export function auditProgress(queue: readonly AuditQueueRow[]): AuditProgress {
  const byField = { owner: 0, availability: 0, duplicate: 0 } as Record<AuditField, number>;
  let reviewed = 0;
  for (const r of queue) {
    const f = r.reviewed_fields ?? [];
    if (AUDIT_FIELDS.every(x => f.includes(x))) reviewed++;
    for (const x of AUDIT_FIELDS) if (f.includes(x)) byField[x]++;
  }
  return { total: queue.length, reviewed, byField };
}

/** A random unreviewed program (uniform over the top N, so the audit estimates the whole list). */
export function pickNext(queue: readonly AuditQueueRow[], skip: ReadonlySet<string> = new Set(), random: () => number = Math.random): AuditQueueRow | null {
  const open = queue.filter(r => !AUDIT_FIELDS.every(x => (r.reviewed_fields ?? []).includes(x)) && !skip.has(r.asset_id));
  if (open.length === 0) return null;
  return open[Math.min(open.length - 1, Math.floor(random() * open.length))];
}

const ASSET_COLUMNS = [
  'id', 'company_id', 'company_name', 'asset_name', 'program_name', 'asset_aliases', 'phase', 'therapeutic_area', 'modality',
  'target', 'moa_short', 'indication_specific', 'ownership_status', 'ownership_evidence', 'partnership_status', 'partnership_basis',
  'partnership_evidence', 'partner_company_name', 'availability_reasons', 'asset_origin', 'disclosure_url', 'disclosure_excerpt',
  'first_posted_date', 'last_update_date', 'program_key', 'program_assets', 'nct_ids', 'lead_nct_id', 'deal_ids', 'drug_master_id',
].join(', ');

const RELATED_COLUMNS = 'id, company_name, asset_name, program_name, phase, ownership_status, partnership_status';

type AnyRow = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function related(rows: AnyRow[] | null): AuditRelatedProgram[] {
  return (rows ?? []).map(r => ({
    id: String(r.id),
    company_name: String(r.company_name ?? ''),
    asset_name: String(r.asset_name ?? ''),
    program_name: str(r.program_name),
    phase: str(r.phase),
    ownership_status: str(r.ownership_status),
    partnership_status: str(r.partnership_status),
  }));
}

/** Everything a reviewer needs for one program, in parallel reads. */
export async function loadAuditEvidence(supabase: SupabaseClient, assetId: string, rank: number | null): Promise<AuditEvidence | null> {
  const { data: a, error } = await supabase.from('clinical_assets').select(ASSET_COLUMNS).eq('id', assetId).maybeSingle();
  if (error) throw new Error(`clinical_assets read: ${error.message}`);
  if (!a) return null;
  const row = a as unknown as AnyRow;
  const companyId = str(row.company_id);
  const drugId = str(row.drug_master_id);

  const companyP = companyId
    ? supabase.from('companies').select('id, name, company_type, hq_country, website_url, family_id').eq('id', companyId).maybeSingle()
    : Promise.resolve({ data: null, error: null });
  const drugP = drugId
    ? supabase.from('drug_master').select('id, preferred_name, originator_company_id, confidence, max_phase').eq('id', drugId).maybeSingle()
    : Promise.resolve({ data: null, error: null });
  const membersP = str(row.program_key)
    ? supabase.from('clinical_assets').select(RELATED_COLUMNS).eq('program_key', row.program_key as string).neq('id', assetId).limit(12)
    : Promise.resolve({ data: [], error: null });
  const sameDrugP = drugId
    ? supabase.from('clinical_assets').select(RELATED_COLUMNS).eq('drug_master_id', drugId).eq('program_primary', true).neq('id', assetId).limit(10)
    : Promise.resolve({ data: [], error: null });
  const dealIds = arr(row.deal_ids);
  const dealsP = dealIds.length
    ? supabase.from('deals').select('id, announced_date, licensor_name, licensee_name, deal_type, asset_name, source_url').in('id', dealIds.slice(0, 10))
    : Promise.resolve({ data: [], error: null });
  const overrideP = supabase.from('radar_ownership_overrides').select('*').eq('asset_id', assetId).maybeSingle();
  const reviewsP = supabase.from('radar_qa_human_reviews').select('field, agrees, human_value, reviewer, reviewed_at')
    .eq('asset_id', assetId).in('field', [...AUDIT_FIELDS]).order('reviewed_at', { ascending: false }).limit(9);

  const [company, drug, members, sameDrug, deals, override, reviews] = await Promise.all([companyP, drugP, membersP, sameDrugP, dealsP, overrideP, reviewsP]);
  const c = (company.data ?? null) as AnyRow | null;
  const d = (drug.data ?? null) as AnyRow | null;

  const lookups: Promise<{ data: unknown }>[] = [];
  const familyId = str(c?.family_id);
  const originatorId = str(d?.originator_company_id);
  const names = new Map<string, string>();
  const idsToName = [familyId, originatorId].filter((x): x is string => !!x && x !== companyId);
  if (idsToName.length) {
    lookups.push(Promise.resolve(supabase.from('companies').select('id, name').in('id', idsToName)).then(r => {
      for (const x of (r.data ?? []) as AnyRow[]) names.set(String(x.id), String(x.name));
      return r;
    }));
  }
  // Same target, same corporate family: the likeliest place for a split program.
  let sameTarget: AuditRelatedProgram[] = [];
  const target = str(row.target);
  if (target && companyId) {
    const familyMembers = familyId
      ? ((await supabase.from('companies').select('id').eq('family_id', familyId).limit(50)).data ?? []).map(x => String((x as AnyRow).id))
      : [companyId];
    const { data: st } = await supabase.from('clinical_assets').select(RELATED_COLUMNS)
      .in('company_id', familyMembers.length ? familyMembers : [companyId])
      .eq('target', target).eq('program_primary', true).neq('id', assetId).limit(8);
    sameTarget = related((st ?? []) as AnyRow[]);
  }
  await Promise.all(lookups);

  const nctIds = arr(row.nct_ids);
  const lead = str(row.lead_nct_id);
  const regIds = [...new Set([...(lead ? [lead] : []), ...nctIds])].slice(0, 12);

  return {
    rank,
    asset: {
      id: String(row.id),
      asset_name: String(row.asset_name ?? ''),
      program_name: str(row.program_name),
      asset_aliases: arr(row.asset_aliases).slice(0, 10),
      phase: str(row.phase),
      therapeutic_area: str(row.therapeutic_area),
      modality: str(row.modality),
      target,
      moa_short: str(row.moa_short),
      indication_specific: str(row.indication_specific),
      ownership_status: str(row.ownership_status),
      ownership_rule: str((row.ownership_evidence as AnyRow | null)?.rule),
      ownership_evidence: (row.ownership_evidence as AnyRow | null) ?? null,
      partnership_status: str(row.partnership_status),
      partnership_basis: str(row.partnership_basis),
      partnership_evidence: row.partnership_evidence ?? null,
      partner_company_name: str(row.partner_company_name),
      availability_reasons: arr(row.availability_reasons),
      asset_origin: str(row.asset_origin),
      disclosure_url: str(row.disclosure_url),
      disclosure_excerpt: str(row.disclosure_excerpt),
      first_posted_date: str(row.first_posted_date),
      last_update_date: str(row.last_update_date),
      program_key: str(row.program_key),
      program_assets: typeof row.program_assets === 'number' ? row.program_assets : null,
      registry: regIds.map(id => ({ id, url: registryUrl(id) })),
    },
    company: {
      id: companyId,
      name: String(c?.name ?? row.company_name ?? ''),
      company_type: str(c?.company_type),
      country: str(c?.hq_country),
      website_url: str(c?.website_url),
      family_root: familyId && familyId !== companyId ? (names.get(familyId) ?? familyId) : null,
    },
    drug: d ? {
      id: String(d.id),
      preferred_name: str(d.preferred_name),
      originator: originatorId ? (originatorId === companyId ? String(c?.name ?? 'this company') : (names.get(originatorId) ?? originatorId)) : null,
      originator_confidence: typeof d.confidence === 'number' ? d.confidence : null,
      max_phase: str(d.max_phase),
    } : null,
    members: related((members.data ?? []) as AnyRow[]),
    sameDrugElsewhere: related((sameDrug.data ?? []) as AnyRow[]),
    sameTargetInFamily: sameTarget,
    deals: ((deals.data ?? []) as AnyRow[]).map(x => ({
      id: String(x.id), announced_date: str(x.announced_date), licensor_name: str(x.licensor_name), licensee_name: str(x.licensee_name),
      deal_type: str(x.deal_type), asset_name: str(x.asset_name), source_url: str(x.source_url),
    })),
    override: (override.data ?? null) as AnyRow | null,
    previousReviews: ((reviews.data ?? []) as AnyRow[]).map(x => ({
      field: String(x.field), agrees: typeof x.agrees === 'boolean' ? x.agrees : null, human_value: str(x.human_value),
      reviewer: String(x.reviewer ?? ''), reviewed_at: String(x.reviewed_at ?? ''),
    })),
  };
}

export interface RecordResult {
  reviews: number;
  override: boolean;
  relation: boolean;
}

/** Write the three review rows and apply the correction the reviewer gave. */
export async function recordAudit(supabase: SupabaseClient, s: AuditSubmission, reviewer: string, now: Date = new Date()): Promise<RecordResult> {
  const { data: a, error } = await supabase.from('clinical_assets')
    .select('id, company_id, company_name, ownership_status, partnership_status, availability_reasons')
    .eq('id', s.assetId).maybeSingle();
  if (error) throw new Error(`clinical_assets read: ${error.message}`);
  if (!a) throw new Error('program not found');
  const row = a as unknown as AnyRow;
  const companyId = str(row.company_id);
  let companyName = String(row.company_name ?? '');
  if (companyId) {
    const { data: c } = await supabase.from('companies').select('name').eq('id', companyId).maybeSingle();
    if (c && (c as AnyRow).name) companyName = String((c as AnyRow).name);
  }

  const reviews = buildReviewRows(s, reviewer, {
    companyName,
    ownershipStatus: str(row.ownership_status),
    partnershipStatus: str(row.partnership_status),
    availabilityReasons: arr(row.availability_reasons),
  });
  const { error: insErr } = await supabase.from('radar_qa_human_reviews').insert(reviews.map(r => ({ ...r, reviewed_at: now.toISOString() })));
  if (insErr) throw new Error(`radar_qa_human_reviews insert: ${insErr.message}`);

  const { data: existing } = await supabase.from('radar_ownership_overrides').select('*').eq('asset_id', s.assetId).maybeSingle();
  const override = buildOverride(s, reviewer, (existing ?? null) as AnyRow | null, now.toISOString());
  if (override) {
    const { error: ovErr } = await supabase.from('radar_ownership_overrides').upsert(override, { onConflict: 'asset_id' });
    if (ovErr) throw new Error(`radar_ownership_overrides upsert: ${ovErr.message}`);
  }

  let relation = false;
  if (!s.owner.agrees && s.owner.relation && s.owner.relationParentId && companyId && s.owner.relationParentId !== companyId) {
    const { error: relErr } = await supabase.from('company_relations').upsert({
      company_id: companyId,
      parent_id: s.owner.relationParentId,
      relation: s.owner.relation,
      source: 'manual',
      status: 'accepted',
      decided_by: 'human',
      confidence: 100,
      evidence: { via: 'radar-audit', reviewer, asset_id: s.assetId, note: s.comment?.trim() || null },
      updated_at: now.toISOString(),
    }, { onConflict: 'company_id,parent_id' });
    if (relErr) throw new Error(`company_relations upsert: ${relErr.message}`);
    relation = true;
  }
  return { reviews: reviews.length, override: !!override, relation };
}

/** Company lookup for the "same company as / subsidiary of" correction. */
export async function searchCompanies(supabase: SupabaseClient, q: string): Promise<{ id: string; name: string; company_type: string | null; country: string | null }[]> {
  const term = q.trim().replace(/[%_,()]/g, ' ').slice(0, 80);
  if (term.length < 2) return [];
  const { data, error } = await supabase.from('companies').select('id, name, company_type, hq_country')
    .ilike('name', `%${term}%`).is('merged_into', null).limit(10);
  if (error) throw new Error(`companies search: ${error.message}`);
  return ((data ?? []) as AnyRow[]).map(r => ({ id: String(r.id), name: String(r.name), company_type: str(r.company_type), country: str(r.hq_country) }));
}
