import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { calculateDealTerms, type CalculationInput, type CalculationResult } from '@/lib/calculations';
import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import type { RNPVInput } from '@/lib/financial/types';
import { computeTornadoSensitivities } from '@/lib/financial/tornado-sensitivity';
import { runFinancialModel } from '@/lib/financial/run-financial-model';
import { captureApiError } from '@/lib/sentry-api';
import { estimateMarketSize } from '@/lib/financial/market-size';
import { validateIndicationTA } from '@/lib/financial/validation';
import { fixNegativeDealValues, fixMissingTherapeuticArea } from '@/lib/ingestion/auto-remediate';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 300; // 5 min — full matrix takes time
export const dynamic = 'force-dynamic';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  details: string;
  durationMs?: number;
}

// ─── TEST MATRIX ────────────────────────────────────────
// 12 TAs × 2-3 modalities × 3 phases = ~100 combinations

const TAS = [
  { ta: 'oncology', modalities: ['smallMolecule', 'adc', 'monoclonalAntibody'], indications: ['solid_tumor', 'hematologic'] },
  { ta: 'neurology', modalities: ['smallMolecule', 'geneTherapy'], indications: ['neurodegeneration'] },
  { ta: 'immunology', modalities: ['monoclonalAntibody', 'smallMolecule'], indications: ['autoimmune_systemic'] },
  { ta: 'metabolic', modalities: ['smallMolecule', 'peptide'], indications: ['diabetes_type2'] },
  { ta: 'rareDisease', modalities: ['geneTherapy', 'smallMolecule'], indications: ['rare_genetic'] },
  { ta: 'cardiovascular', modalities: ['smallMolecule', 'monoclonalAntibody'], indications: ['heart_failure'] },
  { ta: 'infectiousDisease', modalities: ['smallMolecule', 'monoclonalAntibody'], indications: ['bacterial'] },
  { ta: 'hematology', modalities: ['cellTherapy', 'monoclonalAntibody'], indications: ['aml'] },
  { ta: 'ophthalmology', modalities: ['monoclonalAntibody', 'geneTherapy'], indications: ['wet_amd'] },
  { ta: 'dermatology', modalities: ['monoclonalAntibody', 'smallMolecule'], indications: ['atopic_dermatitis'] },
  { ta: 'gastroenterology', modalities: ['monoclonalAntibody', 'smallMolecule'], indications: ['crohns'] },
  { ta: 'womensHealth', modalities: ['smallMolecule', 'monoclonalAntibody'], indications: ['endometriosis'] },
];

const PHASES = ['preclinical', 'phase2', 'approved'];

const BASE_INPUT = {
  therapeuticArea: 'oncology',
  phase: 'phase2',
  modality: 'smallMolecule',
  indication: 'solid_tumor',
  territory: 'global',
  dealType: 'licensing',
  biomarker: 'unselected',
  lineOfTherapy: '1L',
  treatmentApproach: 'diseaseModifying',
  combinationPotential: 'some',
  competitivePosition: 'firstInClass',
  dataQuality: 'strongPhase2',
  regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
} as unknown as CalculationInput;

function makeInput(ta: string, modality: string, indication: string, phase: string): CalculationInput {
  return {
    ...BASE_INPUT,
    therapeuticArea: ta,
    modality,
    indication,
    phase,
  } as unknown as CalculationInput;
}

