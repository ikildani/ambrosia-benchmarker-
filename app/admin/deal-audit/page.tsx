/**
 * Admin Deal Audit Queue (Phase 5 of the 2026-04-14 DB-quality sweep)
 *
 * Shows 20 pending deals at a time with per-row verify/reject controls.
 * Admin wrapper layout (AdminLayoutClient) already gates by
 * ADMIN_EMAILS so this page can trust the user is authorized.
 *
 * The queue comes from `deals` where `verified=false AND
 * (verification_status IS NULL OR verification_status='pending')`. It
 * excludes rows caught by Phase 1 (asset-modality mismatch, placeholder
 * patterns, licensor-modality mismatch) — those are already rejected.
 *
 * Ordering: newest-announced-date first, since recent deals are easier
 * to verify against current press coverage.
 *
 * Actions write to POST /api/admin/deal-audit which updates verified +
 * verification_status + verification_notes. The page reloads after
 * each action to present the next row.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { DealAuditRow } from '@/components/admin/DealAuditRow';

export const dynamic = 'force-dynamic';

type PendingDeal = {
  id: string;
  announced_date: string | null;
  licensor_name: string | null;
  licensee_name: string | null;
  modality: string | null;
  asset_name: string | null;
  indication_specific: string | null;
  indication_category: string | null;
  phase_at_signing: string | null;
  deal_type: string | null;
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
  source_type: string | null;
  source_url: string | null;
  source_filing_id: string | null;
  confidence_score: number | null;
  therapeutic_area: string | null;
  raw_text_excerpt: string | null;
};

async function fetchQueue(limit: number) {
  const supabase = createServiceClient();
  const [queueRes, countsRes] = await Promise.all([
    supabase
      .from('deals')
      .select(
        'id, announced_date, licensor_name, licensee_name, modality, asset_name, indication_specific, indication_category, phase_at_signing, deal_type, upfront_usd, total_deal_value_usd, source_type, source_url, source_filing_id, confidence_score, therapeutic_area, raw_text_excerpt',
      )
      .eq('is_synthetic', false)
      .eq('verified', false)
      .or('verification_status.is.null,verification_status.eq.pending')
      .order('announced_date', { ascending: false, nullsFirst: false })
      .limit(limit),
    supabase
      .from('deals')
      .select('verified, verification_status', { count: 'exact', head: false })
      .eq('is_synthetic', false),
  ]);
  const rows = (queueRes.data ?? []) as PendingDeal[];

  // Aggregate status counts client-side (small table)
  const allRows = countsRes.data ?? [];
  const counts = {
    verified: allRows.filter((r) => r.verified === true).length,
    rejected: allRows.filter((r) => r.verification_status === 'rejected').length,
    pending: allRows.filter(
      (r) =>
        r.verified === false &&
        (r.verification_status === null || r.verification_status === 'pending'),
    ).length,
    total: allRows.length,
  };
  return { rows, counts };
}

export default async function DealAuditPage() {
  const { rows, counts } = await fetchQueue(20);
  const pctClassified =
    counts.total > 0
      ? ((counts.verified + counts.rejected) / counts.total) * 100
      : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Deal Audit Queue
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Pending deals that passed Phase 1 automated rejection (no
          asset-modality mismatch, no placeholder pattern, no known-licensor
          pipeline conflict) but have not yet been human-audited. Use the
          per-row actions to verify real deals, reject hallucinated ones,
          or open the source URL to check against the original announcement.
        </p>

        <div className="mt-6 grid grid-cols-4 gap-3 text-sm">
          <StatTile label="Verified" value={counts.verified} tone="teal" />
          <StatTile label="Rejected" value={counts.rejected} tone="amber" />
          <StatTile label="Pending" value={counts.pending} tone="slate" />
          <StatTile
            label="Classified"
            value={`${pctClassified.toFixed(0)}%`}
            tone="teal"
          />
        </div>

        <div className="mt-8 space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-8 text-center text-slate-400">
              No pending deals. Queue drained.
            </div>
          ) : (
            rows.map((row) => <DealAuditRow key={row.id} row={row} />)
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: 'teal' | 'amber' | 'slate';
}) {
  const accent =
    tone === 'teal'
      ? 'text-teal-300'
      : tone === 'amber'
        ? 'text-amber-300'
        : 'text-slate-200';
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={`mt-1 font-mono text-lg font-semibold ${accent}`}>
        {value}
      </div>
    </div>
  );
}
