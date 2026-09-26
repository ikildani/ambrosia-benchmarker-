'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface BriefRequestView {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  company: string | null;
  assetLabel: string;
  profile: string;
  status: string;
  paymentStatus: string | null;
  invoiceRequestedAt: string | null;
  invoiceSentAt: string | null;
  paidAt: string | null;
  autoDraftStatus: string | null;
  hasOpinion: boolean;
  deliveredAt: string | null;
  pageCount: number | null;
  dataRoomUrl: string | null;
  pdfUrl: string | null;
  excelUrl: string | null;
  intakePath: string | null;
  adminNotesHead: string | null;
}

const STATUS_TONE: Record<string, string> = {
  intake: 'bg-slate-700 text-slate-200',
  generating: 'bg-amber-500/20 text-amber-200',
  call_complete: 'bg-sky-500/20 text-sky-200',
  delivered: 'bg-teal-500/20 text-teal-200',
  walkthrough_scheduled: 'bg-teal-500/20 text-teal-200',
  walkthrough_complete: 'bg-teal-500/30 text-teal-100',
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—');

export function BriefRequestRow({ r }: { r: BriefRequestView }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [opinion, setOpinion] = useState('');
  const [showOpinion, setShowOpinion] = useState(false);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action); setMsg(null);
    try {
      const res = await fetch('/api/admin/briefs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: r.id, action, ...extra }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(json.error || `Failed (${res.status})`); return; }
      setMsg(action === 'build' ? (json.result?.delivered ? 'Delivered and emailed.' : json.result?.note || 'Draft built.') : 'Saved.');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally { setBusy(null); }
  }

  const stage = r.status === 'intake' && r.autoDraftStatus === 'requested' ? 'Draft building…' : r.status === 'call_complete' ? (r.hasOpinion ? 'Draft + opinion: run Deliver' : 'Draft ready for the call') : r.status === 'delivered' ? 'Delivered' : r.status.replace(/_/g, ' ');

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_TONE[r.status] ?? 'bg-slate-700 text-slate-200'}`}>{stage}</span>
            {r.autoDraftStatus === 'failed' ? <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-rose-200">auto-draft failed</span> : null}
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] ${r.paidAt ? 'bg-teal-500/15 text-teal-200' : r.invoiceSentAt ? 'bg-amber-500/15 text-amber-200' : 'bg-slate-800 text-slate-400'}`}>{r.paidAt ? `Paid ${fmt(r.paidAt)}` : r.invoiceSentAt ? `Invoice sent ${fmt(r.invoiceSentAt)}` : 'Invoice to send'}</span>
            <span className="text-[11px] text-slate-500">{fmt(r.createdAt)} · {r.intakePath ?? '—'}</span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-slate-50">{r.assetLabel}</h3>
          <p className="text-sm text-slate-400">{r.profile}</p>
          <p className="mt-1 text-sm text-slate-300">{r.name}{r.company ? `, ${r.company}` : ''} · <a className="text-teal-300 hover:underline" href={`mailto:${r.email}`}>{r.email}</a></p>
          {r.adminNotesHead ? <p className="mt-2 max-w-2xl truncate font-mono text-[11px] text-slate-500" title={r.adminNotesHead}>{r.adminNotesHead}</p> : null}
        </div>
        <div className="flex flex-col items-end gap-2 text-sm">
          <div className="flex flex-wrap justify-end gap-2">
            {r.dataRoomUrl ? <a href={r.dataRoomUrl} target="_blank" rel="noreferrer" className="rounded-md border border-teal-400/40 bg-teal-500/10 px-3 py-1.5 font-medium text-teal-200 hover:bg-teal-500/20">Data room</a> : <span className="rounded-md border border-slate-800 px-3 py-1.5 text-slate-600">No data room yet</span>}
            {r.pdfUrl ? <a href={r.pdfUrl} target="_blank" rel="noreferrer" className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-800">PDF{r.pageCount ? ` · ${r.pageCount}p` : ''}</a> : null}
            {r.excelUrl ? <a href={r.excelUrl} target="_blank" rel="noreferrer" className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-800">Excel</a> : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {!r.invoiceSentAt ? <button onClick={() => act('invoice_sent')} disabled={!!busy} className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-800 disabled:opacity-50">Mark invoice sent</button> : null}
            {r.invoiceSentAt && !r.paidAt ? <button onClick={() => act('paid')} disabled={!!busy} className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-800 disabled:opacity-50">Mark paid</button> : null}
            <button onClick={() => act('build')} disabled={!!busy} className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-800 disabled:opacity-50">{busy === 'build' ? 'Building…' : r.hasOpinion ? (r.deliveredAt ? 'Rebuild + resend' : 'Deliver') : (r.dataRoomUrl ? 'Rebuild draft' : 'Build draft')}</button>
            <button onClick={() => setShowOpinion(v => !v)} className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-800">{r.hasOpinion ? 'Edit opinion' : 'Add opinion'}</button>
          </div>
          {msg ? <p className="text-xs text-slate-400">{msg}</p> : null}
        </div>
      </div>
      {showOpinion ? (
        <div className="mt-4 border-t border-slate-800 pt-4">
          <label className="mb-1 block text-xs text-slate-500">Managing Partner opinion (1–3 short paragraphs, printed and signed on the brief). Saving does not deliver; press Deliver afterwards.</label>
          <textarea value={opinion} onChange={e => setOpinion(e.target.value)} rows={4} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400" />
          <div className="mt-2 flex gap-2">
            <button onClick={() => act('opinion', { text: opinion })} disabled={!!busy || opinion.trim().length < 20} className="rounded-md bg-teal-500 px-3 py-1.5 text-sm font-semibold text-slate-950 disabled:opacity-50">Save opinion</button>
            <button onClick={() => setShowOpinion(false)} className="text-sm text-slate-400">Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
