/**
 * POST /api/outcomes/report — client-reported outcome for a prediction.
 *
 * Auth: the signed-in owner of the prediction (predictions.user_id), the
 * admin key / admin email (lib/admin-auth), or a signed link token
 * (lib/outcomes/report-token — `?token=` or body.token) issued by the brief
 * follow-up email; a valid token for this prediction counts as the owner.
 * Body is zod-validated; money in $M.
 * Writes an `outcomes` row with matched_by = 'client', status = 'accepted',
 * fills actuals from the linked deal when `deal_id` is given and the body
 * leaves them blank, computes the derived metrics, and marks the prediction
 * resolved. A second report on the same prediction supersedes the first
 * (earlier client rows are rejected, not deleted).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { captureApiError } from '@/lib/sentry-api';
import { computeOutcomeMetrics, dealToActuals } from '@/lib/outcomes/matcher';
import { applyDealQualityFilter } from '@/lib/outcomes/resolver';
import { verifyOutcomeReportToken } from '@/lib/outcomes/report-token';
import { DEAL_CANDIDATE_COLUMNS, type CompanyAlias, type DealCandidateRow, type OutcomeActuals, type OutcomeInsert, type PredictionForMatch } from '@/lib/outcomes/types';

export const dynamic = 'force-dynamic';

const money = z.number().finite().min(0).max(1_000_000).nullable().optional();
const pct = z.number().finite().min(0).max(100).nullable().optional();

const bodySchema = z.object({
  prediction_id: z.string().uuid(),
  deal_id: z.string().uuid().nullable().optional(),
  licensee_name: z.string().trim().max(200).nullable().optional(),
  signed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'signed_date must be YYYY-MM-DD').nullable().optional(),
  deal_type: z.string().trim().max(50).nullable().optional(),
  upfront_m: money,
  total_m: money,
  royalty_low: pct,
  royalty_high: pct,
  first_offer_upfront_m: money,
  first_offer_total_m: money,
  our_ask_upfront_m: money,
  our_ask_total_m: money,
  notes: z.string().trim().max(2000).nullable().optional(),
  /** Signed link token (alternative to owner auth); also accepted as ?token=. */
  token: z.string().max(512).optional(),
}).strict();

export type OutcomeReportBody = z.infer<typeof bodySchema>;

