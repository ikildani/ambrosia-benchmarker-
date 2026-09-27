/**
 * Admin — Deal Intelligence Brief requests: /admin/briefs
 *
 * Every intake, newest first, with where it sits in the flow (draft building →
 * invoice → call → opinion → delivered), the private data room link, signed
 * PDF and Excel links, and the actions that move it along. Auth is the admin
 * wrapper layout (AdminLayoutClient gates by ADMIN_EMAILS); reads go through
 * the service client, writes through /api/admin/briefs.
 */
import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { dataRoomUrl, mintBriefLinks } from '@/lib/brief/delivery';
import { BriefRequestRow, type BriefRequestView } from '@/components/admin/briefs/BriefRequestRow';

export const metadata: Metadata = { title: 'Briefs | Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const SELECT = 'id,created_at,name,email,company,asset_name,indication,phase,therapeutic_area,modality,modalities,target_deal_type,territory,status,payment_status,invoice_requested_at,invoice_sent_at,paid_at,auto_draft_status,mp_opinion,delivered_at,brief_page_count,brief_token,pdf_storage_path,excel_storage_path,intake_path,admin_notes,readiness';

interface Row {
  id: string; created_at: string; name: string; email: string; company: string | null; asset_name: string | null; indication: string; phase: string; therapeutic_area: string;
  modality: string | null; modalities: string[] | null; target_deal_type: string | null; territory: string | null; status: string; payment_status: string | null;
  invoice_requested_at: string | null; invoice_sent_at: string | null; paid_at: string | null; auto_draft_status: string | null; mp_opinion: string | null; delivered_at: string | null;
  brief_page_count: number | null; brief_token: string | null; pdf_storage_path: string | null; excel_storage_path: string | null; intake_path: string | null; admin_notes: string | null;
  readiness: { overall: string; topUpRecommended: boolean; lines: Array<{ key: string; label: string; value: string; status: string; detail: string }> } | null;
}

export default async function AdminBriefsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const show = typeof sp.show === 'string' ? sp.show : 'open';
  const supabase = createServiceClient();
  let q = supabase.from('benchmark_requests').select(SELECT).order('created_at', { ascending: false }).limit(100);
  if (show === 'open') q = q.not('status', 'in', '("delivered","walkthrough_scheduled","walkthrough_complete","cancelled")');
  const { data, error } = await q;
  const rows = ((data ?? []) as unknown as Row[]);

  const views: BriefRequestView[] = await Promise.all(rows.map(async r => {
    const links = r.pdf_storage_path ? await mintBriefLinks(supabase, { pdf_storage_path: r.pdf_storage_path, excel_storage_path: r.excel_storage_path }, 60 * 60) : { pdfUrl: null, excelUrl: null, expiresAt: '' };
    return {
      id: r.id, createdAt: r.created_at, name: r.name, email: r.email, company: r.company,
      assetLabel: r.asset_name ? `${r.asset_name} — ${r.indication}` : r.indication,
      profile: [r.therapeutic_area, r.phase, r.modality ?? r.modalities?.[0], r.target_deal_type, r.territory].filter(Boolean).join(' · '),
      status: r.status, paymentStatus: r.payment_status, invoiceRequestedAt: r.invoice_requested_at, invoiceSentAt: r.invoice_sent_at, paidAt: r.paid_at,
      autoDraftStatus: r.auto_draft_status, hasOpinion: !!(r.mp_opinion && r.mp_opinion.trim()), deliveredAt: r.delivered_at, pageCount: r.brief_page_count,
      dataRoomUrl: r.brief_token ? dataRoomUrl(r.brief_token) : null, pdfUrl: links.pdfUrl, excelUrl: links.excelUrl, intakePath: r.intake_path,
      adminNotesHead: r.admin_notes ? r.admin_notes.split('\n')[0] : null,
      readiness: r.readiness ? { overall: r.readiness.overall, topUp: r.readiness.topUpRecommended, lines: r.readiness.lines.map(l => ({ label: l.label, value: l.value, status: l.status, detail: l.detail })) } : null,
    };
  }));

  const counts = { building: rows.filter(r => r.status === 'intake' && r.auto_draft_status === 'requested').length, draft: rows.filter(r => r.status === 'call_complete').length, invoice: rows.filter(r => !r.invoice_sent_at && r.status !== 'delivered').length };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-400">Deal Intelligence Brief</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Requests</h1>
          <ol className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-400">
            {['Intake', 'Draft builds', 'Invoice', 'Call with the draft', 'Opinion', 'Deliver', 'Walkthrough', 'Scored'].map((step, i, a) => <li key={step} className="flex items-center gap-2"><span className="text-slate-200">{step}</span>{i < a.length - 1 ? <span className="text-slate-600">›</span> : null}</li>)}
          </ol>
        </div>
        <div className="flex gap-2 text-sm">
          <a href="/admin/briefs?show=open" className={`rounded-md border px-3 py-1.5 ${show === 'open' ? 'border-teal-400/50 bg-teal-500/10 text-teal-200' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}>Open</a>
          <a href="/admin/briefs?show=all" className={`rounded-md border px-3 py-1.5 ${show === 'all' ? 'border-teal-400/50 bg-teal-500/10 text-teal-200' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}>All</a>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[['Drafts building', counts.building], ['Drafts ready for the call', counts.draft], ['Invoices to send', counts.invoice]].map(([k, v]) => (
          <div key={String(k)} className="rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4"><div className="text-xs text-slate-400">{k}</div><div className="mt-1 text-2xl font-semibold text-slate-50">{v}</div></div>
        ))}
      </div>
      {error ? <p className="mt-6 text-sm text-rose-400">{error.message}</p> : null}
      <div className="mt-8 space-y-4">
        {views.length === 0 ? <p className="text-sm text-slate-500">No requests{show === 'open' ? ' open' : ''}.</p> : views.map(v => <BriefRequestRow key={v.id} r={v} />)}
      </div>
      <p className="mt-8 text-xs text-slate-600">Data-room links are permanent per brief and mint fresh 30-day download links each visit; a draft's data room shows a preview banner and is only visible to you until delivered. The PDF and Excel links on this page are one-hour signed URLs.</p>
    </div>
    </div>
  );
}
