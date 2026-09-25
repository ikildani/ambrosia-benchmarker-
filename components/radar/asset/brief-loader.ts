/**
 * Server-only loader for the one-page asset brief.
 *
 * Used by app/radar/[id]/page.tsx (server component), /api/radar/assets/[id]
 * and /api/radar/export so the page, the JSON API and the PDF all render the
 * same numbers from the same queries. Every sub-query is independent and runs
 * in one Promise.all; optional tables (asset_catalysts, drug_master, the
 * Workstream E thesis columns) are tolerated when absent.
 *
 * Callers must have already gated on Pro (resolveUserTier().hasProAccess).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchComparableDeals, MIN_COMPS_FOR_TERMS, type DealComp } from '@/lib/radar/deal-thesis';
import type { ClinicalAssetRow, PartnershipEvidence } from '@/lib/radar/types';
import { buildScoreBreakdown, deltaOverDays, type SignalEvidenceRow, type SnapshotLike } from './score-breakdown';
import type {
  AcquirerRow, AssetBrief, AssetOwner, CatalystRow, CompRow, DrugIdentity, IntelRow,
  LinkedDealRow, PredictedTerms, ThesisRow, TrendPoint, TrialRow,
} from './types';

const TRIALS_LIMIT = 200;
const SNAPSHOT_DAYS = 90;

type Row = Record<string, unknown>;

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : null;
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function toM(v: unknown): number | null {
  const n = num(v);
  return n != null && n > 0 ? Math.round(n / 1_000_000) : null;
}

function median(values: number[]): number | null {
  if (values.length < 3) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round(((s[mid - 1] + s[mid]) / 2) * 10) / 10;
}

function compToRow(c: DealComp, extra: { source_url?: string | null; source_type?: string | null; url_status?: string | null } | undefined): CompRow {
  return {
    id: c.id,
    licensor_name: c.licensor_name,
    licensee_name: c.licensee_name,
    asset_name: c.asset_name,
    therapeutic_area: c.therapeutic_area,
    modality: c.modality,
    phase_at_signing: c.phase_at_signing,
    upfront_m: c.upfront_m,
    total_deal_value_m: c.total_deal_value_m,
    milestones_m: c.milestones_m,
    royalty_low_pct: c.royalty_low_pct,
    royalty_high_pct: c.royalty_high_pct,
    territory: c.territory,
    announced_date: c.announced_date,
    year: c.year ?? null,
    deal_type: c.deal_type,
    verification_status: c.verification_status,
    match_score: c.match_score,
    relevance_reasons: c.relevance_reasons ?? [],
    source_url: extra?.source_url ?? null,
    source_type: extra?.source_type ?? null,
    url_status: extra?.url_status ?? null,
  };
}

function thesisFromRow(t: Row | null): ThesisRow | null {
  if (!t) return null;
  const acquirersRaw = Array.isArray(t.likely_acquirers) ? (t.likely_acquirers as Row[]) : [];
  return {
    predicted_upfront_low: num(t.predicted_upfront_low),
    predicted_upfront_mid: num(t.predicted_upfront_mid),
    predicted_upfront_high: num(t.predicted_upfront_high),
    predicted_total_low: num(t.predicted_total_low),
    predicted_total_mid: num(t.predicted_total_mid),
    predicted_total_high: num(t.predicted_total_high),
    predicted_royalty_low: num(t.predicted_royalty_low),
    predicted_royalty_mid: num(t.predicted_royalty_mid),
    predicted_royalty_high: num(t.predicted_royalty_high),
    comp_count: num(t.comp_count) ?? 0,
    thesis_confidence: num(t.thesis_confidence) ?? 0,
    comp_relaxation: (t.comp_relaxation as string | null) ?? null,
    insufficient_comps: Boolean(t.insufficient_comps),
    comp_dispersion: num(t.comp_dispersion),
    generated_at: (t.generated_at as string | null) ?? null,
    verified_comp_count: num(t.verified_comp_count),
    terms_basis: (t.terms_basis as string | null) ?? null,
    calculator_upfront_mid: num(t.calculator_upfront_mid),
    calculator_total_mid: num(t.calculator_total_mid),
    likely_acquirers: acquirersRaw
      .filter(a => typeof a.name === 'string')
      .map(a => ({ name: a.name as string, dealCount: num(a.dealCount) ?? undefined, avgUpfront: num(a.avgUpfront) })),
  };
}

function trialFromRow(t: Row): TrialRow {
  return {
    nct_id: String(t.nct_id),
    trial_title: (t.trial_title as string | null) ?? null,
    phase: (t.phase as string | null) ?? null,
    status: (t.status as string | null) ?? null,
    enrollment_count: num(t.enrollment_count),
    start_date: (t.start_date as string | null) ?? null,
    primary_completion_date: (t.primary_completion_date as string | null) ?? null,
    completion_date: (t.completion_date as string | null) ?? null,
    locations_countries: arr(t.locations_countries),
    conditions: arr(t.conditions),
    is_collaboration: Boolean(t.is_collaboration),
    collaborator_names: arr(t.collaborator_names),
    lead_sponsor_name: (t.lead_sponsor_name as string | null) ?? null,
    registry: (t.registry as string | null) ?? null,
    last_update_posted: (t.last_update_posted as string | null) ?? null,
  };
}

const STATUS_RANK: Record<string, number> = {
  recruiting: 0, active_not_recruiting: 1, enrolling_by_invitation: 2, not_yet_recruiting: 3,
  completed: 4, suspended: 5, terminated: 6, withdrawn: 7, unknown: 8,
};

/** Catalysts derived from trials: primary completions in the next 18 months. */
function catalystsFromTrials(trials: TrialRow[], now: Date): CatalystRow[] {
  const horizon = new Date(now);
  horizon.setUTCMonth(horizon.getUTCMonth() + 18);
  const out: CatalystRow[] = [];
  for (const t of trials) {
    if (!t.primary_completion_date) continue;
    const d = new Date(t.primary_completion_date);
    if (Number.isNaN(d.getTime()) || d < now || d > horizon) continue;
    if (t.status && ['terminated', 'withdrawn', 'suspended'].includes(t.status)) continue;
    out.push({
      id: `pcd:${t.nct_id}`,
      date: t.primary_completion_date,
      kind: 'primary_completion',
      title: `Primary completion — ${t.nct_id}`,
      detail: [t.phase ? t.phase.replace(/_/g, ' ') : null, t.trial_title].filter(Boolean).join(' · ') || null,
      nct_id: t.nct_id,
      source: 'company_trials',
    });
  }
  return out;
}

