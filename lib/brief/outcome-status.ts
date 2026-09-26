/**
 * Loads the ledger rows behind a delivered brief for the data room's
 * Outcomes card. Server-side (service client). Never throws: a ledger read
 * failure leaves the card in its "registered on delivery" state.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PredictionRow, OutcomeRow } from '@/lib/outcomes/types';
import { signOutcomeReportToken } from '@/lib/outcomes/report-token';
import { SITE_URL } from './delivery';

export interface BriefCallRows {
  prediction: PredictionRow | null;
  /** Latest accepted outcome, else latest pending one, else null. */
  outcome: OutcomeRow | null;
  /** Signed link to the client outcome form, when a prediction exists and a secret is configured. */
  reportUrl: string | null;
}

export async function loadBriefCall(
  supabase: SupabaseClient,
  request: { id: string; prediction_id?: string | null },
): Promise<BriefCallRows> {
  try {
    let prediction: PredictionRow | null = null;
    if (request.prediction_id) {
      const { data } = await supabase.from('predictions').select('*').eq('id', request.prediction_id).maybeSingle();
      prediction = (data as PredictionRow | null) ?? null;
    }
    if (!prediction) {
      const { data } = await supabase
        .from('predictions')
        .select('*')
        .eq('source', 'brief')
        .eq('source_id', request.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      prediction = (data as PredictionRow | null) ?? null;
    }
    if (!prediction) return { prediction: null, outcome: null, reportUrl: null };

    const { data: outcomes } = await supabase
      .from('outcomes')
      .select('*')
      .eq('prediction_id', prediction.id)
      .in('status', ['accepted', 'pending'])
      .order('created_at', { ascending: false })
      .limit(10);
    const rows = (outcomes ?? []) as OutcomeRow[];
    const outcome = rows.find(r => r.status === 'accepted') ?? rows[0] ?? null;

    let reportUrl: string | null = null;
    try {
      reportUrl = `${SITE_URL}/outcomes/report/${signOutcomeReportToken({ predictionId: prediction.id, requestId: request.id })}`;
    } catch {
      reportUrl = null;
    }
    return { prediction, outcome, reportUrl };
  } catch (e) {
    console.error('[Brief] outcome-status load failed:', e instanceof Error ? e.message : e);
    return { prediction: null, outcome: null, reportUrl: null };
  }
}
