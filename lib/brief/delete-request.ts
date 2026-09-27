/**
 * Remove a Deal Intelligence Brief request completely: the stored PDF and
 * Excel, the alerts and follow-ups queued for it, the outcome-ledger
 * prediction it registered (and any outcomes matched to that prediction),
 * and finally the benchmark_requests row. Used for test intakes and for a
 * client's deletion request; the ledger keeps no trace, which is the point.
 *
 * Idempotent: a step whose rows are already gone is reported as 0.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DeleteBriefReport {
  requestId: string;
  storageRemoved: number;
  alertsRemoved: number;
  followupsRemoved: number;
  outcomesRemoved: number;
  predictionRemoved: boolean;
  requestRemoved: boolean;
  errors: string[];
}

export async function deleteBriefRequest(supabase: SupabaseClient, requestId: string, opts: { dryRun?: boolean } = {}): Promise<DeleteBriefReport> {
  const report: DeleteBriefReport = { requestId, storageRemoved: 0, alertsRemoved: 0, followupsRemoved: 0, outcomesRemoved: 0, predictionRemoved: false, requestRemoved: false, errors: [] };
  const dry = !!opts.dryRun;

  const { data: row, error: rowErr } = await supabase
    .from('benchmark_requests')
    .select('id, brief_token, prediction_id, pdf_storage_path, excel_storage_path')
    .eq('id', requestId)
    .maybeSingle();
  if (rowErr) { report.errors.push(`load: ${rowErr.message}`); return report; }
  if (!row) { report.errors.push('request not found'); return report; }
  const r = row as { brief_token: string | null; prediction_id: string | null; pdf_storage_path: string | null; excel_storage_path: string | null };

  // 1. Storage: everything under briefs/<token>/ plus the recorded paths.
  const paths = new Set<string>([r.pdf_storage_path, r.excel_storage_path].filter((p): p is string => !!p));
  if (r.brief_token) {
    const { data: listed } = await supabase.storage.from('reports').list(`briefs/${r.brief_token}`, { limit: 100 });
    for (const f of listed ?? []) paths.add(`briefs/${r.brief_token}/${f.name}`);
  }
  if (paths.size) {
    if (!dry) {
      const { data, error } = await supabase.storage.from('reports').remove([...paths]);
      if (error) report.errors.push(`storage: ${error.message}`);
      report.storageRemoved = data?.length ?? 0;
    } else report.storageRemoved = paths.size;
  }

  // 2. Alerts and follow-ups keyed on the request.
  for (const [table, key] of [['brief_alerts', 'alertsRemoved'], ['outcome_followups', 'followupsRemoved']] as const) {
    const { count } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('request_id', requestId);
    report[key] = count ?? 0;
    if (!dry && (count ?? 0) > 0) {
      const { error } = await supabase.from(table).delete().eq('request_id', requestId);
      if (error) report.errors.push(`${table}: ${error.message}`);
    }
  }

  // 3. The ledger prediction and any outcomes matched to it.
  if (r.prediction_id) {
    const { count } = await supabase.from('outcomes').select('id', { count: 'exact', head: true }).eq('prediction_id', r.prediction_id);
    report.outcomesRemoved = count ?? 0;
    if (!dry) {
      if ((count ?? 0) > 0) {
        const { error } = await supabase.from('outcomes').delete().eq('prediction_id', r.prediction_id);
        if (error) report.errors.push(`outcomes: ${error.message}`);
      }
      const { error: pErr, count: pCount } = await supabase.from('predictions').delete({ count: 'exact' }).eq('id', r.prediction_id);
      if (pErr) report.errors.push(`predictions: ${pErr.message}`);
      report.predictionRemoved = (pCount ?? 0) > 0;
    } else report.predictionRemoved = true;
  }

  // 4. The request itself.
  if (!dry) {
    const { error, count } = await supabase.from('benchmark_requests').delete({ count: 'exact' }).eq('id', requestId);
    if (error) report.errors.push(`benchmark_requests: ${error.message}`);
    report.requestRemoved = (count ?? 0) > 0;
  } else report.requestRemoved = true;

  return report;
}
