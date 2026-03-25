import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { calculateDealTerms, type CalculationInput } from '@/lib/calculations';
import { captureApiError } from '@/lib/sentry-api';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  details: string;
}

/**
 * GET /api/cron/qa-health-check
 *
 * Daily QA/QC health check that validates:
 * 1. Calculation engine produces sane outputs across all 13 TAs
 * 2. Recent deals are being ingested (data pipeline health)
 * 3. Data quality (no nulls, values in expected ranges)
 * 4. Cron job completion (recent calibration, ingestion)
 * 5. User/subscription health
 *
 * Sends results to Slack. Auth: Bearer $CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  }

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid = isValidLength && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const checks: CheckResult[] = [];
  const supabase = createServiceClient();

  try {
    // ═══════════════════════════════════════════
    // CHECK 1: Calculation Engine Health
    // Run reference calculations across all TAs
    // ═══════════════════════════════════════════
    const testProfiles: { ta: string; modality: string; indication: string; minUpfront: number; maxUpfront: number }[] = [
      { ta: 'oncology', modality: 'smallMolecule', indication: 'solid_tumor', minUpfront: 10, maxUpfront: 200 },
      { ta: 'oncology', modality: 'adc', indication: 'solid_tumor', minUpfront: 20, maxUpfront: 300 },
      { ta: 'neurology', modality: 'smallMolecule', indication: 'neurodegeneration', minUpfront: 10, maxUpfront: 200 },
      { ta: 'immunology', modality: 'monoclonalAntibody', indication: 'autoimmune_systemic', minUpfront: 20, maxUpfront: 300 },
      { ta: 'metabolic', modality: 'smallMolecule', indication: 'diabetes_type2', minUpfront: 15, maxUpfront: 250 },
      { ta: 'rareDisease', modality: 'geneTherapy', indication: 'rare_genetic', minUpfront: 20, maxUpfront: 400 },
      { ta: 'cardiovascular', modality: 'smallMolecule', indication: 'heart_failure', minUpfront: 10, maxUpfront: 250 },
      { ta: 'infectiousDisease', modality: 'smallMolecule', indication: 'bacterial', minUpfront: 10, maxUpfront: 200 },
      { ta: 'hematology', modality: 'cellTherapy', indication: 'aml', minUpfront: 20, maxUpfront: 400 },
      { ta: 'ophthalmology', modality: 'monoclonalAntibody', indication: 'wet_amd', minUpfront: 10, maxUpfront: 300 },
      { ta: 'dermatology', modality: 'monoclonalAntibody', indication: 'atopic_dermatitis', minUpfront: 10, maxUpfront: 250 },
      { ta: 'gastroenterology', modality: 'monoclonalAntibody', indication: 'crohns', minUpfront: 15, maxUpfront: 300 },
    ];

    let calcPassed = 0;
    let calcFailed = 0;
    const calcFailures: string[] = [];

    for (const profile of testProfiles) {
      try {
        const input: CalculationInput = {
          therapeuticArea: profile.ta as CalculationInput['therapeuticArea'],
          phase: 'preclinical' as CalculationInput['phase'],
          modality: profile.modality as CalculationInput['modality'],
          indication: profile.indication as CalculationInput['indication'],
          territory: 'global' as CalculationInput['territory'],
          dealType: 'licensing',
          biomarker: 'unselected',
          lineOfTherapy: '1L',
          treatmentApproach: 'diseaseModifying',
          combinationPotential: 'some',
          competitivePosition: 'firstInClass',
          dataQuality: 'strongPhase2',
          regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
        };

        const result = calculateDealTerms(input);
        const upfront = result.terms.upfront.median;
        const tdv = result.terms.totalDealValue.median;

        if (upfront <= 0 || tdv <= 0) {
          calcFailed++;
          calcFailures.push(`${profile.ta}/${profile.modality}: zero/negative values (upfront=${upfront}, tdv=${tdv})`);
        } else if (upfront < profile.minUpfront || upfront > profile.maxUpfront) {
          calcFailed++;
          calcFailures.push(`${profile.ta}/${profile.modality}: upfront $${upfront}M outside range $${profile.minUpfront}-${profile.maxUpfront}M`);
        } else if (tdv < upfront) {
          calcFailed++;
          calcFailures.push(`${profile.ta}/${profile.modality}: TDV ($${tdv}M) less than upfront ($${upfront}M)`);
        } else {
          calcPassed++;
        }
      } catch (err) {
        calcFailed++;
        calcFailures.push(`${profile.ta}/${profile.modality}: CRASHED — ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    checks.push({
      name: 'Calculation Engine',
      status: calcFailed === 0 ? 'pass' : calcFailed <= 2 ? 'warn' : 'fail',
      details: calcFailed === 0
        ? `${calcPassed}/${testProfiles.length} TAs producing valid output`
        : `${calcFailed} failures: ${calcFailures.join('; ')}`,
    });

    // ═══════════════════════════════════════════
    // CHECK 2: Data Pipeline Health
    // Are new deals being ingested?
    // ═══════════════════════════════════════════
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentDealCount } = await supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', threeDaysAgo);

    const { count: totalDealCount } = await supabase
      .from('deals')
      .select('id', { count: 'exact', head: true });

    checks.push({
      name: 'Deal Ingestion (3d)',
      status: (recentDealCount ?? 0) > 0 ? 'pass' : 'warn',
      details: `${recentDealCount ?? 0} new deals in last 3 days (${totalDealCount ?? 0} total)`,
    });

    // ═══════════════════════════════════════════
    // CHECK 3: Data Quality
    // Null upfronts, negative values, etc.
    // ═══════════════════════════════════════════
    const { count: nullUpfrontCount } = await supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .is('upfront_usd', null)
      .gte('created_at', threeDaysAgo);

    const { count: negativeValueCount } = await supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .lt('upfront_usd', 0);

    checks.push({
      name: 'Data Quality',
      status: (negativeValueCount ?? 0) === 0 ? 'pass' : 'fail',
      details: `${nullUpfrontCount ?? 0} null upfronts in recent deals, ${negativeValueCount ?? 0} negative values`,
    });

    // ═══════════════════════════════════════════
    // CHECK 4: Calibration Health
    // Has benchmark calibration run recently?
    // ═══════════════════════════════════════════
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCalibrations } = await supabase
      .from('benchmark_calibrations')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo);

    checks.push({
      name: 'Benchmark Calibration',
      status: (recentCalibrations ?? 0) > 0 ? 'pass' : 'warn',
      details: `${recentCalibrations ?? 0} calibrations in last 7 days`,
    });

    // ═══════════════════════════════════════════
    // CHECK 5: User & Subscription Health
    // ═══════════════════════════════════════════
    const { count: totalUsers } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true });

    const { count: proUsers } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('tier', 'pro');

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCalcCount } = await supabase
      .from('calculations')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo);

    checks.push({
      name: 'Platform Usage (24h)',
      status: 'pass',
      details: `${totalUsers ?? 0} users (${proUsers ?? 0} Pro), ${recentCalcCount ?? 0} calculations in last 24h`,
    });

    // ═══════════════════════════════════════════
    // CHECK 6: Email & Notification Health
    // ═══════════════════════════════════════════
    const sendgridConfigured = !!process.env.SENDGRID_API_KEY;
    const slackConfigured = !!process.env.SLACK_WEBHOOK_URL;

    checks.push({
      name: 'Notifications',
      status: sendgridConfigured && slackConfigured ? 'pass' : 'warn',
      details: `SendGrid: ${sendgridConfigured ? 'OK' : 'MISSING'} | Slack: ${slackConfigured ? 'OK' : 'MISSING'}`,
    });

    // ═══════════════════════════════════════════
    // SEND RESULTS TO SLACK
    // ═══════════════════════════════════════════
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      const allPassed = checks.every(c => c.status === 'pass');
      const hasFailures = checks.some(c => c.status === 'fail');
      const statusEmoji = hasFailures ? ':red_circle:' : allPassed ? ':large_green_circle:' : ':large_yellow_circle:';
      const statusText = hasFailures ? 'FAILURES DETECTED' : allPassed ? 'ALL CHECKS PASSED' : 'WARNINGS';

      const checkLines = checks.map(c => {
        const icon = c.status === 'pass' ? ':white_check_mark:' : c.status === 'warn' ? ':warning:' : ':x:';
        return `${icon} *${c.name}*: ${c.details}`;
      }).join('\n');

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${statusEmoji} Daily QA/QC: ${statusText}`,
          attachments: [{
            color: hasFailures ? '#dc2626' : allPassed ? '#16a34a' : '#f59e0b',
            blocks: [
              { type: 'header', text: { type: 'plain_text', text: `Daily QA/QC Health Check — ${statusText}` } },
              { type: 'section', text: { type: 'mrkdwn', text: checkLines } },
              { type: 'context', elements: [{ type: 'mrkdwn', text: `Run at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} ET` }] },
            ],
          }],
        }),
      });
    }

    return NextResponse.json({
      success: true,
      overall: checks.every(c => c.status === 'pass') ? 'healthy' : checks.some(c => c.status === 'fail') ? 'unhealthy' : 'degraded',
      checks,
    });
  } catch (error) {
    captureApiError(error, 'qa-health-check');
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 });
  }
}