export async function loadAssetBrief(supabase: SupabaseClient, assetId: string, now = new Date()): Promise<AssetBrief | null> {
  const { data: assetRaw, error } = await supabase
    .from('clinical_assets')
    .select('*')
    .eq('id', assetId)
    .maybeSingle();
  if (error || !assetRaw) return null;
  const asset = assetRaw as ClinicalAssetRow & Row;

  const nctIds = arr(asset.nct_ids);
  const dealIds = arr(asset.deal_ids);
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - SNAPSHOT_DAYS);

  const [
    companyRes, drugRes, snapshotsRes, signalsRes, thesisRes, compsRes, trialsRes,
    catalystsRes, intelRes, oppsRes, linkedRes,
  ] = await Promise.all([
    asset.company_id
      ? supabase.from('companies').select('id, name, owner_type, headquarters_country, headquarters_region, website_url').eq('id', asset.company_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    asset.drug_master_id
      ? supabase.from('drug_master').select('id, preferred_name, inn, unii, chembl_id, max_phase').eq('id', asset.drug_master_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('asset_signal_snapshots')
      .select('*')
      .eq('asset_id', assetId)
      .gte('snapshot_date', since.toISOString().slice(0, 10))
      .order('snapshot_date', { ascending: false })
      .limit(120),
    supabase.from('licensing_signals')
      .select('signal_type, signal_value, confidence, evidence_text, evidence_url, evidence_date, evidence_source, detected_at')
      .eq('asset_id', assetId)
      .eq('is_active', true)
      .order('signal_value', { ascending: false })
      .limit(50),
    supabase.from('radar_deal_theses').select('*').eq('asset_id', assetId).maybeSingle(),
    fetchComparableDeals(supabase, asset, 15).catch(err => {
      console.warn(`[radar/brief] comparable lookup failed: ${err instanceof Error ? err.message : String(err)}`);
      return { comps: [] as DealComp[], relaxation: 'none' as const, excludedApprovedMA: 0 };
    }),
    nctIds.length > 0
      ? supabase.from('company_trials')
          .select('nct_id, trial_title, phase, status, enrollment_count, start_date, primary_completion_date, completion_date, locations_countries, conditions, is_collaboration, collaborator_names, lead_sponsor_name, registry, last_update_posted')
          .in('nct_id', nctIds.slice(0, TRIALS_LIMIT))
      : Promise.resolve({ data: [] as Row[], error: null }),
    // Optional table (Workstream C/D). A missing relation is a soft failure.
    supabase.from('asset_catalysts')
      .select('id, catalyst_date, catalyst_type, title, detail, nct_id')
      .eq('asset_id', assetId)
      .order('catalyst_date', { ascending: true })
      .limit(40)
      .then(r => r, () => ({ data: null, error: { message: 'asset_catalysts unavailable' } })),
    supabase.from('competitive_intel')
      .select('id, intel_type, competitor_name, intensity, evidence_text, detected_at')
      .eq('asset_id', assetId)
      .eq('is_active', true)
      .order('intensity', { ascending: false })
      .limit(30),
    supabase.from('radar_deal_opportunities')
      .select('id, acquirer_name, acquirer_company_id, opportunity_score, strategic_fit_score, timing_score, rationale, strategic_drivers, risk_factors, gap_type, gap_detail, predicted_upfront_mid, predicted_total_mid, confidence, status')
      .eq('asset_id', assetId)
      .neq('status', 'dismissed')
      .order('opportunity_score', { ascending: false })
      .limit(20),
    dealIds.length > 0
      ? supabase.from('deals')
          .select('id, licensor_name, licensee_name, upfront_usd, total_deal_value_usd, territory, announced_date, deal_status, source_url')
          .in('id', dealIds.slice(0, 10))
      : Promise.resolve({ data: [] as Row[], error: null }),
  ]);

  // Comp provenance (source link + health) for the shown comps only.
  const compIds = compsRes.comps.map(c => c.id);
  const compExtras = new Map<string, { source_url: string | null; source_type: string | null; url_status: string | null }>();
  if (compIds.length > 0) {
    const { data: extras } = await supabase.from('deals').select('id, source_url, source_type, url_status').in('id', compIds);
    for (const e of (extras || []) as Row[]) {
      compExtras.set(String(e.id), {
        source_url: (e.source_url as string | null) ?? null,
        source_type: (e.source_type as string | null) ?? null,
        url_status: (e.url_status as string | null) ?? null,
      });
    }
  }

  const company = (companyRes.data || null) as Row | null;
  const owner: AssetOwner = {
    company_id: asset.company_id,
    company_name: (company?.name as string) || asset.company_name,
    owner_type: (company?.owner_type as string | null) ?? asset.owner_type ?? null,
    country: (company?.headquarters_country as string | null) ?? asset.originator_country ?? null,
    region: (company?.headquarters_region as string | null) ?? asset.originator_region ?? null,
    website_url: (company?.website_url as string | null) ?? null,
  };

  const drugRow = (drugRes.data || null) as Row | null;
  const drug: DrugIdentity | null = drugRow ? {
    drug_master_id: String(drugRow.id),
    preferred_name: (drugRow.preferred_name as string | null) ?? null,
    inn: (drugRow.inn as string | null) ?? null,
    unii: (drugRow.unii as string | null) ?? null,
    chembl_id: (drugRow.chembl_id as string | null) ?? null,
    max_phase: (drugRow.max_phase as string | null) ?? null,
    resolution_status: asset.drug_resolution_status ?? 'unresolved',
    resolution_confidence: num(asset.drug_resolution_confidence),
  } : null;

  const snapshots = ((snapshotsRes.data || []) as Row[]);
  const latestSnapshot = (snapshots[0] as unknown as SnapshotLike | undefined) ?? null;
  const signals = ((signalsRes.data || []) as unknown as SignalEvidenceRow[]);
  const score = buildScoreBreakdown({
    currentScore: asset.licensing_intent_score,
    currentConfidence: asset.score_confidence ?? asset.confidence_score,
    snapshot: latestSnapshot,
    signals,
  });
  // Migration 126 presentation fields ride on the asset row.
  score.presentation = {
    score: score.score,
    probability: num(asset.score_probability),
    pct_peer: num(asset.score_pct_peer),
    peer_n: num(asset.score_peer_n),
    peer_key: asset.score_peer_key ?? null,
    pct_universe: num(asset.score_pct_universe),
    base_rate: num(asset.score_base_rate),
    low_power: asset.score_low_power ?? false,
    interval: asset.score_interval ?? null,
  };

  const points: TrendPoint[] = snapshots.map(s => ({
    date: String(s.snapshot_date),
    score: num(s.licensing_intent_score) ?? 0,
    delta: num(s.score_delta) ?? 0,
    trend: (s.trend as string | null) ?? null,
  }));
  const trend = {
    points: [...points].reverse(),
    delta_7d: deltaOverDays(points, 7, now),
    delta_30d: deltaOverDays(points, 30, now),
    delta_90d: deltaOverDays(points, 90, now),
    current_trend: points[0]?.trend || 'stable',
  };

  const thesis = thesisFromRow((thesisRes.data || null) as Row | null);
  const comps = compsRes.comps.map(c => compToRow(c, compExtras.get(c.id)));
  const verifiedN = comps.filter(c => c.verification_status === 'verified').length;
  const terms: PredictedTerms = {
    thesis,
    comps,
    n: comps.length,
    verified_n: thesis?.verified_comp_count ?? verifiedN,
    relaxation: thesis?.comp_relaxation ?? compsRes.relaxation,
    insufficient: thesis ? thesis.insufficient_comps || thesis.predicted_upfront_mid == null : comps.length < MIN_COMPS_FOR_TERMS,
    min_comps: MIN_COMPS_FOR_TERMS,
    excluded_approved_ma: compsRes.excludedApprovedMA,
    comps_median_upfront_m: median(comps.map(c => c.upfront_m).filter((v): v is number => v != null)),
    comps_median_total_m: median(comps.map(c => c.total_deal_value_m).filter((v): v is number => v != null)),
  };

  const trials = ((trialsRes.data || []) as Row[]).map(trialFromRow).sort((a, b) => {
    const ra = STATUS_RANK[a.status || 'unknown'] ?? 8;
    const rb = STATUS_RANK[b.status || 'unknown'] ?? 8;
    if (ra !== rb) return ra - rb;
    return (b.primary_completion_date || '').localeCompare(a.primary_completion_date || '');
  });

  const catalystRows = (catalystsRes.data || null) as Row[] | null;
  const catalysts: CatalystRow[] = catalystRows && catalystRows.length > 0
    ? catalystRows.map(c => ({
        id: String(c.id),
        date: String(c.catalyst_date),
        kind: String(c.catalyst_type || 'catalyst'),
        title: String(c.title || c.catalyst_type || 'Catalyst'),
        detail: (c.detail as string | null) ?? null,
        nct_id: (c.nct_id as string | null) ?? null,
        source: 'asset_catalysts' as const,
      }))
    : catalystsFromTrials(trials, now);
  catalysts.sort((a, b) => a.date.localeCompare(b.date));

  const intel: IntelRow[] = ((intelRes.data || []) as Row[]).map(i => ({
    id: String(i.id),
    intel_type: String(i.intel_type),
    competitor_name: (i.competitor_name as string | null) ?? null,
    intensity: num(i.intensity) ?? 0,
    evidence_text: (i.evidence_text as string | null) ?? null,
    detected_at: (i.detected_at as string | null) ?? null,
  }));

  const acquirers: AcquirerRow[] = ((oppsRes.data || []) as Row[]).map(o => ({
    id: String(o.id),
    acquirer_name: String(o.acquirer_name),
    acquirer_company_id: (o.acquirer_company_id as string | null) ?? null,
    opportunity_score: num(o.opportunity_score) ?? 0,
    strategic_fit_score: num(o.strategic_fit_score) ?? 0,
    timing_score: num(o.timing_score) ?? 0,
    rationale: String(o.rationale || ''),
    strategic_drivers: arr(o.strategic_drivers),
    risk_factors: arr(o.risk_factors),
    gap_type: (o.gap_type as string | null) ?? null,
    gap_detail: (o.gap_detail as string | null) ?? null,
    predicted_upfront_mid: num(o.predicted_upfront_mid),
    predicted_total_mid: num(o.predicted_total_mid),
    confidence: num(o.confidence) ?? 0,
    status: String(o.status || 'proposed'),
  }));

  const linked: LinkedDealRow[] = ((linkedRes.data || []) as Row[]).map(d => ({
    id: String(d.id),
    licensor_name: (d.licensor_name as string | null) ?? null,
    licensee_name: (d.licensee_name as string | null) ?? null,
    upfront_m: toM(d.upfront_usd),
    total_deal_value_m: toM(d.total_deal_value_usd),
    territory: (d.territory as string | null) ?? null,
    announced_date: (d.announced_date as string | null) ?? null,
    deal_status: (d.deal_status as string | null) ?? null,
    source_url: (d.source_url as string | null) ?? null,
  }));

  const evidence: PartnershipEvidence[] = Array.isArray(asset.partnership_evidence) ? asset.partnership_evidence : [];

  return {
    asset: { ...asset, owner_type: owner.owner_type as ClinicalAssetRow['owner_type'] },
    owner,
    drug,
    partnership: {
      status: asset.partnership_status,
      partner_name: asset.partner_company_name,
      partner_company_id: asset.partner_company_id,
      confidence: num(asset.partnership_confidence) ?? 0,
      evidence,
      rights_available: arr(asset.territory_rights_available),
      basis: asset.partnership_basis ?? null,
      sources_checked: asset.partnership_sources_checked ?? null,
    },
    score,
    trend,
    terms,
    trials,
    catalysts,
    intel,
    acquirers,
    linked_deals: linked,
    freshness: {
      last_update_date: asset.last_update_date,
      last_scored_at: asset.last_scored_at,
      last_enriched_at: asset.last_enriched_at,
      partnership_checked_at: asset.partnership_checked_at,
      thesis_generated_at: thesis?.generated_at ?? null,
      drug_resolved_at: asset.drug_resolved_at,
    },
    generated_at: now.toISOString(),
  };
}
