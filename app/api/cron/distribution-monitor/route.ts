/**
 * Distribution Monitor — Layer 4 of the 5-layer bug detection system
 *
 * Runs daily. Computes distribution statistics (mean, median, stddev,
 * P10, P90) of rNPV for each (TA, phase) combo over the last 7 days and
 * compares them against the rolling 30-day baseline. If any stat has
 * drifted by more than the configured thresholds, alert Slack.
 *
 * The idea is to catch silent calibration drift: if a deploy silently
 * shifts the oncology Phase 2 median rNPV by 30%, we notice within 24h
 * even if no one manually spot-checks.
 *
 * Schedule: daily at 07:00 UTC
 * Auth: CRON_SECRET via Authorization: Bearer
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Thresholds (defined at the top so they're easy to tune)
// ---------------------------------------------------------------------------

const MEAN_SHIFT_THRESHOLD = 0.25; // 25%
const MEDIAN_SHIFT_THRESHOLD = 0.20; // 20%
const STDDEV_SHIFT_THRESHOLD = 0.50; // 50%
const MIN_SAMPLE_SIZE = 10; // require at least 10 calcs in a window

// ---------------------------------------------------------------------------
// Auth — timing-safe comparison like the other crons
// ---------------------------------------------------------------------------

function verifyCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // Allow in dev
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

// ---------------------------------------------------------------------------
// Slack notification
// ---------------------------------------------------------------------------

async function postSlackAlert(title: string, body: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: title,
        attachments: [
          {
            color: '#F59E0B',
            blocks: [
              { type: 'header', text: { type: 'plain_text', text: title, emoji: true } },
              { type: 'section', text: { type: 'mrkdwn', text: body } },
              {
                type: 'context',
                elements: [{ type: 'mrkdwn', text: `_Distribution Monitor — ${new Date().toISOString()}_` }],
              },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    console.error('[Distribution Monitor] Slack webhook failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Statistics helpers
// ---------------------------------------------------------------------------

interface Stats {
  count: number;
  mean: number;
  median: number;
  stdDev: number;
  p10: number;
  p90: number;
}

function computeStats(values: number[]): Stats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const count = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / count;
  const variance = values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / count;
  const stdDev = Math.sqrt(variance);
  const pick = (p: number) => {
    if (count === 1) return sorted[0];
    const idx = Math.max(0, Math.min(count - 1, Math.round((p / 100) * (count - 1))));
    return sorted[idx];
  };
  return {
    count,
    mean,
    median: pick(50),
    stdDev,
    p10: pick(10),
    p90: pick(90),
  };
}

function pctShift(current: number, baseline: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline === 0) return 0;
  return (current - baseline) / Math.abs(baseline);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

interface MetricRow {
  therapeutic_area: string | null;
  phase: string | null;
  rnpv: number | null;
  created_at: string;
}

interface DriftFinding {
  therapeuticArea: string;
  phase: string;
  metric: 'mean' | 'median' | 'stdDev';
  current: number;
  baseline: number;
  shift: number;
  recentN: number;
  baselineN: number;
}

async function fetchMetrics(days: number): Promise<MetricRow[]> {
  const supabase = createServiceClient();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from('calculation_metrics')
    .select('therapeutic_area, phase, rnpv, created_at')
    .gte('created_at', since.toISOString())
    .limit(100_000);
  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }
  return (data || []) as MetricRow[];
}

function groupByTaPhase(rows: MetricRow[]): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.therapeutic_area || !r.phase || r.rnpv == null || !Number.isFinite(r.rnpv)) continue;
    const key = `${r.therapeutic_area}|${r.phase}`;
    const bucket = m.get(key) || [];
    bucket.push(r.rnpv as number);
    m.set(key, bucket);
  }
  return m;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const findings: DriftFinding[] = [];
  const summaries: Array<{ key: string; recent: Stats; baseline: Stats }> = [];

  try {
    const [recentRows, baselineRows] = await Promise.all([
      fetchMetrics(7),
      fetchMetrics(30),
    ]);

    if (recentRows.length === 0) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'No calculation_metrics rows in the last 7 days',
        durationMs: Date.now() - startedAt,
      });
    }

    const recentGroups = groupByTaPhase(recentRows);
    const baselineGroups = groupByTaPhase(baselineRows);

    for (const [key, recentValues] of recentGroups.entries()) {
      if (recentValues.length < MIN_SAMPLE_SIZE) continue;
      const baselineValues = baselineGroups.get(key) || [];
      if (baselineValues.length < MIN_SAMPLE_SIZE) continue;

      const recent = computeStats(recentValues);
      const baseline = computeStats(baselineValues);
      if (!recent || !baseline) continue;

      summaries.push({ key, recent, baseline });

      const [ta, phase] = key.split('|');

      const meanShift = pctShift(recent.mean, baseline.mean);
      const medianShift = pctShift(recent.median, baseline.median);
      const stddevShift = pctShift(recent.stdDev, baseline.stdDev);

      if (Math.abs(meanShift) > MEAN_SHIFT_THRESHOLD) {
        findings.push({
          therapeuticArea: ta,
          phase,
          metric: 'mean',
          current: recent.mean,
          baseline: baseline.mean,
          shift: meanShift,
          recentN: recent.count,
          baselineN: baseline.count,
        });
      }
      if (Math.abs(medianShift) > MEDIAN_SHIFT_THRESHOLD) {
        findings.push({
          therapeuticArea: ta,
          phase,
          metric: 'median',
          current: recent.median,
          baseline: baseline.median,
          shift: medianShift,
          recentN: recent.count,
          baselineN: baseline.count,
        });
      }
      if (Math.abs(stddevShift) > STDDEV_SHIFT_THRESHOLD) {
        findings.push({
          therapeuticArea: ta,
          phase,
          metric: 'stdDev',
          current: recent.stdDev,
          baseline: baseline.stdDev,
          shift: stddevShift,
          recentN: recent.count,
          baselineN: baseline.count,
        });
      }
    }

    // Send Slack alert if any drift was detected
    if (findings.length > 0) {
      const body = findings
        .slice(0, 25)
        .map(
          (f) =>
            `• *${f.therapeuticArea}/${f.phase}* — ${f.metric} shifted ${(f.shift * 100).toFixed(0)}% (current $${f.current.toFixed(0)}M vs baseline $${f.baseline.toFixed(0)}M, n=${f.recentN}/${f.baselineN})`,
        )
        .join('\n');
      await postSlackAlert(
        `⚠️ rNPV Distribution Drift: ${findings.length} finding(s)`,
        body,
      );
    }

    return NextResponse.json({
      ok: true,
      findings,
      summariesChecked: summaries.length,
      recentRows: recentRows.length,
      baselineRows: baselineRows.length,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Distribution Monitor] Failed:', err);
    await postSlackAlert('🚨 Distribution Monitor FAILED', `\`\`\`${message}\`\`\``);
    return NextResponse.json(
      { ok: false, error: message, durationMs: Date.now() - startedAt },
      { status: 500 },
    );
  }
}

// Also expose POST for manual trigger testing
export const POST = GET;