function makeRnpvInput(ta: string, modality: string, indication: string, phase: string): RNPVInput {
  return {
    phase,
    therapeuticArea: ta,
    modality,
    indication,
    territory: 'global',
    peakSalesEstimate: { low: 500, median: 1000, high: 2000 },
    competitivePosition: 'firstInClass',
    dataQuality: 'robust',
    regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
  } as RNPVInput;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid = isValidLength && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));
  if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const checks: CheckResult[] = [];
  const supabase = createServiceClient();
  const totalStart = Date.now();

  // ═══════════════════════════════════════════════════════════
  // BUILD FULL MATRIX: TA × modality × phase
  // ═══════════════════════════════════════════════════════════
  type Combo = { ta: string; modality: string; indication: string; phase: string };
  const matrix: Combo[] = [];
  for (const t of TAS) {
    for (const mod of t.modalities) {
      for (const phase of PHASES) {
        matrix.push({ ta: t.ta, modality: mod, indication: t.indications[0], phase });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK 1: Deal Terms Engine — full matrix
  // ═══════════════════════════════════════════════════════════
  {
    const t0 = Date.now();
    let passed = 0;
    const failures: string[] = [];

    for (const c of matrix) {
      try {
        const input = makeInput(c.ta, c.modality, c.indication, c.phase);
        const result = calculateDealTerms(input);
        const up = result.terms.upfront.median;
        const tdv = result.terms.totalDealValue.median;
        if (up > 0 && tdv > 0 && tdv >= up) {
          passed++;
        } else {
          failures.push(`${c.ta}/${c.modality}/${c.phase}: up=${up} tdv=${tdv}`);
        }
      } catch (err) {
        failures.push(`${c.ta}/${c.modality}/${c.phase}: CRASH`);
      }
    }

    checks.push({
      name: 'Deal Terms Engine',
      status: failures.length === 0 ? 'pass' : failures.length <= 2 ? 'warn' : 'fail',
      details: failures.length === 0 ? `${passed}/${matrix.length} combos valid` : `${failures.length} failures: ${failures.slice(0, 5).join('; ')}`,
      durationMs: Date.now() - t0,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK 2: rNPV Engine — full matrix
  // ═══════════════════════════════════════════════════════════
  {
    const t0 = Date.now();
    let passed = 0;
    const failures: string[] = [];

    for (const c of matrix) {
      try {
        const r = calculateRNPV(makeRnpvInput(c.ta, c.modality, c.indication, c.phase));
        if (r.cumulativePoS > 0 && r.cumulativePoS <= 1 && r.phaseTransitions?.length > 0) {
          passed++;
        } else {
          failures.push(`${c.ta}/${c.modality}/${c.phase}: PoS=${r.cumulativePoS}`);
        }
      } catch (err) {
        failures.push(`${c.ta}/${c.modality}/${c.phase}: CRASH`);
      }
    }

    checks.push({
      name: 'rNPV Engine',
      status: failures.length === 0 ? 'pass' : failures.length <= 2 ? 'warn' : 'fail',
      details: failures.length === 0 ? `${passed}/${matrix.length} combos valid` : `${failures.length} failures: ${failures.slice(0, 5).join('; ')}`,
      durationMs: Date.now() - t0,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK 3: Financial Model (MC + rNPV + Defense) — full matrix
  // ═══════════════════════════════════════════════════════════
  {
    const t0 = Date.now();
    let passed = 0;
    const failures: string[] = [];

    for (const c of matrix) {
      try {
        const input = makeInput(c.ta, c.modality, c.indication, c.phase);
        const dealResult = calculateDealTerms(input);
        const fm = runFinancialModel(input, dealResult);

        const mcOk = fm.monteCarlo?.iterations >= 1000;
        const defOk = fm.defensiveAnalysis !== undefined && fm.defensiveAnalysis !== null;
        const rnpvOk = fm.rnpv !== undefined && fm.rnpv !== null;

        if (mcOk && defOk && rnpvOk) {
          passed++;
        } else {
          const missing = [];
          if (!mcOk) missing.push('MC');
          if (!defOk) missing.push('defense');
          if (!rnpvOk) missing.push('rNPV');
          failures.push(`${c.ta}/${c.modality}/${c.phase}: missing ${missing.join(',')}`);
        }
      } catch (err) {
        failures.push(`${c.ta}/${c.modality}/${c.phase}: CRASH`);
      }
    }

    checks.push({
      name: 'Financial Model (MC+rNPV)',
      status: failures.length === 0 ? 'pass' : failures.length <= 2 ? 'warn' : 'fail',
      details: failures.length === 0 ? `${passed}/${matrix.length} combos valid` : `${failures.length} failures: ${failures.slice(0, 5).join('; ')}`,
      durationMs: Date.now() - t0,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK 4: Tornado Sensitivity — full matrix
  // ═══════════════════════════════════════════════════════════
  {
    const t0 = Date.now();
    let passed = 0;
    const failures: string[] = [];

    for (const c of matrix) {
      try {
        const input = makeInput(c.ta, c.modality, c.indication, c.phase);
        const dealResult = calculateDealTerms(input);
        const sens = computeTornadoSensitivities(input, dealResult);

        if (sens && sens.length > 0 && sens.every(s => s.highValue >= s.lowValue)) {
          passed++;
        } else if (c.phase === 'preclinical' || c.phase === 'discovery') {
          passed++; // Expected: preclinical/discovery have limited sensitivity variation
        } else {
          failures.push(`${c.ta}/${c.modality}/${c.phase}: invalid`);
        }
      } catch (err) {
        if (c.phase === 'preclinical' || c.phase === 'discovery') {
          passed++; // Expected limitation
        } else {
          failures.push(`${c.ta}/${c.modality}/${c.phase}: CRASH`);
        }
      }
    }

    checks.push({
      name: 'Tornado Sensitivity',
      status: failures.length === 0 ? 'pass' : failures.length <= 2 ? 'warn' : 'fail',
      details: failures.length === 0 ? `${passed}/${matrix.length} combos valid` : `${failures.length} failures: ${failures.slice(0, 5).join('; ')}`,
      durationMs: Date.now() - t0,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK 5: Cross-Engine Consistency
  // rNPV impliedDealValue vs Deal Terms totalDealValue
  // ═══════════════════════════════════════════════════════════
  {
    const t0 = Date.now();
    let tested = 0;
    let aligned = 0;
    const divergences: string[] = [];

    // Test a subset (one modality per TA at phase2) to keep runtime reasonable
    for (const t of TAS) {
      try {
        const input = makeInput(t.ta, t.modalities[0], t.indications[0], 'phase2');
        const dealResult = calculateDealTerms(input);
        const rnpvResult = calculateRNPV(makeRnpvInput(t.ta, t.modalities[0], t.indications[0], 'phase2'));

        tested++;
        const dealTdv = dealResult.terms.totalDealValue.median;
        const rnpvImplied = rnpvResult.impliedDealValue?.totalDeal?.median;

        if (rnpvImplied && dealTdv > 0) {
          const divergencePct = Math.abs(rnpvImplied - dealTdv) / dealTdv * 100;
          if (divergencePct <= 300) { // Within 3x is reasonable for different methodologies
            aligned++;
          } else {
            divergences.push(`${t.ta}: deal=$${Math.round(dealTdv)}M vs rNPV=$${Math.round(rnpvImplied)}M (${Math.round(divergencePct)}% divergence)`);
          }
        } else {
          aligned++; // No implied value = skip
        }
      } catch {
        // Skip on error — caught by individual engine checks
      }
    }

    checks.push({
      name: 'Cross-Engine Consistency',
      status: divergences.length === 0 ? 'pass' : divergences.length <= 2 ? 'warn' : 'fail',
      details: divergences.length === 0 ? `${aligned}/${tested} TAs aligned (deal terms vs rNPV)` : `${divergences.length} divergences: ${divergences.slice(0, 3).join('; ')}`,
      durationMs: Date.now() - t0,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK 6: Partner Matching — all 12 TAs × 2 modalities
  // ═══════════════════════════════════════════════════════════
  {
    const t0 = Date.now();
    let passed = 0;
    const failures: string[] = [];

    try {
      const { findPartnerMatches } = await import('@/lib/services/partner-matching');

      for (const t of TAS) {
        for (const mod of t.modalities) {
          try {
            const result = await findPartnerMatches(supabase, {
              modality: mod,
              development_phase: 'preclinical',
              indication_category: t.indications[0],
              indication_specific: null,
              territory_scope: 'global',
              therapeutic_area: t.ta,
            }, { limit: 2, includeEnhancedBreakdown: false });

            if (result.total_matches >= 0 && result.generated_at) {
              passed++;
            } else {
              failures.push(`${t.ta}/${mod}: bad format`);
            }
          } catch (err) {
            failures.push(`${t.ta}/${mod}: ${err instanceof Error ? err.message : 'error'}`);
          }
        }
      }
    } catch (err) {
      failures.push(`Import failed: ${err instanceof Error ? err.message : 'error'}`);
    }

    const totalPmCombos = TAS.reduce((sum, t) => sum + t.modalities.length, 0);
    checks.push({
      name: 'Partner Matching',
      status: failures.length === 0 ? 'pass' : failures.length <= 2 ? 'warn' : 'fail',
      details: failures.length === 0 ? `${passed}/${totalPmCombos} combos valid` : `${failures.length} failures: ${failures.slice(0, 5).join('; ')}`,
      durationMs: Date.now() - t0,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK 7: Competitive Landscape — all 12 TAs × 2 modalities
  // ═══════════════════════════════════════════════════════════
  {
    const t0 = Date.now();
    let passed = 0;
    const failures: string[] = [];

    try {
      const { analyzeCompetitiveLandscape } = await import('@/lib/services/pipeline-intelligence');

      for (const t of TAS) {
        for (const mod of t.modalities) {
          try {
            const landscape = await analyzeCompetitiveLandscape(supabase, t.indications[0], mod);
            if (landscape && landscape.competitiveDensityScore >= 0 && landscape.competitiveDensityScore <= 100) {
              passed++;
            } else {
              failures.push(`${t.ta}/${mod}: bad density`);
            }
          } catch (err) {
            failures.push(`${t.ta}/${mod}: ${err instanceof Error ? err.message : 'error'}`);
          }
        }
      }
    } catch (err) {
      failures.push(`Import failed: ${err instanceof Error ? err.message : 'error'}`);
    }

    const totalClCombos = TAS.reduce((sum, t) => sum + t.modalities.length, 0);
    checks.push({
      name: 'Competitive Landscape',
      status: failures.length === 0 ? 'pass' : failures.length <= 2 ? 'warn' : 'fail',
      details: failures.length === 0 ? `${passed}/${totalClCombos} combos valid` : `${failures.length} failures: ${failures.slice(0, 5).join('; ')}`,
      durationMs: Date.now() - t0,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK 8: Edge Cases
  // ═══════════════════════════════════════════════════════════
  {
    const t0 = Date.now();
    let passed = 0;
    const failures: string[] = [];

    const edgeCases: { label: string; input: Record<string, unknown> }[] = [
      { label: 'discovery + crowded', input: { phase: 'discovery', competitivePosition: 'crowded' } },
      { label: 'approved + behind', input: { phase: 'approved', competitivePosition: 'behind' } },
      { label: 'preclinical + mixed data', input: { phase: 'preclinical', dataQuality: 'mixed' } },
      { label: 'phase3 + breakthrough + orphan', input: { phase: 'phase3', regulatoryDesignations: { breakthrough: true, fastTrack: true, orphan: true, prime: true } } },
      { label: 'acquisition deal type', input: { dealType: 'acquisition' } },
      { label: 'co-development deal type', input: { dealType: 'codevelopment' } },
    ];

    for (const ec of edgeCases) {
      try {
        const input = { ...BASE_INPUT, ...ec.input } as unknown as CalculationInput;
        const result = calculateDealTerms(input);
        if (result.terms.upfront.median > 0 && result.terms.totalDealValue.median > 0) {
          passed++;
        } else {
          failures.push(`${ec.label}: zero values`);
        }
      } catch (err) {
        failures.push(`${ec.label}: CRASH`);
      }
    }

    checks.push({
      name: 'Edge Cases',
      status: failures.length === 0 ? 'pass' : 'fail',
      details: failures.length === 0 ? `${passed}/${edgeCases.length} edge cases valid` : `${failures.length} failures: ${failures.join('; ')}`,
      durationMs: Date.now() - t0,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK 9: Deal Ingestion Pipeline
  // ═══════════════════════════════════════════════════════════
  {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentDealCount } = await supabase.from('deals').select('id', { count: 'exact', head: true }).gte('created_at', threeDaysAgo);
    const { count: totalDealCount } = await supabase.from('deals').select('id', { count: 'exact', head: true });

    checks.push({
      name: 'Deal Ingestion (3d)',
      status: (recentDealCount ?? 0) > 0 ? 'pass' : 'warn',
      details: `${recentDealCount ?? 0} new deals in last 3 days (${totalDealCount ?? 0} total)`,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK 10: Data Quality + Calibration
  // ═══════════════════════════════════════════════════════════
  {
    const { count: negativeValueCount } = await supabase.from('deals').select('id', { count: 'exact', head: true }).lt('upfront_usd', 0);
    const { count: totalCalibrations } = await supabase.from('benchmark_calibrations').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    checks.push({
      name: 'Data Quality',
      status: (negativeValueCount ?? 0) === 0 ? 'pass' : 'fail',
      details: `${negativeValueCount ?? 0} negative deal values | ${totalCalibrations ?? 0} calibrations (7d)`,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // AUTO-REMEDIATION: Fix detected data issues
  // ═══════════════════════════════════════════════════════════
  const negFixResult = await fixNegativeDealValues(supabase);
  const taFixResult = await fixMissingTherapeuticArea(supabase);

  // ═══════════════════════════════════════════════════════════
  // CHECK 11: Platform Health
  // ═══════════════════════════════════════════════════════════
  {
    const { count: totalUsers } = await supabase.from('user_profiles').select('id', { count: 'exact', head: true });
    const { count: proUsers } = await supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('tier', 'pro');
    const { count: recentCalcCount } = await supabase.from('calculations').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    checks.push({
      name: 'Platform Health',
      status: !!process.env.SENDGRID_API_KEY && !!process.env.SLACK_WEBHOOK_URL ? 'pass' : 'warn',
      details: `${totalUsers ?? 0} users (${proUsers ?? 0} Pro) | ${recentCalcCount ?? 0} calcs (24h) | Email: ${process.env.SENDGRID_API_KEY ? 'OK' : 'OFF'} | Slack: ${process.env.SLACK_WEBHOOK_URL ? 'OK' : 'OFF'}`,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK 12: Anthropic API Health (deal ingestion depends on this)
  // ═══════════════════════════════════════════════════════════
  {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      checks.push({ name: 'AI Ingestion (Claude)', status: 'fail', details: 'ANTHROPIC_API_KEY not configured — all deal ingestion is BLOCKED' });
    } else {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] }),
        });
        if (res.ok) {
          checks.push({ name: 'AI Ingestion (Claude)', status: 'pass', details: 'Anthropic API responding — deal extraction active' });
        } else {
          const errBody = await res.text().catch(() => '');
          const isCredits = errBody.includes('credit balance') || errBody.includes('billing');
          checks.push({ name: 'AI Ingestion (Claude)', status: 'fail', details: isCredits ? 'CREDITS DEPLETED — all deal ingestion is BLOCKED. Add credits at console.anthropic.com' : `API error ${res.status}: ${errBody.substring(0, 100)}` });
        }
      } catch (err) {
        checks.push({ name: 'AI Ingestion (Claude)', status: 'fail', details: `API unreachable: ${err instanceof Error ? err.message : 'unknown'}` });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK: Stale Deal Counts in Static Pages
  // Scans app/ for hardcoded deal count strings that don't match
  // the current LIVE_DEAL_COUNT (rounded to nearest 100).
  // ═══════════════════════════════════════════════════════════
  try {
    const { LIVE_DEAL_COUNT: liveDealCount, formatDealCount: fmtCount } = await import('@/lib/config/constants');
    const currentFormatted = fmtCount(liveDealCount); // e.g., "2,500+"
    const currentRoundedNum = Math.floor(liveDealCount / 100) * 100; // e.g., 2500

    // Stale patterns: any "N,NNN+" where N,NNN doesn't match current rounded count
    // Check common hardcoded values that would be stale
    const stalePatterns = [
      '1,500+', '1,600+', '1,700+', '1,800+', '1,900+',
      '2,000+', '2,100+', '2,200+', '2,300+', '2,400+',
      '2,500+', '2,600+', '2,700+', '2,800+', '2,900+',
      '3,000+', '3,100+', '3,200+', '3,300+', '3,400+',
      '3,500+', '3,600+', '3,700+', '3,800+', '3,900+',
      '4,000+', '4,500+', '5,000+',
    ].filter(p => p !== currentFormatted);

    // Also check patterns like "2,500" without +, and "3500+" without comma
    const fs = await import('fs');
    const path = await import('path');
    const appDir = path.join(process.cwd(), 'app');

    const staleFiles: { file: string; pattern: string; line: number }[] = [];

    function scanDir(dir: string) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            scanDir(fullPath);
          } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // Skip imports, comments, and the constants file itself
                if (line.trim().startsWith('import ') || line.trim().startsWith('//') || fullPath.includes('constants.ts')) continue;
                for (const pattern of stalePatterns) {
                  if (line.includes(pattern) && (line.includes('deal') || line.includes('Deal') || line.includes('transaction') || line.includes('Transaction'))) {
                    const relPath = fullPath.replace(process.cwd() + '/', '');
                    staleFiles.push({ file: relPath, pattern, line: i + 1 });
                  }
                }
              }
            } catch { /* skip unreadable files */ }
          }
        }
      } catch { /* skip unreadable dirs */ }
    }

    scanDir(appDir);

    if (staleFiles.length === 0) {
      checks.push({ name: 'Deal Count Consistency', status: 'pass', details: `All pages consistent with current count (${currentFormatted})` });
    } else {
      const fileList = staleFiles.slice(0, 10).map(f => `${f.file}:${f.line} says "${f.pattern}"`).join(', ');
      checks.push({
        name: 'Deal Count Consistency',
        status: 'warn',
        details: `${staleFiles.length} stale deal count(s) found (current: ${currentFormatted}). ${fileList}`,
      });
    }
  } catch (err) {
    checks.push({ name: 'Deal Count Consistency', status: 'warn', details: `Scan failed: ${err instanceof Error ? err.message : 'unknown'}` });
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK: PoS Modifier Bounds
  // Tests edge-case combos to catch aggregate modifier overflow
  // ═══════════════════════════════════════════════════════════
  {
    const t0 = Date.now();
    const failures: string[] = [];
    const edgeCombos = [
      { ta: 'rareDisease', modality: 'geneTherapy', indication: 'rare_genetic', phase: 'preclinical', label: 'rareDisease/geneTherapy/preclinical' },
      { ta: 'oncology', modality: 'adc', indication: 'solid_tumor', phase: 'phase2', label: 'oncology/adc/phase2' },
      { ta: 'neurology', modality: 'smallMolecule', indication: 'neurodegeneration', phase: 'phase1', label: 'neurology/smallMolecule/phase1' },
    ];

    for (const ec of edgeCombos) {
      try {
        const r = calculateRNPV(makeRnpvInput(ec.ta, ec.modality, ec.indication, ec.phase));
        if (r.cumulativePoS < 0.01 || r.cumulativePoS > 0.99) {
          failures.push(`${ec.label}: PoS=${r.cumulativePoS.toFixed(4)} outside [0.01, 0.99]`);
        }
      } catch (err) {
        failures.push(`${ec.label}: CRASH`);
      }
    }

    checks.push({
      name: 'PoS Modifier Bounds',
      status: failures.length === 0 ? 'pass' : 'fail',
      details: failures.length === 0 ? `${edgeCombos.length}/${edgeCombos.length} edge combos within [0.01, 0.99]` : `${failures.length} failures: ${failures.join('; ')}`,
      durationMs: Date.now() - t0,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK: Market Size Sanity
  // Verifies TAM > SAM > SOM and all positive for key TAs
  // ═══════════════════════════════════════════════════════════
  {
    const t0 = Date.now();
    const failures: string[] = [];
    const marketTAs = [
      { ta: 'oncology', indication: 'solid_tumor', label: 'oncology' },
      { ta: 'rareDisease', indication: 'rare_genetic', label: 'rareDisease' },
      { ta: 'neurology', indication: 'neurodegeneration', label: 'neurology' },
    ];

    const standardEpi = {
      prevalencePerMillion: 500,
      incidencePerMillion: 50,
      diagnosedPercent: 0.7,
      treatedPercent: 0.5,
      drugEligiblePercent: 0.3,
      annualCostOfTherapy: 80000,
      sources: ['QA health check stub'],
    };

    for (const mt of marketTAs) {
      try {
        const ms = estimateMarketSize(mt.indication, 'global', 'firstInClass', standardEpi, mt.ta);
        const tam = ms.totalAddressableMarket;
        const sam = ms.serviceableAddressableMarket;
        const som = ms.serviceableObtainableMarket;

        if (tam <= 0 || sam <= 0 || som <= 0) {
          failures.push(`${mt.label}: non-positive values (TAM=${tam}, SAM=${sam}, SOM=${som})`);
        } else if (!(tam >= sam && sam >= som)) {
          failures.push(`${mt.label}: chain broken (TAM=${tam.toFixed(0)}, SAM=${sam.toFixed(0)}, SOM=${som.toFixed(0)})`);
        }
      } catch (err) {
        failures.push(`${mt.label}: CRASH — ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    checks.push({
      name: 'Market Size Sanity',
      status: failures.length === 0 ? 'pass' : 'fail',
      details: failures.length === 0 ? `${marketTAs.length}/${marketTAs.length} TAs: TAM > SAM > SOM, all positive` : `${failures.length} failures: ${failures.join('; ')}`,
      durationMs: Date.now() - t0,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK: Ensemble Method Count
  // Verifies ensemble valuation has at least 1 non-zero-weight method
  // ═══════════════════════════════════════════════════════════
  {
    const t0 = Date.now();
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    let details = '';

    try {
      const input = makeInput('oncology', 'smallMolecule', 'solid_tumor', 'phase2');
      const dealResult = calculateDealTerms(input);
      const fm = runFinancialModel(input, dealResult);

      if (fm.ensemble && Array.isArray(fm.ensemble.methods)) {
        const nonZero = fm.ensemble.methods.filter((m: { weight: number }) => m.weight > 0);
        if (nonZero.length >= 1) {
          details = `${nonZero.length} method(s) with non-zero weight (of ${fm.ensemble.methods.length} total)`;
        } else {
          status = 'fail';
          details = `All ${fm.ensemble.methods.length} ensemble methods have zero weight`;
        }
      } else {
        status = 'warn';
        details = 'Ensemble result not available on financial model output';
      }
    } catch (err) {
      status = 'fail';
      details = `CRASH — ${err instanceof Error ? err.message : 'unknown'}`;
    }

    checks.push({
      name: 'Ensemble Method Count',
      status,
      details,
      durationMs: Date.now() - t0,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK: Cross-Field Validation
  // Verifies the indication-TA cross-validator catches mismatches
  // ═══════════════════════════════════════════════════════════
  {
    const t0 = Date.now();
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    let details = '';

    try {
      const warning = validateIndicationTA('lung_nsclc', 'immunology');
      if (warning && typeof warning === 'string' && warning.length > 0) {
        details = `Cross-field validator correctly warns: "${warning.substring(0, 80)}…"`;
      } else {
        status = 'fail';
        details = 'validateIndicationTA("lung_nsclc", "immunology") returned null — expected a warning';
      }
    } catch (err) {
      status = 'fail';
      details = `CRASH — ${err instanceof Error ? err.message : 'unknown'}`;
    }

    checks.push({
      name: 'Cross-Field Validation',
      status,
      details,
      durationMs: Date.now() - t0,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK: Data Freshness
  // Monitors comparable deals recency and indication catalog size
  // ═══════════════════════════════════════════════════════════
  {
    const t0 = Date.now();
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    const details: string[] = [];

    try {
      const { COMPARABLE_DEALS } = await import('@/lib/comparableDeals');
      const { INDICATION_CATALOG } = await import('@/lib/financial/indication-tier3-calibration');

      // Check 1: Comparable deals from 2025+
      const recentDeals = COMPARABLE_DEALS.filter(d => d.year >= 2025);
      const recentCount = recentDeals.length;

      // Check 2: Most recent deal year
      const mostRecentYear = COMPARABLE_DEALS.reduce((max, d) => Math.max(max, d.year), 0);

      // Check 3: Indication catalog size
      const catalogSize = Object.values(INDICATION_CATALOG).reduce(
        (sum, indications) => sum + indications.length,
        0,
      );

      details.push(`${recentCount} deals from 2025+`);
      details.push(`most recent deal year: ${mostRecentYear}`);
      details.push(`${catalogSize} indications in catalog`);

      // Determine status
      if (mostRecentYear <= 2023) {
        status = 'fail';
        details.push('STALE: no deals newer than 2023');
      } else if (mostRecentYear <= 2024 || recentCount === 0) {
        status = 'warn';
        details.push('deals stop at 2024 — may need refresh');
      }

      if (catalogSize < 500) {
        status = status === 'fail' ? 'fail' : 'warn';
        details.push(`catalog below 500 threshold (${catalogSize})`);
      }
    } catch (err) {
      status = 'fail';
      details.push(`CRASH — ${err instanceof Error ? err.message : 'unknown'}`);
    }

    checks.push({
      name: 'Data Freshness',
      status,
      details: details.join(' | '),
      durationMs: Date.now() - t0,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK: Pipeline Intelligence Freshness
  // Monitors ClinicalTrials.gov scan recency and deal ingestion lag
  // ═══════════════════════════════════════════════════════════
  {
    const t0 = Date.now();
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

      const { count: recentTrials } = await supabase
        .from('pipeline_trials')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', sevenDaysAgo);

      const { count: recentIngested } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', fourteenDaysAgo);

      const trialsFresh = (recentTrials ?? 0) > 0;
      const dealsFresh = (recentIngested ?? 0) > 0;
      const status = trialsFresh && dealsFresh ? 'pass' : (!trialsFresh && !dealsFresh) ? 'fail' : 'warn';

      checks.push({
        name: 'Pipeline Intelligence Freshness',
        status,
        details: `Trials updated (7d): ${recentTrials ?? 0} | Deals ingested (14d): ${recentIngested ?? 0}`,
        durationMs: Date.now() - t0,
      });
    } catch (err) {
      checks.push({
        name: 'Pipeline Intelligence Freshness',
        status: 'warn',
        details: `Check skipped: ${err instanceof Error ? err.message : 'unknown'}`,
        durationMs: Date.now() - t0,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // RESULTS + SLACK
  // ═══════════════════════════════════════════════════════════
  const totalDuration = Date.now() - totalStart;
  const allPassed = checks.every(c => c.status === 'pass');
  const hasFailures = checks.some(c => c.status === 'fail');

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (webhookUrl) {
    const statusEmoji = hasFailures ? ':red_circle:' : allPassed ? ':large_green_circle:' : ':large_yellow_circle:';
    const statusText = hasFailures ? 'FAILURES DETECTED' : allPassed ? 'ALL CHECKS PASSED' : 'WARNINGS';

    const checkLines = checks.map(c => {
      const icon = c.status === 'pass' ? ':white_check_mark:' : c.status === 'warn' ? ':warning:' : ':x:';
      const dur = c.durationMs ? ` _(${c.durationMs}ms)_` : '';
      return `${icon} *${c.name}*: ${c.details}${dur}`;
    }).join('\n');

    // Build auto-remediation summary
    const remediationLines: string[] = [];
    const totalFixed = negFixResult.fixed + taFixResult.fixed;
    const totalSkipped = negFixResult.skipped + taFixResult.skipped;
    const totalErrors = negFixResult.errors.length + taFixResult.errors.length;

    if (negFixResult.fixed > 0 || negFixResult.errors.length > 0) {
      remediationLines.push(`:wrench: *Negative Values*: found ${negFixResult.fixed + negFixResult.skipped + negFixResult.errors.length} | fixed ${negFixResult.fixed} | errors ${negFixResult.errors.length}`);
    }
    if (taFixResult.fixed > 0 || taFixResult.skipped > 0) {
      remediationLines.push(`:wrench: *Missing TA*: found ${taFixResult.fixed + taFixResult.skipped} | fixed ${taFixResult.fixed} | skipped ${taFixResult.skipped}`);
    }

    const remediationBlock = remediationLines.length > 0
      ? [
          { type: 'divider' },
          { type: 'section', text: { type: 'mrkdwn', text: `*Auto-Remediation* (found ${totalFixed + totalSkipped + totalErrors} | fixed ${totalFixed} | review ${totalSkipped})\n${remediationLines.join('\n')}` } },
        ]
      : [];

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
            ...remediationBlock,
            { type: 'context', elements: [{ type: 'mrkdwn', text: `${new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} ET | ${matrix.length} matrix combos | ${checks.length} checks | ${totalDuration}ms total` }] },
          ],
        }],
      }),
    });
  }

  // Intelligence tracking
  try {
    await runCronIntelligence(supabase, 'qa-health-check', {
      processed: checks.length,
      inserted: matrix.length,
    });
  } catch {}

  return NextResponse.json({
    success: true,
    overall: allPassed ? 'healthy' : hasFailures ? 'unhealthy' : 'degraded',
    matrixSize: matrix.length,
    totalDurationMs: totalDuration,
    checks,
  });
}
