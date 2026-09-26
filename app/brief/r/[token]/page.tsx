import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { DELIVERED_STATUSES, DELIVERY_COLUMNS, mintBriefLinks, type BriefDeliveryRow } from '@/lib/brief/delivery';
import { loadBriefCall } from '@/lib/brief/outcome-status';
import { callStatus, FOLLOWUP_DAYS } from '@/lib/brief/scored-call';

/**
 * Private data room for a delivered Deal Intelligence Brief.
 *
 * Reached from the delivery email by brief token. Mints fresh signed links
 * on every visit so the page keeps working after the emailed links expire.
 * Never indexed; a draft (no Managing Partner opinion) is not served.
 */

export const dynamic = 'force-dynamic';

interface Props { params: Promise<{ token: string }> }

async function loadRow(token: string): Promise<BriefDeliveryRow | null> {
  if (!/^[a-f0-9]{16}$/i.test(token)) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('benchmark_requests')
    .select(DELIVERY_COLUMNS)
    .eq('brief_token', token)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as BriefDeliveryRow;
  if (!DELIVERED_STATUSES.has(row.status)) return null;
  return row;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const row = await loadRow(token);
  return {
    title: row ? `Deal Intelligence Brief — ${row.asset_name ?? row.indication}` : 'Deal Intelligence Brief',
    robots: { index: false, follow: false, nocache: true },
  };
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default async function BriefDataRoomPage({ params }: Props) {
  const { token } = await params;
  const row = await loadRow(token);
  if (!row) notFound();
  const supabase = createServiceClient();
  const links = await mintBriefLinks(supabase, row);
  const call = await loadBriefCall(supabase, { id: row.id, prediction_id: row.prediction_id ?? null });
  const status = callStatus(call.prediction, call.outcome);
  const pred = call.prediction;
  const fmtM = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? `$${v >= 1000 ? `${(v / 1000).toFixed(1)}B` : `${Math.round(v)}M`}` : '—');
  const followupDates = FOLLOWUP_DAYS.map(d => {
    if (!row.delivered_at) return { day: d, date: null as string | null };
    const t = new Date(row.delivered_at).getTime() + d * 86_400_000;
    return { day: d, date: new Date(t).toISOString() };
  });
  const statusTone = status.state === 'resolved' ? 'text-teal-200' : status.state === 'expired' ? 'text-amber-200' : 'text-slate-200';
  const title = row.asset_name ? `${row.asset_name} · ${row.indication}` : row.indication;

  return (
    <main className="min-h-screen bg-[#0b1220] text-slate-100">
      <div className="mx-auto max-w-2xl px-6 py-14">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-300/80">Solidus by Ambrosia Ventures · Confidential</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Deal Intelligence Brief</h1>
        <p className="mt-1 text-lg text-slate-300">{title}</p>
        <p className="mt-1 text-sm text-slate-400">
          {row.phase}{row.modality ? ` · ${row.modality}` : ''}{row.brief_page_count ? ` · ${row.brief_page_count} pages` : ''}
          {row.delivered_at ? ` · delivered ${fmtDate(row.delivered_at)}` : ''}
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {links.pdfUrl ? (
            <a href={links.pdfUrl} className="rounded-md border border-teal-400/40 bg-teal-500/10 px-5 py-4 text-left transition hover:bg-teal-500/20">
              <div className="text-sm font-semibold text-teal-200">Open the brief (PDF)</div>
              <div className="mt-1 text-xs text-slate-400">Start with page three: the decision.</div>
            </a>
          ) : (
            <div className="rounded-md border border-slate-700 px-5 py-4 text-sm text-slate-400">The PDF is being re-issued; reply to your delivery email and we will send it directly.</div>
          )}
          {links.excelUrl ? (
            <a href={links.excelUrl} className="rounded-md border border-slate-700 bg-slate-800/40 px-5 py-4 text-left transition hover:bg-slate-800/70">
              <div className="text-sm font-semibold text-slate-100">Excel data export</div>
              <div className="mt-1 text-xs text-slate-400">Every figure behind the pages, with provenance.</div>
            </a>
          ) : null}
        </div>

        <div className="mt-10 rounded-md border border-teal-400/30 bg-teal-500/5 p-5 text-sm leading-relaxed text-slate-300">
          <div className="flex items-baseline justify-between gap-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-300/80">This call is scored</div>
            <div className={`text-xs font-semibold ${statusTone}`}>{status.state === 'open' ? 'Open' : status.state === 'resolved' ? 'Resolved' : status.state === 'expired' ? 'Expired' : 'Withdrawn'}</div>
          </div>
          <p className="mt-2 text-slate-400">{status.note}</p>
          {pred ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-500">Ask registered</div>
                <div className="mt-1 font-mono text-slate-100">{fmtM(pred.upfront_mid)} up · {fmtM(pred.total_mid)} total</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-500">Floor</div>
                <div className="mt-1 font-mono text-slate-100">{fmtM(pred.upfront_low)} up · {fmtM(pred.total_low)} total</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-500">Window</div>
                <div className="mt-1 font-mono text-slate-100">{pred.predicted_window_start ? fmtDate(pred.predicted_window_start) : '—'} – {pred.predicted_window_end ? fmtDate(pred.predicted_window_end) : '—'}</div>
              </div>
              {pred.predicted_buyers?.length ? (
                <div className="sm:col-span-3">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">Counterparties on the call</div>
                  <div className="mt-1 text-slate-100">{pred.predicted_buyers.join(' · ')}</div>
                </div>
              ) : null}
            </div>
          ) : null}
          {status.state === 'resolved' ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3 rounded-md border border-slate-800 bg-slate-900/60 p-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-500">First offer</div>
                <div className="mt-1 font-mono text-slate-100">{fmtM(status.outcome.firstOfferUpfrontM)} up · {fmtM(status.outcome.firstOfferTotalM)} total</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-500">Signed{status.outcome.licensee ? ` · ${status.outcome.licensee}` : ''}</div>
                <div className="mt-1 font-mono text-slate-100">{fmtM(status.outcome.signedUpfrontM)} up · {fmtM(status.outcome.signedTotalM)} total</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-500">Value captured</div>
                <div className="mt-1 font-mono text-teal-200">{fmtM(status.outcome.valueCapturedM)}</div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {status.outcome.buyerHit != null ? `Buyer ${status.outcome.buyerHit ? 'on' : 'not on'} the list` : ''}{status.outcome.windowHit != null ? ` · ${status.outcome.windowHit ? 'inside' : 'outside'} the window` : ''}
                </div>
              </div>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400">
            {followupDates.map(f => (
              <span key={f.day}><span className="font-semibold text-slate-200">Day {f.day}</span> · {f.date ? fmtDate(f.date) : 'after delivery'}</span>
            ))}
            {call.reportUrl && status.state !== 'resolved' ? (
              <a href={call.reportUrl} className="ml-auto rounded-md border border-teal-400/40 bg-teal-500/10 px-3 py-1.5 font-semibold text-teal-200 transition hover:bg-teal-500/20">Report the outcome now</a>
            ) : null}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">Scored automatically when a transaction is published, or from what you report. Nothing you report is published in a way that identifies you or the asset; the score feeds the next brief in this area.</p>
        </div>

        <div className="mt-10 rounded-md border border-slate-800 bg-slate-900/40 p-5 text-sm leading-relaxed text-slate-300">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">How to read it</div>
          <p className="mt-2">Page three is the recommendation: the ask, the floor, the walk-away, and who to open with. Page five reconciles the valuation methods to that ask; page eight is the cited comparable set. The buyer map, the catalyst calendar, the objections and the diligence list follow. Every number that appears on more than one page comes from one place.</p>
          <div className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Walkthrough</div>
          <p className="mt-2">{row.walkthrough_scheduled_at ? `Scheduled for ${fmtDate(row.walkthrough_scheduled_at)}.` : 'Reply to your delivery email with two or three times that work and we will go through the pages together.'}</p>
          {row.mp_reviewer ? <p className="mt-4 text-xs text-slate-500">Reviewed and signed by {row.mp_reviewer}{row.mp_reviewed_at ? `, ${fmtDate(row.mp_reviewed_at)}` : ''}.</p> : null}
        </div>

        <p className="mt-8 text-xs text-slate-500">Download links on this page are issued fresh on each visit and expire after 30 days. This brief is confidential and intended solely for {row.company ? row.company : 'the addressee'}.</p>
      </div>
    </main>
  );
}
