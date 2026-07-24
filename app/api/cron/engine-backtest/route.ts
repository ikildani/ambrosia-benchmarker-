/**
 * Engine Back-Test Cron
 *
 * Runs the full back-test suite monthly, stores results, and alerts
 * Slack if validation metrics drift below defensible thresholds.
 *
 * Run manually via:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://solidus.ambrosiaventures.co/api/cron/engine-backtest
 *
 * Or via /api/cron/engine-backtest?format=markdown for the full report
 */

import { NextRequest, NextResponse } from 'next/server';
import { runFullBackTest, formatReportMarkdown } from '@/lib/financial/backtest/runner';
import { createServiceClient } from '@/lib/supabase/server';
import { runCronIntelligence } from '@/lib/cron-intelligence';

function verifyCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

async function postSlackAlert(title: string, body: string, color: string = '#0891B2'): Promise<void> {
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
            { type: 'context', elements: [{ type: 'mrkdwn', text: `_Engine Back-Test — ${new Date().toISOString()}_` }] },
          ],
        }],
      }),
    });
  } catch (err) {
    console.error('[Back-Test Cron] Slack webhook failed:', err);
  }
}

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const format = request.nextUrl.searchParams.get('format');

  try {
    const report = runFullBackTest({ engineVersion: 'competitive-dynamics-v13' });

    // Alert Slack if accuracy drops below defensible thresholds
    // Use defensible metrics (excludes edge cases: Aduhelm, Leqembi, Humira, Spinraza)
    const failingThresholds = [];
    if (report.defensiblePeakErosionMetrics.mape > 0.40) {
      failingThresholds.push(`MAPE ${(report.defensiblePeakErosionMetrics.mape * 100).toFixed(1)}% > 40% threshold`);
    }
    if (report.defensiblePeakErosionMetrics.pearsonR < 0.5) {
      failingThresholds.push(`Pearson R ${report.defensiblePeakErosionMetrics.pearsonR.toFixed(2)} < 0.5 threshold`);
    }
    if (report.calibrationAccuracyPeakErosion < 0.60) {
      failingThresholds.push(`Calibration ${(report.calibrationAccuracyPeakErosion * 100).toFixed(0)}% < 60% (target 80%)`);
    }

    if (failingThresholds.length > 0) {
      await postSlackAlert(
        `Engine Back-Test: Accuracy degradation detected`,
        `The monthly back-test found ${failingThresholds.length} threshold violations:\n\n${failingThresholds.map((f) => `  • ${f}`).join('\n')}\n\n*Overall confidence: ${report.overallConfidence.toUpperCase()}*`,
        '#DC2626',
      );
    } else {
      // Success notification (low priority, once per month)
      await postSlackAlert(
        `Engine Back-Test: Validation passed`,
        `Monthly back-test completed.\n\n` +
        `*Defensible metrics (excl. ${report.edgeCaseCount} edge cases):*\n` +
        `  MAPE: ${(report.defensiblePeakErosionMetrics.mape * 100).toFixed(1)}% | Pearson R: ${report.defensiblePeakErosionMetrics.pearsonR.toFixed(3)} | R²: ${report.defensiblePeakErosionMetrics.rSquared.toFixed(3)}\n\n` +
        `*All-asset metrics (${report.assetCount} assets):*\n` +
        `  MAPE: ${(report.peakErosionMetrics.mape * 100).toFixed(1)}% | Pearson R: ${report.peakErosionMetrics.pearsonR.toFixed(3)} | R²: ${report.peakErosionMetrics.rSquared.toFixed(3)}\n\n` +
        `*Calibration:* ${(report.calibrationAccuracyPeakErosion * 100).toFixed(0)}%\n` +
        `*Timing accuracy:* ${(report.timingAccuracyCompetitorYear * 100).toFixed(0)}%\n` +
        `*Confidence:* ${report.overallConfidence.toUpperCase()}`,
        '#059669',
      );
    }

    // Intelligence tracking
    try {
      const supabase = createServiceClient();
      await runCronIntelligence(supabase, 'engine-backtest', {
        processed: 1,
        inserted: 0,
      });
    } catch {}

    if (format === 'markdown') {
      return new NextResponse(formatReportMarkdown(report), {
        headers: { 'Content-Type': 'text/markdown' },
      });
    }

    return NextResponse.json(report);
  } catch (err) {
    console.error('[Back-Test Cron] Error:', err);
    return NextResponse.json(
      { error: 'Back-test failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
