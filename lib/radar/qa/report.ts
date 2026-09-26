/**
 * Search & Evaluation QA — report assembly and markdown rendering.
 *
 * buildQaReport(supabase, runId?) reads the latest (or the given) invariants
 * run, the latest golden_agreement run and the latest golden_human run from
 * radar_qa_runs / radar_qa_findings and folds them into one JSON object the
 * admin API, the cron Slack alert and scripts/radar-qa-report.ts all share.
 * renderQaReportMarkdown turns that object into the launch-notes section.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { QaCheckResult, QaSeverity, QaStats } from './invariants';
import { AGREEMENT_GATE, type FieldAgreementStats } from './golden-set';

export interface QaReportFinding {
  check_name: string;
  severity: QaSeverity;
  expected: string | null;
  observed: string | null;
  count: number | null;
  failing_ids: string[];
  group: string | null;
}

export interface QaCoverageRow {
  metric: string;
  numerator: number;
  denominator: number;
  share_pct: number;
  threshold_pct: number | null;
  passed: boolean | null;
}

export interface QaAgreementRow {
  field: string;
  compared: number;
  agreement_pct: number;
  kappa: number | null;
  gate_pct: number | null;
  passed: boolean | null;
}

export interface QaReport {
  generated_at: string;
  passed: boolean;
  launch_gate: {
    no_blockers: boolean | null;
    majors_count: number | null;
    agreement_ok: boolean | null;
    human_ok: boolean | null;
    notes: string[];
  };
  invariants: {
    run_id: string;
    run_at: string;
    universe_size: number | null;
    blockers: QaReportFinding[];
    majors: QaReportFinding[];
    minors: QaReportFinding[];
    checks_total: number;
    checks_passed: number;
  } | null;
  coverage: QaCoverageRow[];
  agreement: {
    run_id: string;
    run_at: string;
    model: string | null;
    golden_size: number | null;
    rows: QaAgreementRow[];
    partnership_confusion: Record<string, Record<string, number>> | null;
    estimated_cost_usd: number | null;
    disagreements_sample: Record<string, unknown>[];
  } | null;
  human: {
    run_id: string;
    run_at: string;
    reviewer: string | null;
    rows: QaAgreementRow[];
  } | null;
  freshness: { active_trial_assets: number; fresh_400d: number; share_pct: number } | null;
  cron_health: {
    stages: { source: string; stage: string; last_run_at: string; status: string }[];
    missing: { source: string; stage: string; label: string; critical: boolean }[];
    failures_7d: { source: string; stage: string; failed: number }[];
  } | null;
}

interface RunRow {
  id: string;
  run_at: string;
  kind: string;
  universe_size: number | null;
  summary: Record<string, unknown>;
  passed: boolean | null;
  blocking_failures: number;
  notes: string | null;
}

interface FindingRow {
  check_name: string;
  severity: QaSeverity;
  expected: string | null;
  observed: string | null;
  details: Record<string, unknown> | null;
  asset_id: string | null;
}

function pctOf(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 1000) / 10 : 0;
}

/** Coverage table from the stats snapshot stored in the invariants run summary. */
export function coverageRowsFromStats(stats: QaStats | null | undefined, checks: Pick<QaCheckResult, 'check_name' | 'passed'>[] = []): QaCoverageRow[] {
  if (!stats) return [];
  const u = stats.universe;
  const th = stats.thesis;
  const passedBy = new Map(checks.map(c => [c.check_name, c.passed]));
  const row = (metric: string, num: number, den: number, threshold: number | null, check: string | null): QaCoverageRow => ({
    metric, numerator: num, denominator: den, share_pct: pctOf(num, den), threshold_pct: threshold,
    passed: check ? (passedBy.get(check) ?? null) : null,
  });
  return [
    row('Industry assets classified or skipped', u.classification.classified + u.classification.skipped, u.industry_assets, 95, 'classification_coverage'),
    row('Classified industry Phase 2+ with target', u.target_p2plus.with_target, u.target_p2plus.classified, 60, 'target_coverage_phase2plus'),
    row('Industry assets drug-resolved', u.drug_resolution.resolved, u.industry_assets, 55, 'drug_resolution_coverage'),
    row('Assets partnership-checked', u.partnership.checked, u.total_assets, 99, 'partnership_checked_coverage'),
    row('Industry assets with a known phase', u.industry_assets - u.industry_phase_missing.count, u.industry_assets, 90, 'industry_phase_known'),
    row('Eligible assets with a deal thesis', th.with_thesis, th.eligible, 99, 'thesis_coverage'),
    row('Active-trial assets updated within 400 d', u.freshness.fresh_400d, u.freshness.active_trial_assets, 80, 'active_trial_freshness'),
    row('Scored industry assets with a recent snapshot', stats.score.snapshot_checked, stats.score.scored_industry, null, null),
  ];
}

