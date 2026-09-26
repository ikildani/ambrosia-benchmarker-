import { NextRequest, NextResponse, after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/client';
import { BENCHMARK_PRICING } from '@/lib/config/constants';
import { intakeBodySchema, clientIntakeToColumns, dataPackageToDiligence, DATA_PACKAGE_ITEMS, bestPriorOffer, STRUCTURE_PREF_KEYS } from '@/lib/brief/client-intake';

/**
 * Deal Intelligence Brief intake.
 *
 * Accepts the /intake form (also embedded on /benchmark): the asset, the
 * client's own model, runway, offers on the table, buyers to target or avoid,
 * the data package, and billing details for the manual invoice. Creates the
 * benchmark_requests row with payment pending and invoice requested, then
 * notifies the admin and confirms to the client. No payment is taken here;
 * the invoice is sent by hand within one business day.
 */

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const esc = (s: string | null | undefined) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const m = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? `$${v >= 1000 ? `${(v / 1000).toFixed(2)}B` : `${Math.round(v)}M`}` : '—');

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = intakeBodySchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 5).map(i => `${i.path.join('.') || 'body'}: ${i.message}`);
    return NextResponse.json({ error: 'Invalid intake', issues }, { status: 400 });
  }
  const body = parsed.data;
  const client = body.client;
  const diligence = dataPackageToDiligence(client.dataPackage);
  const now = new Date().toISOString();

  try {
    const supabase = createServiceClient();
    const { data: record, error: insertErr } = await supabase
      .from('benchmark_requests')
      .insert({
        name: body.name,
        email: body.email,
        company: body.company || null,
        title: body.title || null,
        therapeutic_area: body.therapeuticArea,
        indication: body.indication,
        phase: body.phase,
        modalities: [body.modality],
        deal_types: body.targetDealType ? [body.targetDealType] : [],
        analyses: [],
        territory: body.territory || 'global',
        custom_notes: null,
        white_label: false,
        brand_name: null,
        status: 'intake',
        source: 'website',
        brief_version: 'v3',
        // asset (migration 119)
        modality: body.modality,
        asset_name: body.assetName || null,
        mechanism: body.mechanism || null,
        target: body.target || null,
        target_deal_type: body.targetDealType || null,
        data_package_stage: body.dataPackageStage || null,
        differentiation_notes: body.differentiationNotes || null,
        diligence_ready: diligence.ready,
        diligence_gaps: diligence.gaps,
        // the client's data + invoice (migration 135)
        ...clientIntakeToColumns(client),
        billing_entity: body.billingEntity || body.company || null,
        billing_address: body.billingAddress || null,
        billing_email: body.billingEmail || body.email,
        po_number: body.poNumber || null,
        payment_status: 'pending',
        invoice_requested_at: now,
        intake_path: body.intakePath,
        // Migration 137
        structure_prefs: body.structurePrefs ?? {},
        auto_draft_requested_at: now,
        auto_draft_status: 'requested',
        admin_notes: body.ref ? `ref ${body.ref}` : null,
      })
      .select('id')
      .single();

    if (insertErr) throw insertErr;
    const requestId = (record as { id: string }).id;
    const first = body.name.split(' ')[0];
    const assetLabel = body.assetName ? `${body.assetName} (${body.indication}, ${body.phase})` : `${body.indication} (${body.phase})`;
    const offer = bestPriorOffer(client.priorOffers);
    const packageTicked = DATA_PACKAGE_ITEMS.filter(i => client.dataPackage[i.key] === true).map(i => i.label);

    // Admin notification: everything the intake call and the invoice need.
    try {
      const rows: Array<[string, string]> = [
        ['Request', requestId],
        ['Contact', `${body.name}${body.title ? `, ${body.title}` : ''} — ${body.company ?? '—'} — ${body.email}`],
        ['Asset', `${assetLabel} · ${body.therapeuticArea} · ${body.modality}${body.mechanism ? ` · ${body.mechanism}` : ''}${body.target ? ` · ${body.target}` : ''}`],
        ['Structure sought', `${body.targetDealType ?? '—'} · ${body.territory ?? 'global'}`],
        ['Data package stage', body.dataPackageStage ?? '—'],
        ['Package in hand', packageTicked.length ? packageTicked.join('; ') : 'nothing ticked'],
        ['Client model', client.model ? `peak ${m(client.model.peakSalesM)} · PoS ${client.model.posToApprovalPct ?? '—'}% · launch ${client.model.launchYear ?? '—'} · cost to approval ${m(client.model.devCostToApprovalM)} · expects ${m(client.model.expectedUpfrontM)} up / ${m(client.model.expectedTotalM)} total` : 'not supplied'],
        ['Runway', client.financing ? `cash ${m(client.financing.cashOnHandM)} · ${client.financing.runwayMonths ?? '—'} months · next raise ${m(client.financing.nextRaiseM)} ${client.financing.nextRaiseDate ?? ''}` : 'not supplied'],
        ['Offers on the table', client.priorOffers.length ? client.priorOffers.map(o => `${o.party}: ${m(o.upfrontM)} up / ${m(o.totalM)} total (${o.status}${o.structure ? `, ${o.structure}` : ''})`).join('; ') : `none${client.termSheetsReceived ? ` (${client.termSheetsReceived} term sheets received)` : ''}`],
        ['Target buyers', client.targetBuyers.join(', ') || '—'],
        ['Excluded buyers', client.excludedBuyers.join(', ') || '—'],
        ['Upstream licences', client.upstreamLicenses ?? '—'],
        ['IP notes', client.ipNotes ?? '—'],
        ['Differentiation', body.differentiationNotes ?? '—'],
        ['Structure answers', Object.entries(body.structurePrefs ?? {}).map(([k, v]) => `${STRUCTURE_PREF_KEYS[k] ?? k}: ${String(v)}`).join('; ') || '—'],
        ['Invoice to', `${body.billingEntity || body.company || body.name} · ${body.billingEmail || body.email}${body.poNumber ? ` · PO ${body.poNumber}` : ''}${body.billingAddress ? ` · ${body.billingAddress}` : ''}`],
        ['Path', `${body.intakePath}${body.ref ? ` (ref ${body.ref})` : ''}`],
      ];
      await sendEmail({
        to: 'ikildani@ambrosiaventures.co',
        subject: `Brief intake: ${assetLabel} — ${body.company ?? body.name} — invoice ${BENCHMARK_PRICING.PRICE}`,
        html: `<div style="font-family: -apple-system, sans-serif; max-width: 720px; color: #1e293b; font-size: 14px;">
          <p><strong>New Deal Intelligence Brief intake.</strong> Send the invoice for ${BENCHMARK_PRICING.PRICE} within one business day, then schedule the 15-minute call.</p>
          <table style="border-collapse: collapse; width: 100%;">${rows.map(([k, v]) => `<tr><td style="padding: 4px 8px; color: #64748b; vertical-align: top; white-space: nowrap;">${esc(k)}</td><td style="padding: 4px 8px;">${esc(v)}</td></tr>`).join('')}</table>
          ${offer ? `<p style="color: #b45309;"><strong>An offer is already on the table</strong> from ${esc(offer.party)} at ${m(offer.upfrontM)} upfront / ${m(offer.totalM)} total. The brief prints it against the floor and the ask.</p>` : ''}
        </div>`,
        replyTo: body.email,
      });
    } catch (adminErr) {
      console.error('[Benchmark] Admin notification failed:', adminErr);
    }

    // Slack
    try {
      const webhook = process.env.SLACK_WEBHOOK_URL;
      if (webhook) {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `Brief intake: ${assetLabel} — ${body.company ?? body.name} (${body.email}). ${client.model ? 'Client model supplied. ' : ''}${offer ? `Offer on the table: ${offer.party} ${m(offer.totalM)}. ` : ''}Invoice ${BENCHMARK_PRICING.PRICE} to send.` }),
        });
      }
    } catch (slackErr) {
      console.error('[Benchmark] Slack notification failed:', slackErr);
    }

    // Confirmation to the client
    try {
      await sendEmail({
        to: body.email,
        subject: `Your Deal Intelligence Brief — ${assetLabel}`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 600px; color: #1e293b; line-height: 1.6;">
            <p>Hi ${esc(first)},</p>
            <p>Thank you. Your intake for <strong>${esc(assetLabel)}</strong> is in. What happens next:</p>
            <ol style="line-height: 1.8;">
              <li><strong>Invoice</strong> — an invoice for ${BENCHMARK_PRICING.PRICE} follows within one business day${body.billingEntity ? ` to ${esc(body.billingEntity)}` : ''}. The fee is credited in full against a subsequent advisory mandate.</li>
              <li><strong>Intake call</strong> — a 15-minute call on receipt, to confirm the asset, the structure you are preparing for and the counterparties you want in or out.</li>
              <li><strong>Build</strong> — the brief is built within 24 hours of the call: one asset, one signed recommendation, about 30 data-backed pages.</li>
              <li><strong>Delivery</strong> — a private data room with the PDF and the Excel behind every figure, followed by a 30-minute walkthrough arranged by reply.</li>
            </ol>
            <p>What the brief commits to:</p>
            <ul style="line-height: 1.8; color: #475569;">
              <li>The recommendation on page three: the ask, the floor, the walk-away, and who to open with. It is registered in our outcome ledger and scored against what actually happens; you see the score in your data room.</li>
              <li>A valuation bridge reconciling cited comparables, the calibrated range and risk-adjusted value to one ask${client.model ? ', and a page setting your own model against ours line by line' : ''}.</li>
              <li>An indicative term sheet you can carry into the room, built from the levers in the decision.</li>
              <li>Buyers ranked on fit, urgency and what each has paid at your stage${client.targetBuyers.length ? `, with ${esc(client.targetBuyers.slice(0, 3).join(', '))} assessed on the same terms` : ''}, with a 24-month catalyst calendar.</li>
              <li>Positioning, the objections you will hear with the evidence to answer them, and diligence readiness from the package you described.</li>
            </ul>
            ${client.model ? '' : `<p style="color: #475569;">You left the "your model" section blank. If you send your peak-sales, probability and timing assumptions before the call, the brief adds a page comparing them to ours.</p>`}
            <p>Reply to this email with anything you want on the call.</p>
            <p style="margin-top: 24px;">Best,<br><strong>Issa Kildani</strong><br>Ambrosia Ventures<br>solidus.ambrosiaventures.co</p>
          </div>
        `,
        replyTo: 'ikildani@ambrosiaventures.co',
      });
    } catch (autoReplyErr) {
      console.error('[Benchmark] Auto-reply failed:', autoReplyErr);
    }

    // Automatic draft: ask the generate route to build the brief now, so the intake call
    // reviews a real draft. Without an MP opinion the generate route stores a draft
    // (status call_complete) and sends nothing to the client. The call is fired after the
    // response; the generate invocation carries on server-side once it has been received.
    after(async () => {
      const secret = process.env.CRON_SECRET;
      const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://solidus.ambrosiaventures.co';
      if (!secret) return;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      try {
        await fetch(`${base}/api/benchmark/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
          body: JSON.stringify({ requestId }),
          signal: controller.signal,
        });
      } catch (e) {
        // An abort here is expected: the draft keeps building on the receiving side.
        if (!(e instanceof Error && e.name === 'AbortError')) {
          console.error('[Benchmark] auto-draft request failed:', e instanceof Error ? e.message : e);
          await supabase.from('benchmark_requests').update({ auto_draft_status: 'failed' }).eq('id', requestId);
        }
      } finally {
        clearTimeout(timer);
      }
    });

    return NextResponse.json({ success: true, requestId });
  } catch (err) {
    console.error('[Benchmark] Intake failed:', err);
    return NextResponse.json({ error: 'Failed to submit intake' }, { status: 500 });
  }
}
