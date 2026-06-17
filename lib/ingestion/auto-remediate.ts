import { SupabaseClient } from '@supabase/supabase-js';
import { reclassifyOtherDeals } from '@/lib/cron-utils';
import { REMEDIATION_THRESHOLDS } from '@/lib/config/remediation-thresholds';

export interface RemediationResult {
  fixed: number;
  skipped: number;
  errors: string[];
  details: Array<{ dealId: string; issueType: string; oldValue: string; newValue: string }>;
}

function emptyResult(): RemediationResult {
  return { fixed: 0, skipped: 0, errors: [], details: [] };
}

export async function logRemediation(
  supabase: SupabaseClient,
  entry: {
    cronSource: string;
    issueType: string;
    dealId?: string;
    fieldName?: string;
    oldValue?: string;
    newValue?: string;
    actionTaken: string;
    confidence?: number;
    autoFixed?: boolean;
    needsReview?: boolean;
  },
): Promise<void> {
  await supabase.from('remediation_log').insert({
    cron_source: entry.cronSource,
    issue_type: entry.issueType,
    deal_id: entry.dealId || null,
    field_name: entry.fieldName || null,
    old_value: entry.oldValue || null,
    new_value: entry.newValue || null,
    action_taken: entry.actionTaken,
    confidence: entry.confidence || null,
    auto_fixed: entry.autoFixed ?? true,
    needs_review: entry.needsReview ?? false,
  }).then(() => {}, () => {});
}

export async function fixNegativeDealValues(supabase: SupabaseClient): Promise<RemediationResult> {
  if (REMEDIATION_THRESHOLDS.DRY_RUN_MODE) return emptyResult();
  const result = emptyResult();

  for (const field of ['upfront_usd', 'total_deal_value_usd', 'milestones_total_usd']) {
    const { data: deals } = await supabase
      .from('deals')
      .select('id, upfront_usd, total_deal_value_usd, milestones_total_usd')
      .lt(field, 0)
      .eq('is_synthetic', false);

    for (const deal of (deals || []) as Array<{ id: string; upfront_usd: number | null; total_deal_value_usd: number | null; milestones_total_usd: number | null }>) {
      const oldVal = String((deal as Record<string, unknown>)[field]);
      const { error } = await supabase
        .from('deals')
        .update({ [field]: 0 })
        .eq('id', deal.id);

      if (!error) {
        result.fixed++;
        result.details.push({ dealId: deal.id, issueType: 'negative_value', oldValue: oldVal, newValue: '0' });
        await logRemediation(supabase, {
          cronSource: 'qa_health_check', issueType: 'negative_deal_value',
          dealId: deal.id, fieldName: field, oldValue: oldVal, newValue: '0',
          actionTaken: 'set_to_zero',
        });
      } else {
        result.errors.push(`Failed to fix ${field} for deal ${deal.id}: ${error.message}`);
      }
    }
  }
  return result;
}

export async function fixMissingTherapeuticArea(supabase: SupabaseClient): Promise<RemediationResult> {
  if (REMEDIATION_THRESHOLDS.DRY_RUN_MODE) return emptyResult();

  const before = await supabase
    .from('deals')
    .select('id', { count: 'exact', head: true })
    .or('therapeutic_area.is.null,therapeutic_area.eq.other')
    .eq('is_synthetic', false);

  const reclassified = await reclassifyOtherDeals(supabase);

  const result = emptyResult();
  result.fixed = reclassified;
  result.skipped = (before.count || 0) - reclassified;

  if (reclassified > 0) {
    await logRemediation(supabase, {
      cronSource: 'deal_data_health', issueType: 'missing_therapeutic_area',
      actionTaken: 'reclassified_from_indication',
      newValue: `${reclassified} deals reclassified`,
    });
  }
  return result;
}

