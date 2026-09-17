'use client';

import { useState } from 'react';
import { ArrowDownTrayIcon, LinkIcon, DocumentTextIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import { btnSecondary, btnGhost } from './ui';

/** PDF brief, XLSX row, and share link (the page URL, Pro-gated). */
export function ExportMenu({ assetId, assetName }: { assetId: string; assetName: string }) {
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const download = async (kind: 'pdf' | 'xlsx') => {
    setBusy(kind); setStatus(null);
    try {
      const res = kind === 'pdf'
        ? await fetch(`/api/radar/export?asset_id=${assetId}&format=pdf`)
        : await fetch('/api/radar/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format: 'xlsx', source: 'selection', asset_ids: [assetId] }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${assetName.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}-radar-brief.${kind}`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`${kind.toUpperCase()} downloaded`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Export failed');
    } finally { setBusy(null); }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/radar/${assetId}`;
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copied (Pro users only can open it)');
    } catch {
      setStatus(url);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => download('pdf')} disabled={busy !== null} className={btnSecondary}>
          <DocumentTextIcon className="h-4 w-4" aria-hidden="true" /> {busy === 'pdf' ? 'Rendering…' : 'PDF brief'}
        </button>
        <button type="button" onClick={() => download('xlsx')} disabled={busy !== null} className={btnSecondary}>
          <TableCellsIcon className="h-4 w-4" aria-hidden="true" /> {busy === 'xlsx' ? 'Building…' : 'XLSX'}
        </button>
        <button type="button" onClick={copyLink} className={btnGhost}>
          <LinkIcon className="h-4 w-4" aria-hidden="true" /> Copy link
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-neutral-500 dark:text-neutral-400" aria-live="polite">
        {status ?? <><ArrowDownTrayIcon className="mr-0.5 inline h-3 w-3 align-text-bottom" aria-hidden="true" />PDF excludes notes; XLSX includes a provenance sheet.</>}
      </p>
    </div>
  );
}
