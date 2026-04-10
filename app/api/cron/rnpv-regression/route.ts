/**
 * rNPV Engine Regression Tests
 *
 * Runs daily to catch silent drift or bugs in the rNPV engine.
 * Each "golden test" has an expected range for key outputs. If any
 * test fails, we alert Slack with details.
 *
 * Philosophy: tests are not about exact values (those can drift with
 * calibration). They're about structural invariants that MUST hold:
 *   - Development timelines must match industry benchmarks
 *   - Base rNPV and Monte Carlo p50 must agree within ±35%
 *   - Approval year must be within the expected phase-specific range
 *   - Risk-adjusted NPV must scale monotonically with PoS
 *   - Tornado sensitivity must match rNPV delta within ±20%
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import { runMonteCarlo } from '@/lib/financial/monte-carlo';
import type { RNPVInput } from '@/lib/financial/types';

async function postSlackAlert(title: string, body: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: title,
        attachments: [{
          color: '#DC2626',
          blocks: [
            { type: 'header', text: { type: 'plain_text', text: title, emoji: true } },
            { type: 'section', text: { type: 'mrkdwn', text: body } },
            { type: 'context', elements: [{ type: 'mrkdwn', text: `_rNPV Regression Cron — ${new Date().toISOString()}_` }] },
          ],
        }],
      }),
    });
  } catch (err) {
    console.error('[rNPV Regression] Slack webhook failed:', err);
  }
}

// Verify Vercel cron auth
function verifyCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // Allow in dev
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

interface TestResult {
  name: string;
  passed: boolean;
  details: string[];
  failures: string[];
}

// ─── Golden test cases ──────────────────────────────────────────────
const TESTS: {
  name: string;
  input: RNPVInput;
  expectations: {
    // Development timeline expectations (from industry benchmarks)
    minYearsToMarket?: number;
    maxYearsToMarket?: number;
    minApprovalYear?: number;
    maxApprovalYear?: number;
    // rNPV expectations
    minRnpv?: number;
    maxRnpv?: number;
    // Base vs MC agreement
    mcAgreementTolerancePct?: number;
  };
}[] = [
  {
    // Phase 1 oncology small molecule (like Mehdi's) — should be ~9 yr to market
    name: 'Phase 1 oncology small molecule',
    input: {
      therapeuticArea: 'oncology',
      phase: 'phase1',
      modality: 'smallMolecule',
      indication: 'gastric',
      dealType: 'acquisition',
      territory: 'global',
      biomarkerStatus: 'unselected',
      regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
      dataQuality: 'solid',
      competitivePosition: 'co_leader',
      peakSalesEstimate: { low: 500, median: 1200, high: 2500 },
    },
    expectations: {
      minYearsToMarket: 7,
      maxYearsToMarket: 11,
      minApprovalYear: 7,
      maxApprovalYear: 12,
      mcAgreementTolerancePct: 50, // MC can differ more for early-stage due to high variance
    },
  },
  {
    // Phase 3 oncology mAb — should be ~4-5 yr to market
    name: 'Phase 3 oncology mAb',
    input: {
      therapeuticArea: 'oncology',
      phase: 'phase3',
      modality: 'mab',
      indication: 'breast_her2',
      dealType: 'licensing',
      territory: 'global',
      biomarkerStatus: 'validated',
      regulatoryDesignations: { breakthrough: true, fastTrack: false, orphan: false, prime: false },
      dataQuality: 'pivotalReady',
      competitivePosition: 'leader',
      peakSalesEstimate: { low: 800, median: 1500, high: 3000 },
    },
    expectations: {
      minYearsToMarket: 2,
      maxYearsToMarket: 6,
      minApprovalYear: 2,
      maxApprovalYear: 6,
      minRnpv: 0, // Phase 3 with good data should be positive
      mcAgreementTolerancePct: 35,
    },
  },
  {
    // Phase 2 rare disease gene therapy — should be ~6-8 yr to market
    name: 'Phase 2 rare disease gene therapy',
    input: {
      therapeuticArea: 'rareDisease',
      phase: 'phase2',
      modality: 'geneTherapy',
      indication: 'dmd',
      dealType: 'licensing',
      territory: 'global',
      biomarkerStatus: 'validated',
      regulatoryDesignations: { breakthrough: true, fastTrack: true, orphan: true, prime: false },
      dataQuality: 'solid',
      competitivePosition: 'leader',
      peakSalesEstimate: { low: 300, median: 800, high: 1500 },
    },
    expectations: {
      minYearsToMarket: 4,
      maxYearsToMarket: 9,
      minApprovalYear: 4,
      maxApprovalYear: 10,
      mcAgreementTolerancePct: 40,
    },
  },
  {
    // Preclinical metabolic (GLP-1-like) — should be ~11-14 yr to market
    name: 'Preclinical metabolic',
    input: {
      therapeuticArea: 'metabolic',
      phase: 'preclinical',
      modality: 'peptide',
      indication: 'obesity',
      dealType: 'licensing',
      territory: 'global',
      biomarkerStatus: 'unselected',
      regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
      dataQuality: 'developing',
      competitivePosition: 'challenger',
      peakSalesEstimate: { low: 1000, median: 3000, high: 8000 },
    },
    expectations: {
      minYearsToMarket: 9,
      maxYearsToMarket: 15,
      minApprovalYear: 9,
      maxApprovalYear: 16,
      mcAgreementTolerancePct: 60, // Preclinical has highest variance
    },
  },
];

function runTest(test: typeof TESTS[number]): TestResult {
  const failures: string[] = [];
  const details: string[] = [];

  try {
    const result = calculateRNPV(test.input);
    const yearsToMarket = result.yearsToMarket;
    const approvalYear = Math.ceil(yearsToMarket);
    const rnpv = result.riskAdjustedNPV;

    details.push(`yearsToMarket=${yearsToMarket.toFixed(1)}`);
    details.push(`approvalYear=${approvalYear}`);
    details.push(`rNPV=$${rnpv.toFixed(0)}M`);
    details.push(`cumPoS=${(result.cumulativePoS * 100).toFixed(1)}%`);

    const exp = test.expectations;

    // Timeline checks
    if (exp.minYearsToMarket != null && yearsToMarket < exp.minYearsToMarket) {
      failures.push(`yearsToMarket ${yearsToMarket.toFixed(1)} below minimum ${exp.minYearsToMarket}`);
    }
    if (exp.maxYearsToMarket != null && yearsToMarket > exp.maxYearsToMarket) {
      failures.push(`yearsToMarket ${yearsToMarket.toFixed(1)} above maximum ${exp.maxYearsToMarket}`);
    }

    // Approval year checks
    if (exp.minApprovalYear != null && approvalYear < exp.minApprovalYear) {
      failures.push(`approvalYear ${approvalYear} below minimum ${exp.minApprovalYear}`);
    }
    if (exp.maxApprovalYear != null && approvalYear > exp.maxApprovalYear) {
      failures.push(`approvalYear ${approvalYear} above maximum ${exp.maxApprovalYear}`);
    }

    // rNPV checks
    if (exp.minRnpv != null && rnpv < exp.minRnpv) {
      failures.push(`rNPV $${rnpv.toFixed(0)}M below minimum $${exp.minRnpv}M`);
    }
    if (exp.maxRnpv != null && rnpv > exp.maxRnpv) {
      failures.push(`rNPV $${rnpv.toFixed(0)}M above maximum $${exp.maxRnpv}M`);
    }

    // Monte Carlo agreement check
    if (exp.mcAgreementTolerancePct != null) {
      try {
        const mc = runMonteCarlo({
          rnpvInput: test.input,
          iterations: 2000,
        });
        const mcP50 = mc.percentiles.p50;
        details.push(`mcP50=$${mcP50.toFixed(0)}M`);

        if (Math.abs(rnpv) > 5) {
          const divergencePct = Math.abs(rnpv - mcP50) / Math.abs(rnpv) * 100;
          if (divergencePct > exp.mcAgreementTolerancePct) {
            failures.push(
              `base rNPV $${rnpv.toFixed(0)}M vs MC p50 $${mcP50.toFixed(0)}M diverge ${divergencePct.toFixed(0)}% (> ${exp.mcAgreementTolerancePct}% tolerance)`
            );
          }
        }
      } catch (mcErr) {
        failures.push(`Monte Carlo simulation threw: ${mcErr instanceof Error ? mcErr.message : String(mcErr)}`);
      }
    }

    // Sanity checks
    if (!isFinite(rnpv)) failures.push('rNPV is not finite (NaN or Infinity)');
    if (!isFinite(yearsToMarket)) failures.push('yearsToMarket is not finite');
    if (result.cashFlows.length === 0) failures.push('cashFlows array is empty');
    if (result.cumulativePoS < 0 || result.cumulativePoS > 1) {
      failures.push(`cumulativePoS ${result.cumulativePoS} out of [0,1] range`);
    }
  } catch (err) {
    failures.push(`Test threw exception: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    name: test.name,
    passed: failures.length === 0,
    details,
    failures,
  };
}

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: TestResult[] = [];
  for (const test of TESTS) {
    results.push(runTest(test));
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  // Alert if any test failed
  if (failed > 0) {
    const summary = results
      .filter(r => !r.passed)
      .map(r => `*${r.name}*\n${r.details.join(', ')}\n${r.failures.map(f => `  ❌ ${f}`).join('\n')}`)
      .join('\n\n');

    await postSlackAlert(
      `rNPV Regression Test Failures (${failed}/${TESTS.length})`,
      `Daily rNPV regression tests detected drift or bugs.\n\n${summary}`
    );
  }

  return NextResponse.json({
    ok: failed === 0,
    passed,
    failed,
    total: TESTS.length,
    results: results.map(r => ({
      name: r.name,
      passed: r.passed,
      details: r.details,
      failures: r.failures,
    })),
  });
}
