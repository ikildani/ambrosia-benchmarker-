'use client';

/**
 * One pending match in /admin/outcomes (review queue).
 *
 * Left: the prediction (source, licensor, indication, phase, predicted bands).
 * Middle: the candidate deal (parties, date, phase, terms, source host).
 * Right: the match score with per-component evidence and Accept / Reject.
 *
 * The decision posts to POST /api/admin/outcomes (admin email session or
 * ADMIN_API_KEY) and updates optimistically: the row collapses to a one-line
 * receipt immediately, and is restored with the error if the call fails.
 * router.refresh() afterwards re-reads the counts on the server.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { EvidenceItem, QueueView, ScoreTone } from '@/lib/outcomes/admin-view';

type Action = 'accept' | 'reject';

const TONE: Record<ScoreTone, string> = {
  high: 'border-teal-500/40 bg-teal-500/15 text-teal-300',
  mid: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  low: 'border-slate-600 bg-slate-800/60 text-slate-300',
};

function EvidenceLine({ item }: { item: EvidenceItem }) {
  const mark = item.ok === true ? 'text-teal-400' : item.ok === false ? 'text-amber-400' : 'text-slate-500';
  return (
    <li className="flex items-baseline gap-2 text-[11px] leading-snug">
      <span className={`w-14 shrink-0 font-semibold uppercase tracking-wider ${mark}`}>{item.label}</span>
      <span className="text-slate-300">{item.value}</span>
      {item.weight && <span className="ml-auto shrink-0 font-mono text-slate-500">{item.weight}</span>}
    </li>
  );
}

export function OutcomeReviewRow({ view }: { view: QueueView }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<Action | null>(null);
  const [decided, setDecided] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: Action) {
    setBusy(action);
    setError(null);
    setDecided(action); // optimistic
    try {
      const res = await fetch('/api/admin/outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome_id: view.id, action, notes: note.trim() || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setDecided(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  if (decided) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-700/60 bg-slate-900/20 px-4 py-2 text-xs text-slate-400">
        <span className={decided === 'accept' ? 'font-semibold text-teal-300' : 'font-semibold text-amber-300'}>
          {decided === 'accept' ? 'Accepted' : 'Rejected'}
        </span>
        <span className="text-slate-300">{view.prediction.licensor}</span>
        <span>→</span>
        <span className="text-slate-300">{view.deal.parties}</span>
        <span className="font-mono">score {view.score.text}</span>
        {note.trim() && <span className="italic text-slate-500">“{note.trim()}”</span>}
        {busy && <span className="ml-auto">saving…</span>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/30 p-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_minmax(260px,0.9fr)]">
        {/* Prediction */}
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Prediction · {view.prediction.sourceLabel}</div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-100">{view.prediction.licensor}</div>
          <div className="mt-0.5 text-xs text-slate-400">
            {view.prediction.asset && <span className="text-slate-300">{view.prediction.asset} · </span>}
            <span>{view.prediction.indication}</span>
            {' · '}
            <span>{view.prediction.phase}</span>
          </div>
          <dl className="mt-2 space-y-0.5 font-mono text-xs text-slate-400">
            <div className="flex gap-2"><dt className="w-16 shrink-0 text-slate-500">Upfront</dt><dd className="text-slate-200">{view.prediction.upfrontBand}</dd></div>
            <div className="flex gap-2"><dt className="w-16 shrink-0 text-slate-500">Total</dt><dd className="text-slate-200">{view.prediction.totalBand}</dd></div>
            {view.prediction.window && <div className="flex gap-2"><dt className="w-16 shrink-0 text-slate-500">Window</dt><dd>{view.prediction.window}</dd></div>}
            <div className="flex gap-2"><dt className="w-16 shrink-0 text-slate-500">Made</dt><dd>{view.prediction.createdAt}</dd></div>
          </dl>
          {view.prediction.buyers.length > 0 && (
            <div className="mt-2 text-[11px] text-slate-500">
              Named buyers: <span className="text-slate-300">{view.prediction.buyers.join(', ')}</span>
            </div>
          )}
        </div>

        {/* Candidate deal */}
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Candidate deal</div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-100">{view.deal.parties}</div>
          <div className="mt-0.5 text-xs text-slate-400">
            {view.deal.asset && <span className="text-slate-300">{view.deal.asset} · </span>}
            {view.deal.indication && <span>{view.deal.indication} · </span>}
            <span>{view.deal.phase}</span>
            {view.deal.dealType && <span> · {view.deal.dealType}</span>}
          </div>
          <dl className="mt-2 space-y-0.5 font-mono text-xs text-slate-400">
            <div className="flex gap-2"><dt className="w-16 shrink-0 text-slate-500">Upfront</dt><dd className="text-slate-200">{view.deal.upfront} <span className="text-slate-500">· err {view.metrics.apeUpfront} · band {view.metrics.withinBandUpfront}</span></dd></div>
            <div className="flex gap-2"><dt className="w-16 shrink-0 text-slate-500">Total</dt><dd className="text-slate-200">{view.deal.total} <span className="text-slate-500">· err {view.metrics.apeTotal} · band {view.metrics.withinBandTotal}</span></dd></div>
            <div className="flex gap-2"><dt className="w-16 shrink-0 text-slate-500">Date</dt><dd>{view.deal.date}</dd></div>
            <div className="flex gap-2"><dt className="w-16 shrink-0 text-slate-500">Buyer</dt><dd>named {view.metrics.buyerHit}</dd></div>
          </dl>
          {view.deal.sourceUrl && (
            <a
              href={view.deal.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-2 inline-block rounded-md border border-slate-600 bg-slate-800/50 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
            >
              {view.deal.sourceHost ?? 'source'} ↗
            </a>
          )}
        </div>

        {/* Score, evidence, actions */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`rounded-md border px-2 py-0.5 font-mono text-sm font-semibold ${TONE[view.score.tone]}`}>{view.score.text}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">match score</span>
          </div>
          <ul className="mt-2 space-y-1">
            {view.evidence.length ? view.evidence.map((item) => <EvidenceLine key={item.label} item={item} />) : (
              <li className="text-[11px] text-slate-500">No evidence recorded.</li>
            )}
          </ul>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            maxLength={2000}
            className="mt-3 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-teal-500/60 focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => act('accept')}
              disabled={!!busy}
              className="rounded-md bg-teal-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-teal-400 disabled:opacity-40"
            >
              {busy === 'accept' ? '...' : 'Accept'}
            </button>
            <button
              onClick={() => act('reject')}
              disabled={!!busy}
              className="rounded-md bg-amber-500/80 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-40"
            >
              {busy === 'reject' ? '...' : 'Reject'}
            </button>
          </div>
          {error && <div className="mt-2 text-xs text-amber-400">Error: {error}</div>}
        </div>
      </div>
    </div>
  );
}
