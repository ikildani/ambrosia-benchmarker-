'use client';

/**
 * Client outcome form for a brief prediction: first offer, our ask (prefilled
 * from the prediction), signed terms, licensee, date, notes. POSTs to
 * /api/outcomes/report with the signed link token; money in $M.
 */

import { useState } from 'react';

export interface OutcomeReportPrefill {
  predictionId: string;
  token: string;
  ourAskUpfrontM: number | null;
  ourAskTotalM: number | null;
  existing: {
    firstOfferUpfrontM: number | null;
    firstOfferTotalM: number | null;
    ourAskUpfrontM: number | null;
    ourAskTotalM: number | null;
    upfrontM: number | null;
    totalM: number | null;
    licenseeName: string | null;
    signedDate: string | null;
    notes: string | null;
  } | null;
}

type Status = 'idle' | 'submitting' | 'done' | 'error';

const inputClassName =
  'w-full px-4 py-3 text-sm rounded-xl border border-slate-600 bg-slate-800/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors';
const labelClassName = 'block text-sm font-medium text-slate-300 mb-1.5';

function str(v: number | null | undefined): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
}

/** "" → null; "12.5" → 12.5; anything else → NaN (rejected before submit). */
function money(v: string): number | null {
  const t = v.trim().replace(/[$,]/g, '').replace(/m$/i, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

export default function OutcomeReportForm({ prefill }: { prefill: OutcomeReportPrefill }) {
  const ex = prefill.existing;
  const [form, setForm] = useState({
    firstOfferUpfront: str(ex?.firstOfferUpfrontM),
    firstOfferTotal: str(ex?.firstOfferTotalM),
    askUpfront: str(ex?.ourAskUpfrontM ?? prefill.ourAskUpfrontM),
    askTotal: str(ex?.ourAskTotalM ?? prefill.ourAskTotalM),
    signedUpfront: str(ex?.upfrontM),
    signedTotal: str(ex?.totalM),
    licensee: ex?.licenseeName ?? '',
    signedDate: ex?.signedDate ?? '',
    notes: ex?.notes ?? '',
  });
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nums = {
      first_offer_upfront_m: money(form.firstOfferUpfront),
      first_offer_total_m: money(form.firstOfferTotal),
      our_ask_upfront_m: money(form.askUpfront),
      our_ask_total_m: money(form.askTotal),
      upfront_m: money(form.signedUpfront),
      total_m: money(form.signedTotal),
    };
    if (Object.values(nums).some((n) => n !== null && Number.isNaN(n))) {
      setStatus('error');
      setMessage('Amounts must be numbers in $M, for example 25 or 12.5.');
      return;
    }
    if (form.signedDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.signedDate)) {
      setStatus('error');
      setMessage('Signed date must be YYYY-MM-DD.');
      return;
    }
    setStatus('submitting');
    setMessage(null);
    try {
      const res = await fetch('/api/outcomes/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prediction_id: prefill.predictionId,
          token: prefill.token,
          ...nums,
          licensee_name: form.licensee.trim() || null,
          signed_date: form.signedDate || null,
          notes: form.notes.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatus('error');
        setMessage(json.error ?? 'The outcome could not be recorded. Reply to the email and we will record it by hand.');
        return;
      }
      setStatus('done');
    } catch (err) {
      console.warn('[Outcomes] report form failed:', err instanceof Error ? err.message : err);
      setStatus('error');
      setMessage('The outcome could not be recorded. Reply to the email and we will record it by hand.');
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-6">
        <p className="text-base font-semibold text-slate-50">Recorded. Thank you.</p>
        <p className="mt-2 text-sm text-slate-400">
          The terms are in the ledger. If anything changes, this link keeps working and a new submission replaces this one.
        </p>
      </div>
    );
  }

  const pair = (label: string, aKey: keyof typeof form, bKey: keyof typeof form, hint?: string) => (
    <fieldset>
      <legend className={labelClassName}>{label}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={aKey} className="mb-1 block text-xs text-slate-500">Upfront, $M</label>
          <input id={aKey} inputMode="decimal" placeholder="e.g. 25" value={form[aKey]} onChange={set(aKey)} className={inputClassName} />
        </div>
        <div>
          <label htmlFor={bKey} className="mb-1 block text-xs text-slate-500">Total value, $M</label>
          <input id={bKey} inputMode="decimal" placeholder="e.g. 400" value={form[bKey]} onChange={set(bKey)} className={inputClassName} />
        </div>
      </div>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </fieldset>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {pair('First offer received', 'firstOfferUpfront', 'firstOfferTotal', 'The first written terms from any counterparty. Leave blank if none yet.')}
      {pair('Your opening ask', 'askUpfront', 'askTotal', 'Prefilled from the brief. Change it if you went out with different numbers.')}
      {pair('Signed terms', 'signedUpfront', 'signedTotal', 'Leave blank if nothing has been signed.')}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="licensee" className={labelClassName}>Licensee / acquirer</label>
          <input id="licensee" type="text" autoComplete="organization" placeholder="Company name" value={form.licensee} onChange={set('licensee')} className={inputClassName} />
        </div>
        <div>
          <label htmlFor="signedDate" className={labelClassName}>Signed date</label>
          <input id="signedDate" type="date" value={form.signedDate} onChange={set('signedDate')} className={inputClassName} />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className={labelClassName}>Notes</label>
        <textarea id="notes" rows={3} placeholder="Structure, royalty, anything the numbers do not show" value={form.notes} onChange={set('notes')} className={inputClassName} />
      </div>

      {message && status === 'error' && (
        <p className="text-sm text-amber-400" role="alert">{message}</p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full py-3 text-sm font-semibold bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === 'submitting' ? 'Recording…' : 'Record outcome'}
      </button>
      <p className="text-xs text-slate-500">
        Used only in aggregate to measure the brief against what was signed. Never published in a way that identifies you or the asset.
      </p>
    </form>
  );
}
