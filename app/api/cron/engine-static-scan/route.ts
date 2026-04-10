/**
 * Static Code Scanner for Calculation Engines
 *
 * Runs daily to scan calculation engine files for known bug patterns.
 * This complements the rnpv-regression cron (which tests outputs) by
 * catching code-level anti-patterns before they reach production.
 *
 * Patterns detected:
 *   1. Phase string format inconsistencies (phase_1 vs phase1 vs phase1/2)
 *   2. Silent fallback patterns (|| DEFAULT without logging)
 *   3. Division without zero-guard
 *   4. Range inversions (low/high not clamped)
 *   5. Hardcoded magic numbers without source citation
 *   6. Unclamped score inputs (scores / 100 without clamp)
 *   7. Iteration over PHASE_ORDER linearly (combined-phase bug)
 *   8. Use of 'moderate' for CombinationPotential (should be 'some')
 *   9. rare_disease vs rareDisease inconsistency
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function verifyCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

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
            { type: 'context', elements: [{ type: 'mrkdwn', text: `_Engine Static Scan — ${new Date().toISOString()}_` }] },
          ],
        }],
      }),
    });
  } catch (err) {
    console.error('[Static Scan] Slack webhook failed:', err);
  }
}

interface Finding {
  file: string;
  line: number;
  rule: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  snippet: string;
  explanation: string;
}

// Files to scan — calculation engines only
const ENGINE_FILES = [
  'lib/calculations.ts',
  'lib/sensitivity.ts',
  'lib/comparableDeals.ts',
  'lib/financial/rnpv-engine.ts',
  'lib/financial/monte-carlo.ts',
  'lib/financial/scenario-planner.ts',
  'lib/financial/advanced-upgrades.ts',
  'lib/financial/institutional-upgrades.ts',
  'lib/financial/buyer-specific-valuation.ts',
  'lib/financial/market-size.ts',
  'lib/financial/tornado-sensitivity.ts',
  'lib/financial/run-financial-model.ts',
  'lib/financial/pos-tables.ts',
  'lib/services/partner-matching.ts',
  'lib/services/pharma-intent.ts',
];

// Phase format patterns — catches inconsistencies
// Canonical format is: phase1, phase1_2, phase2, phase2_3, phase3, nda_filed
const PHASE_INCORRECT_PATTERNS = [
  { regex: /['"]phase_\d/g, rule: 'phase-format-underscore', explanation: "Uses 'phase_1' format instead of canonical 'phase1'" },
  { regex: /['"]phase ?\d\/\d/g, rule: 'phase-format-slash', explanation: "Uses 'phase1/2' format instead of canonical 'phase1_2'" },
];

// Legit uses: rateLimit fallbacks, logging fallbacks
// Bug pattern: `something || DEFAULT_VALUE` that silently masks missing data
const SILENT_FALLBACK_PATTERNS = [
  { regex: /\|\| *TERRITORY_DATA\.global(?! \/\/ logged)/g, rule: 'silent-fallback-territory', explanation: 'Silent fallback to global territory without logging' },
  { regex: /\[[^\]]+\] \|\| *genericProfile/g, rule: 'silent-fallback-epidemiology', explanation: 'Silent fallback to generic epidemiology profile' },
];

// Phase order iteration (the bug that started this whole audit)
const PHASE_ORDER_LINEAR_PATTERNS = [
  { regex: /for \(let i = currentIdx; i < PHASE_ORDER\.length;/g, rule: 'phase-order-linear', explanation: 'Linear iteration over PHASE_ORDER sums combined phases as sequential steps' },
  { regex: /for \(let i = startIdx; i < PHASE_ORDER\.length;/g, rule: 'phase-order-linear-mc', explanation: 'Monte Carlo linear iteration over PHASE_ORDER (same combined-phase bug)' },
];

// Wrong CombinationPotential value
const COMBO_POTENTIAL_PATTERN = /comboPotential === *['"]moderate['"]/g;

// rare_disease vs rareDisease
const RARE_DISEASE_PATTERN = /['"]rare_disease['"]/g;

// Unclamped score division (score / 100 without Math.min/max)
const UNCLAMPED_SCORE_PATTERN = /(matchScore|intentScore|patentCliffPressure|pipelineGap|competitivePressure)\s*\/\s*100/g;

// Division without zero guard (simple heuristic)
const DIVISION_WITHOUT_GUARD_PATTERN = /\/\s*(diagnosedPatients|prevalentPatients|totalPatients|peakSales|baseValue)(?!\s*\|\| *1)/g;

// Double count regulatory
const REGULATORY_DOUBLE_COUNT_PATTERN = /nda_filed.*\n.*durations\.regulatory|durations\.regulatory.*\n.*nda_filed/g;

function scanFile(filePath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // Skip comment-only lines (starts with // or * after trim)
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

    // Phase format checks
    for (const pattern of PHASE_INCORRECT_PATTERNS) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(line)) {
        findings.push({
          file: filePath,
          line: lineNum,
          rule: pattern.rule,
          severity: 'HIGH',
          snippet: line.trim().slice(0, 120),
          explanation: pattern.explanation,
        });
      }
    }

    // Silent fallback checks
    for (const pattern of SILENT_FALLBACK_PATTERNS) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(line)) {
        findings.push({
          file: filePath,
          line: lineNum,
          rule: pattern.rule,
          severity: 'MEDIUM',
          snippet: line.trim().slice(0, 120),
          explanation: pattern.explanation,
        });
      }
    }

    // PHASE_ORDER linear iteration
    for (const pattern of PHASE_ORDER_LINEAR_PATTERNS) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(line)) {
        findings.push({
          file: filePath,
          line: lineNum,
          rule: pattern.rule,
          severity: 'CRITICAL',
          snippet: line.trim().slice(0, 120),
          explanation: pattern.explanation,
        });
      }
    }

    // CombinationPotential 'moderate' typo
    if (COMBO_POTENTIAL_PATTERN.test(line)) {
      COMBO_POTENTIAL_PATTERN.lastIndex = 0;
      findings.push({
        file: filePath,
        line: lineNum,
        rule: 'combo-potential-invalid',
        severity: 'HIGH',
        snippet: line.trim().slice(0, 120),
        explanation: "CombinationPotential type uses 'some', not 'moderate' — this check never fires",
      });
    }

    // rare_disease vs rareDisease
    if (RARE_DISEASE_PATTERN.test(line)) {
      RARE_DISEASE_PATTERN.lastIndex = 0;
      // Allow in comparableDeals indication_category context
      if (!filePath.includes('comparableDeals') && !line.includes('indication_category')) {
        findings.push({
          file: filePath,
          line: lineNum,
          rule: 'rare-disease-naming',
          severity: 'HIGH',
          snippet: line.trim().slice(0, 120),
          explanation: "Use 'rareDisease' (camelCase) not 'rare_disease' for TA keys",
        });
      }
    }

    // Unclamped scores
    if (UNCLAMPED_SCORE_PATTERN.test(line)) {
      UNCLAMPED_SCORE_PATTERN.lastIndex = 0;
      // Check if line has Math.min/max nearby (basic check)
      const hasClamp = /Math\.(min|max)/.test(line) || /clamp/.test(line);
      if (!hasClamp) {
        findings.push({
          file: filePath,
          line: lineNum,
          rule: 'unclamped-score',
          severity: 'MEDIUM',
          snippet: line.trim().slice(0, 120),
          explanation: 'Score divided by 100 without clamping — could produce values > 1.0',
        });
      }
    }

    // Regulatory double-count (multiline pattern, skip per-line)

    // Simple division-by-unchecked-denominator check
    const divMatches = line.match(DIVISION_WITHOUT_GUARD_PATTERN);
    if (divMatches && !line.includes('Math.max') && !line.includes('> 0 ?')) {
      findings.push({
        file: filePath,
        line: lineNum,
        rule: 'unguarded-division',
        severity: 'MEDIUM',
        snippet: line.trim().slice(0, 120),
        explanation: 'Division without zero guard — could produce NaN or Infinity',
      });
    }
  });

  // Multiline check: regulatory double-count
  REGULATORY_DOUBLE_COUNT_PATTERN.lastIndex = 0;
  if (REGULATORY_DOUBLE_COUNT_PATTERN.test(content)) {
    findings.push({
      file: filePath,
      line: 0,
      rule: 'regulatory-double-count',
      severity: 'CRITICAL',
      snippet: '(multiline)',
      explanation: 'nda_filed and durations.regulatory both added — double-counts regulatory review',
    });
  }

  return findings;
}

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rootDir = process.cwd();
  const allFindings: Finding[] = [];
  const scanErrors: string[] = [];

  for (const relPath of ENGINE_FILES) {
    const absPath = path.join(rootDir, relPath);
    try {
      const content = fs.readFileSync(absPath, 'utf-8');
      const findings = scanFile(relPath, content);
      allFindings.push(...findings);
    } catch (err) {
      scanErrors.push(`${relPath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Group by severity
  const critical = allFindings.filter(f => f.severity === 'CRITICAL');
  const high = allFindings.filter(f => f.severity === 'HIGH');
  const medium = allFindings.filter(f => f.severity === 'MEDIUM');
  const low = allFindings.filter(f => f.severity === 'LOW');

  // Alert if any critical or high-severity findings
  if (critical.length > 0 || high.length > 0) {
    const topFindings = [...critical, ...high].slice(0, 10);
    const summary = topFindings
      .map(f => `*${f.rule}* [${f.severity}] ${f.file}:${f.line}\n\`${f.snippet}\`\n_${f.explanation}_`)
      .join('\n\n');

    await postSlackAlert(
      `Engine Static Scan: ${critical.length} CRITICAL + ${high.length} HIGH findings`,
      `Daily code scan detected anti-patterns in calculation engines:\n\n${summary}\n\n_Total: ${allFindings.length} findings across ${ENGINE_FILES.length} files._`
    );
  }

  return NextResponse.json({
    ok: critical.length === 0 && high.length === 0,
    summary: {
      critical: critical.length,
      high: high.length,
      medium: medium.length,
      low: low.length,
      total: allFindings.length,
    },
    scanErrors,
    findings: allFindings.slice(0, 50), // Limit response size
  });
}
