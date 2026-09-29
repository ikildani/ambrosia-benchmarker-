/**
 * Daily flag-and-fix report for the owner: what was flagged, how each deal was
 * fixed (field before -> after, with the primary source), what was removed as
 * a duplicate or rejected, and what is still unresolved.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '../email/client';
import { FLAG_FIXER_SOURCE } from './flag-fixer';

export interface ReportRow {
  deal_id: string | null;
  issue_type: string;
  action_taken: string | null;
  new_value: string | null;
  created_at: string;
  deal?: { licensor_name: string | null; licensee_name: string | null; asset_name: string | null } | null;
}

export interface FlagFixReport {
  since: string;
  newlyFlagged: number;
  stillFlagged: number;
  fixed: ReportRow[];
  duplicates: ReportRow[];
  rejected: ReportRow[];
  unresolved: ReportRow[];
}

const esc = (s: string | null | undefined) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function dealLabel(r: ReportRow): string {
  const d = r.deal;
  if (!d) return esc(r.deal_id);
  return `${esc(d.licensor_name)} &rarr; ${esc(d.licensee_name)}${d.asset_name ? ` <span style="color:#64748b">(${esc(d.asset_name)})</span>` : ''}`;
}

function table(title: string, rows: ReportRow[], detail: (r: ReportRow) => string): string {
  if (rows.length === 0) return '';
  const body = rows.map(r => `<tr><td style="padding:6px 8px;border-top:1px solid #e2e8f0;vertical-align:top">${dealLabel(r)}</td><td style="padding:6px 8px;border-top:1px solid #e2e8f0;vertical-align:top;font-size:13px">${detail(r)}</td></tr>`).join('');
  return `<h3 style="margin:24px 0 8px;font-size:16px">${esc(title)} (${rows.length})</h3><table style="border-collapse:collapse;width:100%;font-size:14px">${body}</table>`;
}

const link = (u: string | null) => (u && /^https?:\/\//.test(u) ? `<a href="${esc(u)}">source</a>` : '');

export function buildFlagFixReportHtml(r: FlagFixReport): string {
  const total = r.fixed.length + r.duplicates.length + r.rejected.length + r.unresolved.length;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;max-width:760px;margin:0 auto;padding:20px">
<h2 style="margin:0 0 4px">Deal data: flagged and fixed</h2>
<p style="margin:0 0 16px;color:#475569">Since ${esc(r.since.slice(0, 16).replace('T', ' '))} UTC. ${r.newlyFlagged} deals newly flagged; ${total} handled: ${r.fixed.length} fixed from primary sources, ${r.duplicates.length} removed as duplicates, ${r.rejected.length} rejected, ${r.unresolved.length} held out of counts and retried automatically (rejected after 3 attempts without a primary source). ${r.stillFlagged} flagged deals are in the fixer's queue; none need action from you.</p>
${table('Fixed', r.fixed, x => `${esc(x.action_taken)} ${link(x.new_value)}`)}
${table('Removed as duplicates', r.duplicates, x => esc(x.action_taken))}
${table('Rejected', r.rejected, x => esc(x.action_taken))}
${table('Held out of counts, retrying automatically', r.unresolved, x => esc(x.action_taken))}
${total === 0 ? '<p>No flagged deals were handled in this window.</p>' : ''}
<p style="margin-top:24px;color:#64748b;font-size:12px">Every change is in remediation_log and in each deal's verification_notes. Fixed deals were corrected only from the cited primary document.</p>
</body></html>`;
}

/** Collect the report rows for the window. */
export async function collectFlagFixReport(supabase: SupabaseClient, since: string): Promise<FlagFixReport> {
  const { data: logs } = await supabase.from('remediation_log')
    .select('deal_id, issue_type, action_taken, new_value, created_at, cron_source')
    .gte('created_at', since)
    .or(`cron_source.eq.${FLAG_FIXER_SOURCE},and(cron_source.eq.deal_verification,issue_type.eq.auto_reject)`)
    .order('created_at', { ascending: true })
    .limit(1000);
  const rows = (logs ?? []) as Array<ReportRow & { cron_source: string }>;
  const ids = [...new Set(rows.map(r => r.deal_id).filter((x): x is string => !!x))];
  const names = new Map<string, ReportRow['deal']>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase.from('deals').select('id, licensor_name, licensee_name, asset_name').in('id', ids.slice(i, i + 200));
    for (const d of data ?? []) names.set(d.id, d);
  }
  // The latest outcome per deal wins (a deal unresolved at 09:00 and fixed at 14:00 is fixed).
  const latest = new Map<string, ReportRow & { cron_source: string }>();
  for (const r of rows) latest.set(r.deal_id ?? `${r.created_at}-${r.issue_type}`, { ...r, deal: r.deal_id ? names.get(r.deal_id) ?? null : null });
  const all = [...latest.values()];

  const { count: newlyFlagged } = await supabase.from('deals').select('id', { count: 'exact', head: true })
    .eq('verification_status', 'flagged').eq('is_synthetic', false).gte('verify_attempted_at', since);
  const { count: stillFlagged } = await supabase.from('deals').select('id', { count: 'exact', head: true })
    .eq('verification_status', 'flagged').eq('is_synthetic', false);

  return {
    since,
    newlyFlagged: newlyFlagged ?? 0,
    stillFlagged: stillFlagged ?? 0,
    fixed: all.filter(r => r.issue_type === 'flagged_fixed'),
    duplicates: all.filter(r => r.issue_type === 'flagged_duplicate'),
    rejected: all.filter(r => r.issue_type === 'auto_reject' || r.issue_type === 'flagged_rejected_no_source'),
    unresolved: all.filter(r => r.issue_type === 'flagged_unresolved'),
  };
}

/**
 * Build and email the report for the last `hours`. Nothing handled and nothing
 * newly flagged: no email. Runs daily from the hourly api-credit-check cron
 * (vercel.json is at Vercel's 100-cron cap) and on demand via /api/cron/deal-fix-report.
 */
export async function sendFlagFixReport(supabase: SupabaseClient, hours = 24): Promise<{ sent: boolean; error?: string; report: FlagFixReport; html: string }> {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const report = await collectFlagFixReport(supabase, since);
  const html = buildFlagFixReportHtml(report);
  const handled = report.fixed.length + report.duplicates.length + report.rejected.length + report.unresolved.length;
  if (handled === 0 && report.newlyFlagged === 0) return { sent: false, error: 'nothing to report', report, html };
  const to = process.env.ADMIN_NOTIFICATION_EMAIL || 'ikildani@ambrosiaventures.co';
  const subject = `Deal data: ${report.fixed.length} fixed, ${report.duplicates.length} duplicates removed, ${report.rejected.length} rejected, ${report.unresolved.length} retrying`;
  const res = await sendEmail({ to, subject, html });
  return { sent: res.success, error: res.success ? undefined : res.error, report, html };
}
