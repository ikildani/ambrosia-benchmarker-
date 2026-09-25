/**
 * /outcomes/report/<token> — the client outcome form linked from the day-45
 * and day-120 brief follow-up emails. The token (lib/outcomes/report-token)
 * names the prediction and expires; the page verifies it, loads the
 * prediction and any earlier client report, and renders the form. Private:
 * noindex, no auth beyond the token.
 */

import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyOutcomeReportToken } from '@/lib/outcomes/report-token';
import OutcomeReportForm, { type OutcomeReportPrefill } from '@/components/outcomes/OutcomeReportForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Record your deal outcome | Solidus',
  description: 'Record the first offer, your ask and the signed terms for the asset covered by your Deal Intelligence Brief.',
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ token: string }>;
}

interface PredictionRow {
  id: string;
  status: string;
  asset_name: string | null;
  licensor_name: string | null;
  indication: string | null;
  therapeutic_area: string | null;
  phase: string | null;
  upfront_mid: number | null;
  total_mid: number | null;
  created_at: string;
}

interface ClientOutcomeRow {
  first_offer_upfront_m: number | null;
  first_offer_total_m: number | null;
  our_ask_upfront_m: number | null;
  our_ask_total_m: number | null;
  upfront_m: number | null;
  total_m: number | null;
  licensee_name: string | null;
  signed_date: string | null;
  notes: string | null;
  resolved_at: string | null;
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-400">Solidus · Deal Intelligence Brief</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">{title}</h1>
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}

function Invalid({ reason }: { reason: string }) {
  const expired = reason === 'expired';
  return (
    <Shell title={expired ? 'This link has expired' : 'This link is not valid'}>
      <p className="text-sm text-slate-400">
        {expired
          ? 'Outcome links stay valid for six months after they are sent.'
          : 'The link may have been cut short when it was copied.'}{' '}
        Reply to the email you received, or write to{' '}
        <a href="mailto:ikildani@ambrosiaventures.co" className="text-teal-400 hover:text-teal-300">ikildani@ambrosiaventures.co</a>, and we will record the outcome by hand.
      </p>
    </Shell>
  );
}

export default async function OutcomeReportPage({ params }: Props) {
  const { token } = await params;
  const verified = verifyOutcomeReportToken(token);
  if (!verified.ok) {
    console.warn(`[Outcomes] report page token rejected: ${verified.reason}`);
    return <Invalid reason={verified.reason} />;
  }

  let prediction: PredictionRow | null = null;
  let existing: ClientOutcomeRow | null = null;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('predictions')
      .select('id,status,asset_name,licensor_name,indication,therapeutic_area,phase,upfront_mid,total_mid,created_at')
      .eq('id', verified.payload.predictionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    prediction = (data as PredictionRow | null) ?? null;
    if (prediction) {
      const { data: out } = await supabase
        .from('outcomes')
        .select('first_offer_upfront_m,first_offer_total_m,our_ask_upfront_m,our_ask_total_m,upfront_m,total_m,licensee_name,signed_date,notes,resolved_at')
        .eq('prediction_id', prediction.id)
        .eq('matched_by', 'client')
        .eq('status', 'accepted')
        .order('resolved_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      existing = (out as ClientOutcomeRow | null) ?? null;
    }
  } catch (e) {
    console.warn('[Outcomes] report page load failed:', e instanceof Error ? e.message : e);
  }

  if (!prediction) return <Invalid reason="not_found" />;

  const label = prediction.asset_name?.trim() || [prediction.indication, prediction.phase].filter(Boolean).join(', ') || 'your asset';
  const prefill: OutcomeReportPrefill = {
    predictionId: prediction.id,
    token,
    ourAskUpfrontM: num(prediction.upfront_mid),
    ourAskTotalM: num(prediction.total_mid),
    existing: existing
      ? {
          firstOfferUpfrontM: num(existing.first_offer_upfront_m),
          firstOfferTotalM: num(existing.first_offer_total_m),
          ourAskUpfrontM: num(existing.our_ask_upfront_m),
          ourAskTotalM: num(existing.our_ask_total_m),
          upfrontM: num(existing.upfront_m),
          totalM: num(existing.total_m),
          licenseeName: existing.licensee_name,
          signedDate: existing.signed_date,
          notes: existing.notes,
        }
      : null,
  };
  const recordedOn = existing?.resolved_at
    ? new Date(existing.resolved_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : null;

  return (
    <Shell title={`Outcome for ${label}`}>
      <p className="text-sm text-slate-400">
        Enter what you know. Every field is optional; blanks are recorded as unknown, not zero. Amounts are in $M.
      </p>
      {recordedOn && (
        <p className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
          An outcome was recorded on {recordedOn}. Submitting again replaces it.
        </p>
      )}
      <div className="mt-8">
        <OutcomeReportForm prefill={prefill} />
      </div>
    </Shell>
  );
}