const PREDICTION_COLUMNS = 'id,user_id,status,company_id,asset_id,licensor_name,asset_name,indication,therapeutic_area,phase,resolve_after,upfront_low,upfront_mid,upfront_high,total_low,total_mid,total_high,predicted_buyers,predicted_window_start,predicted_window_end';

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;

  try {
    const supabase = createServiceClient();
    const { data: predData, error: predErr } = await supabase
      .from('predictions')
      .select(PREDICTION_COLUMNS)
      .eq('id', body.prediction_id)
      .maybeSingle();
    if (predErr) throw new Error(predErr.message);
    const prediction = predData as unknown as (PredictionForMatch & { user_id: string | null; status: string }) | null;
    if (!prediction) return NextResponse.json({ error: 'prediction not found' }, { status: 404 });

    // Signed link token, owner, or admin.
    const token = request.nextUrl.searchParams.get('token') ?? body.token ?? null;
    const verified = token ? verifyOutcomeReportToken(token) : null;
    const isTokenOwner = !!verified && verified.ok && verified.payload.predictionId === prediction.id;
    if (token && !isTokenOwner) {
      const reason = verified && !verified.ok ? verified.reason : 'mismatch';
      console.warn(`[Outcomes] report token rejected for prediction ${prediction.id}: ${reason}`);
      return NextResponse.json({ error: reason === 'expired' ? 'This link has expired' : 'Unauthorized' }, { status: 401 });
    }
    const user = isTokenOwner ? null : await getAuthenticatedUser(request);
    const isOwner = isTokenOwner || (!!user && !!prediction.user_id && user.id === prediction.user_id);
    const isAdmin = !isOwner && (await verifyAdminAuth(request)) === null;
    if (!isOwner && !isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const reviewedBy = isAdmin ? (user?.email ?? 'admin') : (user?.email ?? 'client');

    // Optional linked deal: fills any actual the client left blank.
    let deal: DealCandidateRow | null = null;
    if (body.deal_id) {
      const { data: dealData, error: dealErr } = await applyDealQualityFilter(
        supabase.from('deals').select(DEAL_CANDIDATE_COLUMNS),
      ).eq('id', body.deal_id).maybeSingle();
      if (dealErr) throw new Error(dealErr.message);
      deal = (dealData as unknown as DealCandidateRow | null) ?? null;
      if (!deal) return NextResponse.json({ error: 'deal not found or not a quality row' }, { status: 404 });
    }
    const fromDeal = deal ? dealToActuals(deal) : null;
    const pick = <K extends keyof OutcomeActuals>(k: K, v: OutcomeActuals[K] | undefined): OutcomeActuals[K] =>
      (v !== undefined && v !== null ? v : (fromDeal?.[k] ?? null)) as OutcomeActuals[K];

    const actuals: OutcomeActuals = {
      upfront_m: pick('upfront_m', body.upfront_m),
      total_m: pick('total_m', body.total_m),
      royalty_low: pick('royalty_low', body.royalty_low),
      royalty_high: pick('royalty_high', body.royalty_high),
      licensee_name: pick('licensee_name', body.licensee_name),
      licensee_id: fromDeal?.licensee_id ?? null,
      signed_date: pick('signed_date', body.signed_date),
      deal_type: pick('deal_type', body.deal_type),
      first_offer_upfront_m: body.first_offer_upfront_m ?? null,
      first_offer_total_m: body.first_offer_total_m ?? null,
      our_ask_upfront_m: body.our_ask_upfront_m ?? null,
      our_ask_total_m: body.our_ask_total_m ?? null,
    };

    // Aliases for the buyer-hit check (licensee + predicted buyers).
    const names = [actuals.licensee_name, ...(prediction.predicted_buyers ?? [])].filter((n): n is string => !!n);
    let companies: CompanyAlias[] = [];
    if (names.length) {
      const orValue = (s: string) => `"${s.replace(/[",()]/g, ' ').trim()}"`;
      const filters = names.flatMap((n) => [`name.ilike.${orValue(n)}`, `name_variations.cs.{${orValue(n)}}`]);
      const { data } = await supabase.from('companies').select('id,name,name_variations').or(filters.join(',')).limit(50);
      companies = (data ?? []) as CompanyAlias[];
    }
    const metrics = computeOutcomeMetrics(prediction, actuals, companies);
    const now = new Date().toISOString();

    const row: OutcomeInsert = {
      prediction_id: prediction.id,
      deal_id: deal?.id ?? null,
      matched_by: 'client',
      status: 'accepted',
      match_confidence: deal ? 1 : null,
      match_evidence: { reported_by: isTokenOwner ? 'link' : isOwner ? 'owner' : 'admin', deal_linked: !!deal },
      ...actuals,
      first_offer_upfront_m: actuals.first_offer_upfront_m ?? null,
      first_offer_total_m: actuals.first_offer_total_m ?? null,
      our_ask_upfront_m: actuals.our_ask_upfront_m ?? null,
      our_ask_total_m: actuals.our_ask_total_m ?? null,
      ...metrics,
      resolved_at: now,
      reviewed_by: reviewedBy,
      notes: body.notes ?? null,
    };

    // Supersede earlier client rows / pending candidates on this prediction.
    await supabase.from('outcomes').update({ status: 'rejected', reviewed_by: reviewedBy }).eq('prediction_id', prediction.id).in('status', ['pending', 'accepted']).eq('matched_by', 'client');
    await supabase.from('outcomes').update({ status: 'rejected', reviewed_by: reviewedBy }).eq('prediction_id', prediction.id).eq('status', 'pending');

    let insert = await supabase.from('outcomes').insert(row).select('id').single();
    if (insert.error && deal && /uq_outcomes_prediction_deal|duplicate/i.test(insert.error.message)) {
      // An auto row for the same (prediction, deal) exists: overwrite it with the client report.
      insert = await supabase.from('outcomes').update({ ...row }).eq('prediction_id', prediction.id).eq('deal_id', deal.id).select('id').single();
    }
    if (insert.error || !insert.data) throw new Error(insert.error?.message ?? 'insert failed');

    await supabase.from('predictions').update({ status: 'resolved', updated_at: now }).eq('id', prediction.id);

    const outcomeId = (insert.data as { id: string }).id;
    console.log(`[Outcomes] client report ${outcomeId} for prediction ${prediction.id} (deal=${deal?.id ?? '-'}, by=${reviewedBy})`);
    return NextResponse.json({ success: true, outcome_id: outcomeId, metrics });
  } catch (error) {
    captureApiError(error, 'outcomes-report');
    return NextResponse.json({ error: 'Failed to record outcome' }, { status: 500 });
  }
}
