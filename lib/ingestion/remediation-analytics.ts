import { SupabaseClient } from '@supabase/supabase-js';

export interface RemediationStats {
  totalActions: number;
  byType: Record<string, number>;
  byCron: Record<string, number>;
  autoFixRate: number;
  reviewBacklog: number;
  falsePositiveRate: number;
}

export async function getRemediationStats(
  supabase: SupabaseClient,
  days: number = 30,
): Promise<RemediationStats> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: entries } = await supabase
    .from('remediation_log')
    .select('issue_type, cron_source, auto_fixed, needs_review, reviewed_at, review_outcome')
    .gte('created_at', cutoff);

  if (!entries || entries.length === 0) {
    return { totalActions: 0, byType: {}, byCron: {}, autoFixRate: 0, reviewBacklog: 0, falsePositiveRate: 0 };
  }

  const byType: Record<string, number> = {};
  const byCron: Record<string, number> = {};
  let autoFixed = 0;
  let reviewNeeded = 0;
  let reviewed = 0;
  let falsePositives = 0;

  for (const e of entries) {
    byType[e.issue_type] = (byType[e.issue_type] || 0) + 1;
    byCron[e.cron_source] = (byCron[e.cron_source] || 0) + 1;
    if (e.auto_fixed) autoFixed++;
    if (e.needs_review && !e.reviewed_at) reviewNeeded++;
    if (e.reviewed_at) {
      reviewed++;
      if (e.review_outcome === 'false_positive') falsePositives++;
    }
  }

  return {
    totalActions: entries.length,
    byType,
    byCron,
    autoFixRate: entries.length > 0 ? autoFixed / entries.length : 0,
    reviewBacklog: reviewNeeded,
    falsePositiveRate: reviewed > 0 ? falsePositives / reviewed : 0,
  };
}

export interface ThresholdSuggestion {
  parameter: string;
  currentValue: number;
  suggestedValue: number;
  rationale: string;
  sampleSize: number;
}

export async function suggestThresholdAdjustments(
  supabase: SupabaseClient,
): Promise<ThresholdSuggestion[]> {
  const suggestions: ThresholdSuggestion[] = [];

  const { data: reviewed } = await supabase
    .from('remediation_log')
    .select('issue_type, action_taken, confidence, review_outcome')
    .not('reviewed_at', 'is', null)
    .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

  if (!reviewed || reviewed.length < 10) return suggestions;

  const autoRejects = reviewed.filter(r => r.action_taken === 'auto_rejected_low_confidence');
  const falseRejects = autoRejects.filter(r => r.review_outcome === 'false_positive');
  if (autoRejects.length >= 5 && falseRejects.length / autoRejects.length > 0.2) {
    suggestions.push({
      parameter: 'AUTO_REJECT_MAX_CONFIDENCE',
      currentValue: 40,
      suggestedValue: 30,
      rationale: `${Math.round(falseRejects.length / autoRejects.length * 100)}% of auto-rejected deals were false positives (${falseRejects.length}/${autoRejects.length}). Lower the threshold to reduce false rejections.`,
      sampleSize: autoRejects.length,
    });
  }

  const autoAccepts = reviewed.filter(r => r.action_taken === 'auto_accepted_verified');
  const falseAccepts = autoAccepts.filter(r => r.review_outcome === 'false_negative');
  if (autoAccepts.length >= 5 && falseAccepts.length / autoAccepts.length > 0.1) {
    suggestions.push({
      parameter: 'AUTO_ACCEPT_MIN_CONFIDENCE',
      currentValue: 85,
      suggestedValue: 90,
      rationale: `${Math.round(falseAccepts.length / autoAccepts.length * 100)}% of auto-accepted deals were later flagged (${falseAccepts.length}/${autoAccepts.length}). Raise the threshold to reduce false acceptances.`,
      sampleSize: autoAccepts.length,
    });
  }

  return suggestions;
}