export async function fixUpfrontExceedsTdv(supabase: SupabaseClient): Promise<RemediationResult> {
  if (!REMEDIATION_THRESHOLDS.UPFRONT_TDV_SWAP_ENABLED || REMEDIATION_THRESHOLDS.DRY_RUN_MODE) {
    return emptyResult();
  }
  const result = emptyResult();

  const { data: deals } = await supabase
    .from('deals')
    .select('id, upfront_usd, total_deal_value_usd')
    .not('upfront_usd', 'is', null)
    .not('total_deal_value_usd', 'is', null)
    .eq('is_synthetic', false)
    .limit(50);

  for (const deal of deals || []) {
    if (deal.upfront_usd <= deal.total_deal_value_usd) continue;

    const { error } = await supabase
      .from('deals')
      .update({
        upfront_usd: deal.total_deal_value_usd,
        total_deal_value_usd: deal.upfront_usd,
        verification_notes: `Auto-swapped upfront/TDV (was: upfront=${deal.upfront_usd}, tdv=${deal.total_deal_value_usd})`,
      })
      .eq('id', deal.id);

    if (!error) {
      result.fixed++;
      result.details.push({
        dealId: deal.id, issueType: 'upfront_exceeds_tdv',
        oldValue: `upfront=${deal.upfront_usd}, tdv=${deal.total_deal_value_usd}`,
        newValue: `upfront=${deal.total_deal_value_usd}, tdv=${deal.upfront_usd}`,
      });
      await logRemediation(supabase, {
        cronSource: 'deal_data_health', issueType: 'upfront_exceeds_tdv',
        dealId: deal.id, fieldName: 'upfront_usd,total_deal_value_usd',
        oldValue: `${deal.upfront_usd}/${deal.total_deal_value_usd}`,
        newValue: `${deal.total_deal_value_usd}/${deal.upfront_usd}`,
        actionTaken: 'swapped_values', confidence: 80, needsReview: true,
      });
    } else {
      result.errors.push(`Failed to swap for deal ${deal.id}: ${error.message}`);
    }
  }
  return result;
}

export async function flagDuplicatesForReview(
  supabase: SupabaseClient,
  duplicatePairs: Array<{ dealIds: string[]; licensor: string; licensee: string }>,
): Promise<RemediationResult> {
  const result = emptyResult();

  for (const pair of duplicatePairs) {
    if (pair.dealIds.length < 2) continue;

    const { data: deals } = await supabase
      .from('deals')
      .select('id, confidence_score')
      .in('id', pair.dealIds)
      .order('confidence_score', { ascending: false });

    if (!deals || deals.length < 2) continue;

    for (let i = 1; i < deals.length; i++) {
      await supabase
        .from('deals')
        .update({
          verification_notes: `Potential duplicate of deal ${deals[0].id} (${pair.licensor} / ${pair.licensee}). Higher-confidence version retained.`,
          verification_status: 'flagged',
        })
        .eq('id', deals[i].id);

      await logRemediation(supabase, {
        cronSource: 'deal_data_health', issueType: 'potential_duplicate',
        dealId: deals[i].id,
        actionTaken: 'flagged_for_manual_merge',
        oldValue: `duplicate of ${deals[0].id}`,
        needsReview: true,
      });
      result.fixed++;
    }
  }
  return result;
}

export async function autoAcceptVerifiedDeals(
  supabase: SupabaseClient,
  minConfidence: number = REMEDIATION_THRESHOLDS.AUTO_ACCEPT_MIN_CONFIDENCE,
): Promise<RemediationResult> {
  if (REMEDIATION_THRESHOLDS.DRY_RUN_MODE) return emptyResult();
  const result = emptyResult();

  const { data: deals } = await supabase
    .from('deals')
    .select('id, confidence_score')
    .eq('verification_status', 'verified')
    .eq('verified', false)
    .gte('confidence_score', minConfidence)
    .eq('is_synthetic', false)
    .limit(100);

  for (const deal of deals || []) {
    const { error } = await supabase
      .from('deals')
      .update({ verified: true })
      .eq('id', deal.id);

    if (!error) {
      result.fixed++;
      await logRemediation(supabase, {
        cronSource: 'deal_verification', issueType: 'auto_accept',
        dealId: deal.id, actionTaken: 'auto_accepted_verified',
        confidence: deal.confidence_score,
      });
    }
  }
  return result;
}