export function agreementRowsFromFields(fields: Record<string, FieldAgreementStats> | undefined, partnership?: FieldAgreementStats): QaAgreementRow[] {
  const rows: QaAgreementRow[] = [];
  const gate = AGREEMENT_GATE as Record<string, number>;
  for (const [field, s] of Object.entries(fields ?? {})) {
    const g = gate[field] ?? null;
    rows.push({ field, compared: s.compared, agreement_pct: s.agreement_pct, kappa: s.kappa, gate_pct: g, passed: g == null ? null : s.compared > 0 && s.agreement_pct >= g });
  }
  if (partnership) {
    const g = gate.partnership_status;
    rows.push({ field: 'partnership_status', compared: partnership.compared, agreement_pct: partnership.agreement_pct, kappa: partnership.kappa, gate_pct: g, passed: partnership.compared > 0 && partnership.agreement_pct >= g });
  }
  return rows;
}

function toFinding(f: FindingRow): QaReportFinding {
  const d = f.details ?? {};
  return {
    check_name: f.check_name,
    severity: f.severity,
    expected: f.expected,
    observed: f.observed,
    count: typeof d.count === 'number' ? d.count : null,
    failing_ids: Array.isArray(d.failing_ids) ? (d.failing_ids as string[]).slice(0, 20) : [],
    group: typeof d.group === 'string' ? d.group : null,
  };
}

