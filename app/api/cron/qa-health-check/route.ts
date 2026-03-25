import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { calculateDealTerms, type CalculationInput, type CalculationResult } from '@/lib/calculations';
import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import type { RNPVInput } from '@/lib/financial/types';
import { computeTornadoSensitivities } from '@/lib/financial/tornado-sensitivity';
import { runFinancialModel } from '@/lib/financial/run-financial-model';
import { captureApiError } from '@/lib/sentry-api';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  details: string;
}

// Shared test input for all engine checks
const TEST_INPUT: CalculationInput = {
  therapeuticArea: 'oncology',
  phase: 'phase2',
  modality: 'smallMolecule',
  indication: 'lung_nsclc',
  territory: 'global',
  dealType: 'licensing',
  biomarker: 'unselected',
  lineOfTherapy: '1L',
  treatmentApproach: 'diseaseModifying',
  combinationPotential: 'some',
  competitivePosition: 'firstInClass',
  dataQuality: 'strongPhase2',
  regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
};

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

  // ═══════════════════════════════════════════════════
  // CHECK 1: Deal Terms Engine (all 12 TAs)
  // ═══════════════════════════════════════════════════
  const testProfiles: { ta: string; modality: string; indication: string; minUp: number; maxUp: number }[] = [
    { ta: 'oncology', modality: 'smallMolecule', indication: 'solid_tumor', minUp: 10, maxUp: 500 },
    { ta: 'oncology', modality: 'adc', indication: 'solid_tumor', minUp: 20, maxUp: 600 },
    { ta: 'neurology', modality: 'smallMolecule', indication: 'neurodegeneration', minUp: 10, maxUp: 400 },
    { ta: 'immunology', modality: 'monoclonalAntibody', indication: 'autoimmune_systemic', minUp: 20, maxUp: 500 },
    { ta: 'metabolic', modality: 'smallMolecule', indication: 'diabetes_type2', minUp: 15, maxUp: 500 },
    { ta: 'rareDisease', modality: 'geneTherapy', indication: 'rare_genetic', minUp: 20, maxUp: 600 },
    { ta: 'cardiovascular', modality: 'smallMolecule', indication: 'heart_failure', minUp: 10, maxUp: 500 },
    { ta: 'infectiousDisease', modality: 'smallMolecule', indication: 'bacterial', minUp: 10, maxUp: 400 },
    { ta: 'hematology', modality: 'cellTherapy', indication: 'aml', minUp: 20, maxUp: 600 },
    { ta: 'ophthalmology', modality: 'monoclonalAntibody', indication: 'wet_amd', minUp: 10, maxUp: 500 },
    { ta: 'dermatology', modality: 'monoclonalAntibody', indication: 'atopic_dermatitis', minUp: 10, maxUp: 500 },
    { ta: 'gastroenterology', modality: 'monoclonalAntibody', indication: 'crohns', minUp: 15, maxUp: 500 },
  ];

  let calcPassed = 0;
  let calcFailed = 0;
  const calcFailures: string[] = [];

  for (const p of testProfiles) {
    try {
      const input: CalculationInput = {
        ...TEST_INPUT,
        therapeuticArea: p.ta as CalculationInput['therapeuticArea'],
        phase: 'preclinical' as CalculationInput['phase'],
        modality: p.modality as CalculationInput['modality'],
        indication: p.indication as CalculationInput['indication'],
      };
      const result = calculateDealTerms(input);
      const up = result.terms.upfront.median;
      const tdv = result.terms.totalDealValue.median;

      if (up <= 0 || tdv <= 0) {
        calcFailed++;
        calcFailures.push(`${p.ta}/${p.modality}: zero values`);
      } else if (tdv < up) {
        calcFailed++;
        calcFailures.push(`${p.ta}/${p.modality}: TDV < upfront`);
      } else {
        calcPassed++;
      }
    } catch (err) {
      calcFailed++;
      calcFailures.push(`${p.ta}/${p.modality}: CRASH — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  checks.push({
    name: 'Deal Terms Engine',
    status: calcFailed === 0 ? 'pass' : 'fail',
    details: calcFailed === 0 ? `${calcPassed}/12 TAs valid` : `${calcFailed} failures: ${calcFailures.join('; ')}`,
  });

  // ═══════════════════════════════════════════════════
  // CHECK 2: rNPV Engine
  // ═══════════════════════════════════════════════════
  try {
    const rnpvInput: RNPVInput = {
      phase: 'phase2',
      therapeuticArea: 'oncology',
      modality: 'smallMolecule',
      indication: 'lung_nsclc',
      territory: 'global',
      peakSalesEstimate: { low: 500, median: 1000, high: 2000 },
      competitivePosition: 'firstInClass',
      dataQuality: 'robust',
      regulatoryDesignations: { breakthrough: true, fastTrack: false, orphan: false, prime: false },
    };

    const rnpvResult = calculateRNPV(rnpvInput);

    if (rnpvResult.riskAdjustedNPV <= 0) {
      checks.push({ name: 'rNPV Engine', status: 'fail', details: `rNPV = ${rnpvResult.riskAdjustedNPV} (expected > 0)` });
    } else if (rnpvResult.cumulativePoS <= 0 || rnpvResult.cumulativePoS > 1) {
      checks.push({ name: 'rNPV Engine', status: 'fail', details: `PoS = ${rnpvResult.cumulativePoS} (expected 0-1)` });
    } else if (!rnpvResult.phaseTransitions || rnpvResult.phaseTransitions.length === 0) {
      checks.push({ name: 'rNPV Engine', status: 'fail', details: 'No phase transitions returned' });
    } else {
      checks.push({ name: 'rNPV Engine', status: 'pass', details: `rNPV $${Math.round(rnpvResult.riskAdjustedNPV)}M | PoS ${(rnpvResult.cumulativePoS * 100).toFixed(1)}% | ${rnpvResult.phaseTransitions.length} phases` });
    }
  } catch (err) {
    checks.push({ name: 'rNPV Engine', status: 'fail', details: `CRASH — ${err instanceof Error ? err.message : String(err)}` });
  }

  // ═══════════════════════════════════════════════════
  // CHECK 3: Financial Model (rNPV + Monte Carlo + Scenarios)
  // ═══════════════════════════════════════════════════
  try {
    const dealTermsResult = calculateDealTerms(TEST_INPUT);
    const financialResult = runFinancialModel(TEST_INPUT, dealTermsResult);

    const mcOk = financialResult.monteCarlo && financialResult.monteCarlo.iterations >= 1000;
    const rnpvOk = financialResult.rnpv && financialResult.rnpv.riskAdjustedNPV > 0;
    const defenseOk = financialResult.defensiveAnalysis && financialResult.defensiveAnalysis.defensiveFloor >= 0;

    if (mcOk && rnpvOk && defenseOk) {
      const mc = financialResult.monteCarlo;
      checks.push({ name: 'Financial Model (MC+rNPV)', status: 'pass', details: `${mc.iterations} iterations | P50 $${Math.round(mc.percentiles.p50)}M | P(NPV>0) ${(mc.probabilityOfPositiveNPV * 100).toFixed(0)}%` });
    } else {
      const issues = [];
      if (!mcOk) issues.push('Monte Carlo failed');
      if (!rnpvOk) issues.push('rNPV failed');
      if (!defenseOk) issues.push('Defensive analysis failed');
      checks.push({ name: 'Financial Model (MC+rNPV)', status: 'fail', details: issues.join('; ') });
    }
  } catch (err) {
    checks.push({ name: 'Financial Model (MC+rNPV)', status: 'fail', details: `CRASH — ${err instanceof Error ? err.message : String(err)}` });
  }

  // ═══════════════════════════════════════════════════
  // CHECK 4: Tornado Sensitivity
  // ═══════════════════════════════════════════════════
  try {
    const dealTermsResult = calculateDealTerms(TEST_INPUT);
    const sensitivities = computeTornadoSensitivities(TEST_INPUT, dealTermsResult);

    if (!sensitivities || sensitivities.length === 0) {
      checks.push({ name: 'Tornado Sensitivity', status: 'fail', details: 'No sensitivities returned' });
    } else {
      const valid = sensitivities.every(s => s.highValue >= s.lowValue);
      checks.push({
        name: 'Tornado Sensitivity',
        status: valid ? 'pass' : 'warn',
        details: `${sensitivities.length} factors | Top driver: ${sensitivities[0]?.factor || 'N/A'}`,
      });
    }
  } catch (err) {
    checks.push({ name: 'Tornado Sensitivity', status: 'fail', details: `CRASH — ${err instanceof Error ? err.message : String(err)}` });
  }

  // ═══════════════════════════════════════════════════
  // CHECK 5: Partner Matching
  // ═══════════════════════════════════════════════════
  try {
    const { findPartnerMatches } = await import('@/lib/services/partner-matching');
    const matchResult = await findPartnerMatches(supabase, {
      modality: 'smallMolecule',
      development_phase: 'phase2',
      indication_category: 'solid_tumor',
      indication_specific: null,
      territory_scope: 'global',
      therapeutic_area: 'oncology',
    }, { limit: 5, includeEnhancedBreakdown: false });

    if (matchResult.total_matches >= 0 && matchResult.generated_at) {
      checks.push({ name: 'Partner Matching', status: 'pass', details: `${matchResult.total_matches} matches found | Top: ${matchResult.matches[0]?.company_name || 'N/A'}` });
    } else {
      checks.push({ name: 'Partner Matching', status: 'warn', details: `Unexpected result format` });
    }
  } catch (err) {
    checks.push({ name: 'Partner Matching', status: 'warn', details: `Error — ${err instanceof Error ? err.message : String(err)}` });
  }

  // ═══════════════════════════════════════════════════
  // CHECK 6: Competitive Landscape
  // ═══════════════════════════════════════════════════
  try {
    const { analyzeCompetitiveLandscape } = await import('@/lib/services/pipeline-intelligence');
    const landscape = await analyzeCompetitiveLandscape(supabase, 'lung_nsclc', 'smallMolecule');

    if (landscape && landscape.competitiveDensityScore >= 0) {
      checks.push({ name: 'Competitive Landscape', status: 'pass', details: `Density ${landscape.competitiveDensityScore}/100 | ${landscape.totalCompetingAssets} competing assets` });
    } else {
      checks.push({ name: 'Competitive Landscape', status: 'warn', details: 'Unexpected result' });
    }
  } catch (err) {
    checks.push({ name: 'Competitive Landscape', status: 'warn', details: `Error — ${err instanceof Error ? err.message : String(err)}` });
  }

  // ═══════════════════════════════════════════════════
  // CHECK 7: Deal Ingestion Pipeline
  // ═══════════════════════════════════════════════════
  try {
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
  } catch (err) {
    checks.push({ name: 'Deal Ingestion (3d)', status: 'fail', details: `DB error — ${err instanceof Error ? err.message : String(err)}` });
  }

  // ═══════════════════════════════════════════════════
  // CHECK 8: Data Quality
  // ═══════════════════════════════════════════════════
  try {
    const { count: negativeValueCount } = await supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .lt('upfront_usd', 0);

    const { count: totalCalibrations } = await supabase
      .from('benchmark_calibrations')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    checks.push({
      name: 'Data Quality',
      status: (negativeValueCount ?? 0) === 0 ? 'pass' : 'fail',
      details: `${negativeValueCount ?? 0} negative deal values | ${totalCalibrations ?? 0} calibrations (7d)`,
    });
  } catch (err) {
    checks.push({ name: 'Data Quality', status: 'fail', details: `DB error` });
  }

  // ═══════════════════════════════════════════════════
  // CHECK 9: Platform Health
  // ═══════════════════════════════════════════════════
  try {
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

    const sendgridOk = !!process.env.SENDGRID_API_KEY;
    const slackOk = !!process.env.SLACK_WEBHOOK_URL;

    checks.push({
      name: 'Platform Health',
      status: sendgridOk && slackOk ? 'pass' : 'warn',
      details: `${totalUsers ?? 0} users (${proUsers ?? 0} Pro) | ${recentCalcCount ?? 0} calcs (24h) | Email: ${sendgridOk ? 'OK' : 'OFF'} | Slack: ${slackOk ? 'OK' : 'OFF'}`,
    });
  } catch (err) {
    checks.push({ name: 'Platform Health', status: 'warn', details: `DB error` });
  }

  // ═══════════════════════════════════════════════════
  // SEND TO SLACK
  // ═══════════════════════════════════════════════════
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
            { type: 'header', text: { type: 'plain_text', text: `Daily QA/QC — ${statusText}` } },
            { type: 'section', text: { type: 'mrkdwn', text: checkLines } },
            { type: 'context', elements: [{ type: 'mrkdwn', text: `${new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} ET | 9 checks across 7 engines` }] },
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
}
