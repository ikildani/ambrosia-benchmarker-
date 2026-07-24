/**
 * RWE Tuning Cron — Weekly backtest of the rNPV engine against approved drugs.
 *
 * Calls `runRWEBacktest()` with the full INDEX_DRUG_DATABASE, persists results
 * to Supabase, and fires a Slack alert on drift. Optionally auto-promotes
 * validated tuning deltas when RWE_AUTO_APPLY=true.
 *
 * Schedule: Sundays 9am UTC
 *
 * Manual:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://solidus.ambrosiaventures.co/api/cron/rwe-tuning
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runRWEBacktest } from '@/lib/financial/rwe-tuning';
import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import { INDEX_DRUG_DATABASE } from '@/lib/financial/index-drugs';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

async function postSlackAlert(
  title: string,
  body: string,
  color: string = '#DC2626',
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: title,
        attachments: [{
          color,
          blocks: [
            { type: 'header', text: { type: 'plain_text', text: title, emoji: true } },
            { type: 'section', text: { type: 'mrkdwn', text: body } },
            { type: 'context', elements: [{ type: 'mrkdwn', text: `_RWE Tuning Cron — ${new Date().toISOString()}_` }] },
          ],
        }],
      }),
    });
  } catch (err) {
    console.error('[RWE Tuning] Slack webhook failed:', err);
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  const expected = `Bearer ${cronSecret}`;
  const provided = authHeader || '';
  const sameLen = provided.length === expected.length;
  const tokenToCompare = sameLen ? provided : expected;
  const isValid = sameLen && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expected));
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    // Fetch previous RMSE for drift detection
    const { data: prevRow } = await supabase
      .from('rwe_tuning_results')
      .select('overall_rmse')
      .order('as_of_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    const previousRmse = prevRow?.overall_rmse ?? undefined;

    // Run the backtest
    const result = runRWEBacktest(INDEX_DRUG_DATABASE, calculateRNPV, previousRmse);

    // Persist the full result
    const { data: insertedResult, error: insertErr } = await supabase
      .from('rwe_tuning_results')
      .upsert({
        as_of_date: result.asOfDate,
        total_drugs_analyzed: result.totalDrugsAnalyzed,
        drugs_skipped: result.drugsSkipped,
        overall_mean_error: result.overallMeanError,
        overall_mape: result.overallMape,
        overall_rmse: result.overallRmse,
        drift_alert: result.driftAlert,
        holdout_rmse: result.holdoutValidation?.holdoutRmse ?? null,
        holdout_sample_size: result.holdoutValidation?.sampleSize ?? null,
        result_json: result,
      }, { onConflict: 'as_of_date' })
      .select('id')
      .single();
    if (insertErr) throw insertErr;
    const runId = insertedResult!.id;

    // Persist proposed tuning deltas
    if (result.proposedTuningDeltas.length > 0) {
      const deltaRows = result.proposedTuningDeltas.map(d => ({
        run_id: runId,
        parameter: d.parameter,
        current_value: d.currentValue,
        proposed_value: d.proposedValue,
        expected_error_reduction: d.expectedErrorReduction,
        rationale: d.rationale,
        status: 'pending',
      }));
      const { error: deltaErr } = await supabase
        .from('rwe_pending_deltas')
        .insert(deltaRows);
      if (deltaErr) throw deltaErr;
    }

    // Auto-promote if enabled and holdout validation passes
    const autoApply = process.env.RWE_AUTO_APPLY === 'true';
    let deltasPromoted = 0;
    if (
      autoApply &&
      result.holdoutValidation &&
      result.holdoutValidation.holdoutRmse <= result.holdoutValidation.fullRmse
    ) {
      // Fetch the pending deltas we just inserted
      const { data: pendingDeltas } = await supabase
        .from('rwe_pending_deltas')
        .select('id, parameter, proposed_value')
        .eq('run_id', runId)
        .eq('status', 'pending');

      if (pendingDeltas && pendingDeltas.length > 0) {
        const overrideRows = pendingDeltas.map(d => ({
          delta_id: d.id,
          parameter: d.parameter,
          override_value: d.proposed_value,
          applied_by: 'cron-auto',
          source_rmse: result.overallRmse,
        }));

        const { error: overrideErr } = await supabase
          .from('rwe_active_overrides')
          .upsert(overrideRows, { onConflict: 'parameter' });
        if (overrideErr) throw overrideErr;

        // Mark deltas as promoted
        const deltaIds = pendingDeltas.map(d => d.id);
        await supabase
          .from('rwe_pending_deltas')
          .update({ status: 'promoted', reviewed_by: 'cron-auto', reviewed_at: new Date().toISOString() })
          .in('id', deltaIds);

        deltasPromoted = pendingDeltas.length;
      }
    }

    // Drift alert → Slack
    if (result.driftAlert) {
      await postSlackAlert(
        '⚠️ RWE Tuning: RMSE Drift Detected',
        `RMSE jumped from $${previousRmse?.toFixed(0) ?? '?'}M to $${result.overallRmse.toFixed(0)}M ` +
        `(>${(0.20 * 100).toFixed(0)}% week-over-week).\n` +
        `Drugs analyzed: ${result.totalDrugsAnalyzed} | MAPE: ${(result.overallMape * 100).toFixed(1)}% | ` +
        `Deltas proposed: ${result.proposedTuningDeltas.length}`,
        '#DC2626',
      );
    }

    // Cron intelligence
    try {
      await runCronIntelligence(supabase, 'rwe-tuning', {
        processed: result.totalDrugsAnalyzed,
        inserted: result.proposedTuningDeltas.length,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      drugsAnalyzed: result.totalDrugsAnalyzed,
      drugsSkipped: result.drugsSkipped,
      overallRmse: result.overallRmse,
      overallMape: result.overallMape,
      overallMeanError: result.overallMeanError,
      driftAlert: result.driftAlert,
      deltasProposed: result.proposedTuningDeltas.length,
      deltasPromoted,
      holdoutValidation: result.holdoutValidation ?? null,
    });
  } catch (error) {
    console.error('[RWE Tuning] cron error:', error);
    return NextResponse.json({ error: 'RWE tuning failed' }, { status: 500 });
  }
}