async function latestRun(supabase: SupabaseClient, kind: string): Promise<RunRow | null> {
  const { data, error } = await supabase
    .from('radar_qa_runs')
    .select('id, run_at, kind, universe_size, summary, passed, blocking_failures, notes')
    .eq('kind', kind)
    .order('run_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`radar_qa_runs read (${kind}): ${error.message}`);
  return (data as RunRow | null) ?? null;
}

export async function buildQaReport(supabase: SupabaseClient, runId?: string, opts: { now?: () => number } = {}): Promise<QaReport> {
  const now = opts.now ?? Date.now;
  let invRun: RunRow | null;
  if (runId) {
    const { data, error } = await supabase
      .from('radar_qa_runs')
      .select('id, run_at, kind, universe_size, summary, passed, blocking_failures, notes')
      .eq('id', runId)
      .maybeSingle();
    if (error) throw new Error(`radar_qa_runs read: ${error.message}`);
    invRun = (data as RunRow | null) ?? null;
    if (invRun && invRun.kind !== 'invariants') invRun = null;
  } else {
    invRun = await latestRun(supabase, 'invariants');
  }
  const [agrRun, humanRun] = await Promise.all([latestRun(supabase, 'golden_agreement'), latestRun(supabase, 'golden_human')]);

  let findings: FindingRow[] = [];
  if (invRun) {
    const { data, error } = await supabase
      .from('radar_qa_findings')
      .select('check_name, severity, expected, observed, details, asset_id')
      .eq('run_id', invRun.id)
      .is('asset_id', null)
      .order('severity')
      .order('check_name')
      .range(0, 499);
    if (error) throw new Error(`radar_qa_findings read: ${error.message}`);
    findings = (data ?? []) as FindingRow[];
  }

  const stats = (invRun?.summary?.stats as QaStats | undefined) ?? null;
  const checks = (invRun?.summary?.checks as QaCheckResult[] | undefined) ?? [];
  const blockers = findings.filter(f => f.severity === 'blocker').map(toFinding);
  const majors = findings.filter(f => f.severity === 'major').map(toFinding);
  const minors = findings.filter(f => f.severity === 'minor').map(toFinding);

  const agrSummary = (agrRun?.summary ?? null) as Record<string, unknown> | null;
  const agreementRows = agrSummary
    ? agreementRowsFromFields(agrSummary.fields as Record<string, FieldAgreementStats>, agrSummary.partnership as FieldAgreementStats | undefined)
    : [];
  const humanSummary = (humanRun?.summary ?? null) as Record<string, unknown> | null;
  const humanRows = humanSummary ? agreementRowsFromFields(humanSummary.fields as Record<string, FieldAgreementStats>) : [];

  const stageCheck = checks.find(c => c.check_name === 'radar_stages_ran_48h');
  const missing = (Array.isArray(stageCheck?.details?.missing) ? stageCheck!.details.missing : []) as { source: string; stage: string; label: string; critical: boolean }[];

  const noBlockers = invRun ? blockers.length === 0 : null;
  const agreementOk = agrRun ? agrRun.passed : null;
  const humanOk = humanRun ? humanRun.passed : null;
  const notes: string[] = [];
  if (!invRun) notes.push('No invariants run yet: call /api/cron/radar-qa?mode=invariants.');
  if (!agrRun) notes.push('No golden agreement run yet: select the golden set, then ?mode=golden_agreement.');
  if (!humanRun) notes.push('No human review imported yet (optional before launch, required after).');
  if (majors.length > 0) notes.push(`${majors.length} major findings must be listed in the launch notes.`);

  return {
    generated_at: new Date(now()).toISOString(),
    passed: noBlockers === true && agreementOk !== false,
    launch_gate: { no_blockers: noBlockers, majors_count: invRun ? majors.length : null, agreement_ok: agreementOk, human_ok: humanOk, notes },
    invariants: invRun
      ? {
          run_id: invRun.id, run_at: invRun.run_at, universe_size: invRun.universe_size,
          blockers, majors, minors,
          checks_total: checks.length, checks_passed: checks.filter(c => c.passed).length,
        }
      : null,
    coverage: coverageRowsFromStats(stats, checks),
    agreement: agrRun
      ? {
          run_id: agrRun.id, run_at: agrRun.run_at,
          model: (agrSummary?.model as string | undefined) ?? null,
          golden_size: agrRun.universe_size,
          rows: agreementRows,
          partnership_confusion: ((agrSummary?.partnership as { confusion?: Record<string, Record<string, number>> } | undefined)?.confusion) ?? null,
          estimated_cost_usd: typeof agrSummary?.estimated_cost_usd === 'number' ? (agrSummary.estimated_cost_usd as number) : null,
          disagreements_sample: Array.isArray(agrSummary?.disagreements) ? (agrSummary!.disagreements as Record<string, unknown>[]).slice(0, 25) : [],
        }
      : null,
    human: humanRun
      ? { run_id: humanRun.id, run_at: humanRun.run_at, reviewer: (humanSummary?.reviewer as string | undefined) ?? null, rows: humanRows }
      : null,
    freshness: stats
      ? { active_trial_assets: stats.universe.freshness.active_trial_assets, fresh_400d: stats.universe.freshness.fresh_400d, share_pct: pctOf(stats.universe.freshness.fresh_400d, stats.universe.freshness.active_trial_assets) }
      : null,
    cron_health: stats
      ? {
          stages: stats.pipeline.stages.map(s => ({ source: s.source, stage: s.stage, last_run_at: s.last_run_at, status: s.status })),
          missing,
          failures_7d: stats.pipeline.cron_failures_7d.map(f => ({ source: f.source, stage: f.stage, failed: f.failed })),
        }
      : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// MARKDOWN
// ═══════════════════════════════════════════════════════════════════════

function mdTable(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => String(v ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(r => `| ${r.map(esc).join(' | ')} |`),
  ].join('\n');
}

function yesNo(v: boolean | null | undefined): string {
  return v == null ? 'n/a' : v ? 'yes' : 'NO';
}

function findingLines(list: QaReportFinding[]): string {
  if (list.length === 0) return '_none_';
  return list.map(f => `- **${f.check_name}** — expected ${f.expected ?? '—'}; observed ${f.observed ?? '—'}${f.failing_ids.length ? ` (sample: ${f.failing_ids.slice(0, 5).join(', ')})` : ''}`).join('\n');
}

export function renderQaReportMarkdown(report: QaReport): string {
  const parts: string[] = [];
  parts.push(`# Search & Evaluation QA report`);
  parts.push(`Generated ${report.generated_at} — launch gate: **${report.passed ? 'PASS' : 'FAIL'}**`);
  parts.push('');
  parts.push(mdTable(
    ['Gate', 'Status'],
    [
      ['No blockers', yesNo(report.launch_gate.no_blockers)],
      ['Majors (listed below)', report.launch_gate.majors_count ?? 'n/a'],
      ['Model agreement (TA/modality/partnership ≥ 85%, target ≥ 75%)', yesNo(report.launch_gate.agreement_ok)],
      ['Human review agreement', yesNo(report.launch_gate.human_ok)],
    ],
  ));
  if (report.launch_gate.notes.length) parts.push('', ...report.launch_gate.notes.map(n => `> ${n}`));

  if (report.invariants) {
    const inv = report.invariants;
    parts.push('', `## Invariants — run ${inv.run_id} (${inv.run_at}), universe ${inv.universe_size ?? '?'} assets, ${inv.checks_passed}/${inv.checks_total} checks passed`);
    parts.push('', '### Blockers', findingLines(inv.blockers));
    parts.push('', '### Majors', findingLines(inv.majors));
    parts.push('', '### Minors', findingLines(inv.minors));
  }

  if (report.coverage.length) {
    parts.push('', '## Coverage');
    parts.push(mdTable(
      ['Metric', 'n / N', 'Share', 'Threshold', 'OK'],
      report.coverage.map(c => [c.metric, `${c.numerator} / ${c.denominator}`, `${c.share_pct.toFixed(1)}%`, c.threshold_pct == null ? '—' : `≥ ${c.threshold_pct}%`, yesNo(c.passed)]),
    ));
  }

  if (report.agreement) {
    const a = report.agreement;
    parts.push('', `## Golden set — model agreement (${a.model ?? 'model'}, ${a.golden_size ?? '?'} assets, run ${a.run_at}, est. $${(a.estimated_cost_usd ?? 0).toFixed(2)})`);
    parts.push(mdTable(
      ['Field', 'Compared', 'Agreement', 'Kappa', 'Gate', 'OK'],
      a.rows.map(r => [r.field, r.compared, `${r.agreement_pct.toFixed(1)}%`, r.kappa == null ? '—' : r.kappa.toFixed(3), r.gate_pct == null ? '—' : `≥ ${r.gate_pct}%`, yesNo(r.passed)]),
    ));
    if (a.partnership_confusion) {
      const cats = ['unpartnered', 'partially_partnered', 'partnered', '∅'];
      const present = cats.filter(c => a.partnership_confusion![c] || cats.some(k => a.partnership_confusion![k]?.[c]));
      parts.push('', '### Partnership confusion (rows = stored, columns = model)');
      parts.push(mdTable(['stored \\ model', ...present], present.map(r => [r, ...present.map(c => a.partnership_confusion![r]?.[c] ?? 0)])));
    }
    if (a.disagreements_sample.length) {
      parts.push('', '### Disagreement sample');
      parts.push(mdTable(
        ['Asset', 'Field', 'Stored', 'Model', 'Conf.'],
        a.disagreements_sample.slice(0, 15).map(d => [`${d.company_name ?? ''} / ${d.asset_name ?? d.asset_id}`, d.field as string, d.stored as string, d.model as string, d.model_confidence as number]),
      ));
    }
  }

  if (report.human) {
    parts.push('', `## Golden set — human review (${report.human.reviewer ?? 'reviewer'}, run ${report.human.run_at})`);
    parts.push(mdTable(
      ['Field', 'Reviewed', 'Agreement', 'Kappa', 'Gate', 'OK'],
      report.human.rows.map(r => [r.field, r.compared, `${r.agreement_pct.toFixed(1)}%`, r.kappa == null ? '—' : r.kappa.toFixed(3), r.gate_pct == null ? '—' : `≥ ${r.gate_pct}%`, yesNo(r.passed)]),
    ));
  }

  if (report.freshness) {
    parts.push('', `## Freshness`, `${report.freshness.fresh_400d} of ${report.freshness.active_trial_assets} active-trial assets (${report.freshness.share_pct.toFixed(1)}%) updated within 400 days.`);
  }

  if (report.cron_health) {
    const ch = report.cron_health;
    parts.push('', '## Cron health (48 h)');
    if (ch.missing.length) parts.push(`Missing: ${ch.missing.map(m => `${m.source}${m.stage ? `/${m.stage}` : ''}${m.critical ? ' (critical)' : ''}`).join(', ')}`);
    else parts.push('All expected Radar stages ran.');
    if (ch.stages.length) {
      parts.push(mdTable(['Source', 'Stage', 'Last run', 'Status'], ch.stages.map(s => [s.source, s.stage || '—', s.last_run_at, s.status])));
    }
    if (ch.failures_7d.length) parts.push('', `Failures (7 d): ${ch.failures_7d.map(f => `${f.source}${f.stage ? `/${f.stage}` : ''}×${f.failed}`).join(', ')}`);
  }

  return parts.join('\n');
}
