'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Deal {
  id: string;
  announced_date: string | null;
  asset_name: string | null;
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
  source_type: string | null;
  source_url: string | null;
  confidence_score: number | null;
  created_at: string | null;
}

interface Props {
  licensor: string;
  licensee: string;
  year: string;
  deals: Deal[];
}

function fmtM(n: number | null): string {
  if (n == null) return '—';
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  return `$${(n / 1_000_000).toFixed(0)}M`;
}

export function DedupRow({ licensor, licensee, year, deals }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<Record<string, string | null>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  async function keepDeal(id: string) {
    setBusy(prev => ({ ...prev, [id]: 'keep' }));
    try {
      const res = await fetch('/api/admin/deal-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'verify', notes: 'Kept via dedup tool' }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {}
    setBusy(prev => ({ ...prev, [id]: null }));
  }

  async function deleteDeal(id: string) {
    setBusy(prev => ({ ...prev, [id]: 'delete' }));
    try {
      const res = await fetch('/api/admin/deal-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reject', notes: 'Rejected as duplicate via dedup tool' }),
      });
      if (res.ok) {
        setRemoved(prev => new Set([...prev, id]));
      }
    } catch {}
    setBusy(prev => ({ ...prev, [id]: null }));
  }

  const visibleDeals = deals.filter(d => !removed.has(d.id));
  if (visibleDeals.length < 2) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-amber-400" />
        <span className="text-sm font-semibold text-slate-100">
          {licensor} → {licensee}
        </span>
        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
          {year} · {visibleDeals.length} copies
        </span>
      </div>

      <div className="grid gap-2">
        {visibleDeals.map((deal) => (
          <div
            key={deal.id}
            className="flex items-center justify-between gap-3 rounded-md bg-slate-900/60 border border-slate-700/40 p-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="text-slate-200 font-medium">{deal.asset_name || '(no asset)'}</span>
                <span>· {deal.announced_date?.slice(0, 10) || 'no date'}</span>
                <span>· Upfront {fmtM(deal.upfront_usd)}</span>
                <span>· Total {fmtM(deal.total_deal_value_usd)}</span>
                <span>· src={deal.source_type || '?'}</span>
                {deal.confidence_score != null && <span>· conf {deal.confidence_score}</span>}
              </div>
            </div>

            <div className="flex gap-2 flex-shrink-0">
              {deal.source_url && (
                <a
                  href={deal.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-slate-600 bg-slate-800/50 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
                >
                  Source ↗
                </a>
              )}
              <button
                onClick={() => keepDeal(deal.id)}
                disabled={!!busy[deal.id]}
                className="rounded-md bg-teal-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-40"
              >
                {busy[deal.id] === 'keep' ? '...' : '✓ Keep'}
              </button>
              <button
                onClick={() => deleteDeal(deal.id)}
                disabled={!!busy[deal.id]}
                className="rounded-md bg-red-600/80 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40"
              >
                {busy[deal.id] === 'delete' ? '...' : '✗ Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
