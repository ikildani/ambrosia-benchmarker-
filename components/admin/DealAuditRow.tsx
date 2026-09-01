'use client';

/**
 * Per-row audit control for /admin/deal-audit.
 *
 * Renders the key deal fields, the source excerpt, a google-search link,
 * and three action buttons (Verify / Reject / Skip). Each action posts
 * to /api/admin/deal-audit and triggers a router.refresh() so the next
 * row slides in.
 *
 * The component is intentionally dense — an admin auditing 20 rows per
 * session benefits from information density over whitespace.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  row: {
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
    extraction_notes: string | null;
    extraction_model: string | null;
  };
}

function fmtM(n: number | null): string {
  if (n == null) return '—';
  return `$${(n / 1_000_000).toFixed(1)}M`;
}

export function DealAuditRow({ row }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<'verify' | 'reject' | 'skip' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: 'verify' | 'reject' | 'skip', notes?: string) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch('/api/admin/deal-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, action, notes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  }

  const searchQuery = [row.licensor_name, row.licensee_name, row.asset_name]
    .filter(Boolean)
    .join(' ');
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-slate-100">
              {row.licensor_name || '?'} → {row.licensee_name || '?'}
            </span>
            <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300">
              {row.announced_date?.slice(0, 10) ?? 'no date'}
            </span>
            {row.confidence_score != null && (
              <span className="text-xs text-slate-500">
                conf {row.confidence_score}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            <span className="text-slate-300">{row.asset_name || '(no asset name)'}</span>
            {' · '}
            <span>{row.modality || '?'}</span>
            {' · '}
            <span>{row.phase_at_signing || '?'}</span>
            {' · '}
            <span>{row.deal_type || '?'}</span>
            {' · '}
            <span>{row.therapeutic_area || '?'}</span>
            {row.indication_specific && <span> · {row.indication_specific}</span>}
          </div>
          <div className="mt-1 text-xs font-mono text-slate-500">
            Upfront {fmtM(row.upfront_usd)} · Total {fmtM(row.total_deal_value_usd)}
            {row.source_type && ` · src=${row.source_type}`}
            {row.extraction_model && ` · model=${row.extraction_model}`}
          </div>
          {row.extraction_notes && (
            <div className="mt-1 text-[11px] text-slate-600 italic">
              {row.extraction_notes}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {row.source_url && (
            <a
              href={row.source_url}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-md border border-slate-600 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              Source ↗
            </a>
          )}
          <a
            href={googleUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-md border border-slate-600 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
          >
            Google ↗
          </a>
          <button
            onClick={() => act('verify')}
            disabled={!!busy}
            className="rounded-md bg-teal-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-teal-400 disabled:opacity-40"
          >
            {busy === 'verify' ? '...' : '✓ Verify'}
          </button>
          <button
            onClick={() => act('reject')}
            disabled={!!busy}
            className="rounded-md bg-amber-500/80 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-40"
          >
            {busy === 'reject' ? '...' : '✗ Reject'}
          </button>
          <button
            onClick={() => act('skip')}
            disabled={!!busy}
            className="rounded-md border border-slate-600 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            {busy === 'skip' ? '...' : 'Skip'}
          </button>
        </div>
      </div>

      {row.raw_text_excerpt && (
        <div className="mt-3 rounded border border-slate-700/40 bg-slate-950/40 p-2 text-xs text-slate-400 line-clamp-3">
          {row.raw_text_excerpt}
        </div>
      )}

      {error && (
        <div className="mt-2 text-xs text-amber-400">Error: {error}</div>
      )}
    </div>
  );
}