export async function autoRejectLowConfidenceDeals(
  supabase: SupabaseClient,
  maxConfidence: number = REMEDIATION_THRESHOLDS.AUTO_REJECT_MAX_CONFIDENCE,
): Promise<RemediationResult> {
  if (REMEDIATION_THRESHOLDS.DRY_RUN_MODE) return emptyResult();
  const result = emptyResult();

  const { data: deals } = await supabase
    .from('deals')
    .select('id, confidence_score')
    .eq('verification_status', 'flagged')
    .lt('confidence_score', maxConfidence)
    .eq('is_synthetic', false)
    .limit(50);

  for (const deal of deals || []) {
    const { error } = await supabase
      .from('deals')
      .update({
        is_synthetic: true,
        verification_status: 'rejected',
        verification_notes: `Auto-rejected: confidence ${deal.confidence_score} below threshold ${maxConfidence}`,
      })
      .eq('id', deal.id);

    if (!error) {
      result.fixed++;
      await logRemediation(supabase, {
        cronSource: 'deal_verification', issueType: 'auto_reject',
        dealId: deal.id, actionTaken: 'auto_rejected_low_confidence',
        confidence: deal.confidence_score, needsReview: true,
      });
    }
  }
  return result;
}

export async function investigateDriftCause(
  supabase: SupabaseClient,
  ta: string,
  phase: string,
): Promise<{ suspectDealIds: string[]; summary: string }> {
  const windowDays = REMEDIATION_THRESHOLDS.DRIFT_INVESTIGATION_WINDOW_DAYS;
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentDeals } = await supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, total_deal_value_usd, upfront_usd, created_at')
    .eq('therapeutic_area', ta)
    .eq('is_synthetic', false)
    .gte('created_at', cutoff)
    .not('total_deal_value_usd', 'is', null)
    .order('total_deal_value_usd', { ascending: false })
    .limit(50);

  if (!recentDeals || recentDeals.length < 3) {
    return { suspectDealIds: [], summary: 'Insufficient recent deals for analysis' };
  }

  const values = recentDeals.map(d => d.total_deal_value_usd as number);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
  const threshold = REMEDIATION_THRESHOLDS.OUTLIER_STDDEV_THRESHOLD;

  const suspects = recentDeals.filter(d => {
    const val = d.total_deal_value_usd as number;
    return Math.abs(val - mean) > threshold * stdDev;
  });

  const suspectIds = suspects.map(d => d.id);

  for (const deal of suspects) {
    await supabase
      .from('deals')
      .update({
        verification_status: 'flagged',
        verification_notes: `Auto-flagged: outlier causing ${ta}/${phase} distribution drift (TDV=${deal.total_deal_value_usd}, mean=${Math.round(mean)}, ${threshold}σ threshold)`,
      })
      .eq('id', deal.id);

    await logRemediation(supabase, {
      cronSource: 'distribution_monitor', issueType: 'drift_outlier',
      dealId: deal.id, fieldName: 'total_deal_value_usd',
      oldValue: String(deal.total_deal_value_usd),
      actionTaken: 'flagged_as_drift_outlier', needsReview: true,
    });
  }

  const summary = suspects.length > 0
    ? `${suspects.length} outlier deal(s) flagged: ${suspects.map(d => `${d.licensor_name}/${d.licensee_name} ($${Math.round((d.total_deal_value_usd as number) / 1e6)}M)`).join(', ')}`
    : 'No outlier deals found — drift may be caused by calibration changes';

  return { suspectDealIds: suspectIds, summary };
}
