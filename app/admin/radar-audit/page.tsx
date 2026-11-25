/**
 * Admin: Search & Evaluation top-of-list audit — /admin/radar-audit
 *
 * One program per screen, drawn at random from the top 500 of the default feed ("Best fit", the
 * scorecard's population) that nobody has reviewed in the last 60 days. The reviewer confirms or
 * corrects owner, availability and duplicate status; each review writes three
 * radar_qa_human_reviews rows (the scorecard's audit_owner / audit_availability / duplicate
 * measures) and, for a correction, an override or a company relation (lib/radar/qa/audit.ts).
 *
 * Keyboard: Y all correct and next · 1 owner wrong · 2 availability wrong · 3 duplicate ·
 * Enter save and next · S skip.
 *
 * ?id=<asset id> opens a specific program; ?skip=<ids> excludes programs skipped this session.
 */

import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminPage } from '@/lib/auth/require-admin-page';
import { AUDIT_MIN_SAMPLE, auditProgress, loadAuditEvidence, loadAuditQueue, pickNext } from '@/lib/radar/qa/audit';
import { RadarAuditCard } from '@/components/admin/RadarAuditCard';

export const metadata: Metadata = {
  title: 'Search & Evaluation audit | Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RadarAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; skip?: string }>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const supabase = createServiceClient();
  const queue = await loadAuditQueue(supabase);
  const progress = auditProgress(queue);
  const skip = (params.skip ?? '').split(',').filter(id => UUID_RE.test(id)).slice(0, 200);
  const requested = params.id && UUID_RE.test(params.id) ? params.id : null;
  const target = requested
    ? { asset_id: requested, rank: queue.find(r => r.asset_id === requested)?.rank ?? null }
    : pickNext(queue, new Set(skip));
  const evidence = target ? await loadAuditEvidence(supabase, target.asset_id, target.rank) : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Search &amp; Evaluation audit</h1>
        <div className="text-sm text-slate-600">
          Top {progress.total} of the default feed · reviewed {progress.reviewed} ·
          owner {progress.byField.owner}/{AUDIT_MIN_SAMPLE} · availability {progress.byField.availability}/{AUDIT_MIN_SAMPLE} ·
          duplicate {progress.byField.duplicate}/{AUDIT_MIN_SAMPLE}
        </div>
      </div>
      {evidence ? (
        <RadarAuditCard key={evidence.asset.id} evidence={evidence} skip={skip} />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-slate-700">
          {target ? 'That program no longer exists.' : 'Every program in the top 500 has a review from the last 60 days.'}
        </div>
      )}
    </div>
  );
}
