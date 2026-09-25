/**
 * Admin Outcome Ledger — /admin/outcomes
 *
 * Three views, selected with ?tab=:
 *   queue     pending resolver matches scored 0.50–0.80 (Accept / Reject)
 *   ledger    accepted outcomes, newest first, with client-reported terms
 *   accuracy  accuracy_rollups by source × window (counts only under n = 10)
 *
 * Auth: the admin wrapper layout (AdminLayoutClient) gates by ADMIN_EMAILS,
 * as /admin/deal-audit does, so the page reads through the service client
 * directly. Accept / Reject post to /api/admin/outcomes (verifyAdminAuth:
 * admin email session or ADMIN_API_KEY bearer) from the client row.
 *
 * Read-only on this page; every write goes through the route.
 */

import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { getAccuracySummary } from '@/lib/outcomes/statements';
import {
  LEDGER_SELECT,
  QUEUE_SELECT,
  formatLedgerRow,
  formatQueueRow,
  type LedgerRow,
  type QueueRow,
} from '@/lib/outcomes/admin-view';
import { OutcomeReviewRow } from '@/components/admin/outcomes/OutcomeReviewRow';
import { ResolvedLedgerTable } from '@/components/admin/outcomes/ResolvedLedgerTable';
import { AccuracyRollupTable } from '@/components/admin/outcomes/AccuracyRollupTable';

export const metadata: Metadata = {
  title: 'Outcome Ledger | Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type Tab = 'queue' | 'ledger' | 'accuracy';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'queue', label: 'Review queue' },
  { id: 'ledger', label: 'Resolved ledger' },
  { id: 'accuracy', label: 'Accuracy' },
];

interface Counts {
  pending: number;
  accepted: number;
  open: number;
  expired: number;
}

async function loadCounts(): Promise<Counts> {
  const supabase = createServiceClient();
  const count = async (table: 'outcomes' | 'predictions', status: string) => {
    const { count } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('status', status);
    return count ?? 0;
  };
  const [pending, accepted, open, expired] = await Promise.all([
    count('outcomes', 'pending'),
    count('outcomes', 'accepted'),
    count('predictions', 'open'),
    count('predictions', 'expired'),
  ]);
  return { pending, accepted, open, expired };
}

async function loadQueue(limit: number) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('outcomes')
    .select(QUEUE_SELECT)
    .eq('status', 'pending')
    .order('match_confidence', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`outcomes queue: ${error.message}`);
  return ((data ?? []) as unknown as QueueRow[]).map(formatQueueRow);
}

async function loadLedger(limit: number) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('outcomes')
    .select(LEDGER_SELECT)
    .eq('status', 'accepted')
    .order('resolved_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`outcomes ledger: ${error.message}`);
  return ((data ?? []) as unknown as LedgerRow[]).map(formatLedgerRow);
}

export default async function OutcomesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; limit?: string }>;
}) {
  const params = await searchParams;
  const tab: Tab = params.tab === 'ledger' || params.tab === 'accuracy' ? params.tab : 'queue';
  const limit = Math.min(Math.max(parseInt(params.limit || '50', 10) || 50, 1), 200);

  const [counts, queue, ledger, summary] = await Promise.all([
    loadCounts(),
    tab === 'queue' ? loadQueue(limit) : Promise.resolve(null),
    tab === 'ledger' ? loadLedger(Math.max(limit, 100)) : Promise.resolve(null),
    tab === 'accuracy' ? getAccuracySummary(createServiceClient()) : Promise.resolve(null),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Outcome Ledger</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Predictions from the calculator, briefs and Radar scored against announced deals and client-reported terms.
          The resolver accepts matches at 0.80 and above on its own; matches between 0.50 and 0.80 wait here for a decision.
          Accepting a match resolves the prediction and rejects its other pending candidates.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <StatTile label="Pending review" value={counts.pending} tone={counts.pending > 0 ? 'amber' : 'slate'} />
          <StatTile label="Accepted" value={counts.accepted} tone="teal" />
          <StatTile label="Open predictions" value={counts.open} tone="slate" />
          <StatTile label="Expired" value={counts.expired} tone="slate" />
        </div>

        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          {TABS.map((t) => (
            <a
              key={t.id}
              href={t.id === 'queue' ? '/admin/outcomes' : `/admin/outcomes?tab=${t.id}`}
              className={`rounded-md border px-3 py-1.5 transition-colors ${
                tab === t.id
                  ? 'border-teal-500/40 bg-teal-500/20 text-teal-300'
                  : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
              {t.id === 'queue' && counts.pending > 0 && <span className="ml-1.5 font-mono text-slate-300">{counts.pending}</span>}
            </a>
          ))}
        </div>

        <div className="mt-6">
          {tab === 'queue' && queue && (
            queue.length === 0 ? (
              <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-8 text-center text-slate-400">
                No matches waiting for review.
              </div>
            ) : (
              <div className="space-y-3">
                {queue.map((view) => <OutcomeReviewRow key={view.id} view={view} />)}
                {counts.pending > queue.length && (
                  <div className="text-center text-xs text-slate-500">
                    Showing {queue.length} of {counts.pending} pending.{' '}
                    <a href={`/admin/outcomes?limit=${Math.min(counts.pending, 200)}`} className="text-teal-400 hover:underline">Show up to 200</a>
                  </div>
                )}
              </div>
            )
          )}
          {tab === 'ledger' && ledger && <ResolvedLedgerTable rows={ledger} />}
          {tab === 'accuracy' && summary && <AccuracyRollupTable summary={summary} />}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number | string; tone: 'teal' | 'amber' | 'slate' }) {
  const accent = tone === 'teal' ? 'text-teal-300' : tone === 'amber' ? 'text-amber-300' : 'text-slate-200';
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-lg font-semibold ${accent}`}>{typeof value === 'number' ? value.toLocaleString('en-US') : value}</div>
    </div>
  );
}
