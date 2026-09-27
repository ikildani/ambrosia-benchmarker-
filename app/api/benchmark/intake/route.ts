import { NextRequest, NextResponse, after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/client';
import { BENCHMARK_PRICING } from '@/lib/config/constants';
import { intakeBodySchema, clientIntakeToColumns, dataPackageToDiligence, DATA_PACKAGE_ITEMS, bestPriorOffer, STRUCTURE_PREF_KEYS } from '@/lib/brief/client-intake';
import { envelope, stepper, factsTable, callout, signature, p, esc } from '@/lib/email/brief-template';
import { computeReadiness, type Readiness } from '@/lib/brief/readiness';

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

    // Data readiness for this profile: stored on the row, printed for the
    // operator, and a top-up queued when the indication is thin. Never blocks
    // the intake; a failure here is logged and the card reads "not computed".
    let readiness: Readiness | null = null;
    try {
      readiness = await computeReadiness(supabase, { therapeuticArea: body.therapeuticArea, indication: body.indication, phase: body.phase });
      await supabase.from('benchmark_requests').update({ readiness, readiness_checked_at: now }).eq('id', requestId);
      if (readiness.topUpRecommended) {
        await supabase.from('brief_topups').insert({
          request_id: requestId, therapeutic_area: readiness.profile.therapeuticArea, indication: body.indication, indication_key: readiness.profile.indicationKey,
          phase: body.phase, mechanism: body.mechanism || null, target: body.target || null, readiness_before: readiness,
        });
      }
    } catch (readyErr) {
      console.error('[Benchmark] readiness failed:', readyErr instanceof Error ? readyErr.message : readyErr);
    }
    const tone = (s: string) => (s === 'green' ? '#0f766e' : s === 'amber' ? '#d97706' : '#e11d48');
    const readinessHtml = readiness
      ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%; border-collapse:collapse; margin: 6px 0 14px; font-size:13px;">
          ${readiness.lines.map(l => `<tr>
            <td style="padding: 6px 8px 6px 0; width: 12px; vertical-align: top;"><span style="display:inline-block; width:9px; height:9px; border-radius:5px; background:${tone(l.status)};"></span></td>
            <td style="padding: 6px 10px 6px 0; color:#0b1220; vertical-align: top; white-space: nowrap;">${esc(l.label)}</td>
            <td style="padding: 6px 10px 6px 0; color:#0b1220; vertical-align: top; font-weight:600;">${esc(l.value)}</td>
            <td style="padding: 6px 0; color:#64748b; vertical-align: top;">${esc(l.detail)}</td>
          </tr>`).join('')}
        </table>
        ${readiness.topUpRecommended ? callout(`<strong>Top-up queued.</strong> An indication-scoped ingestion run for ${esc(body.indication)} starts on the next discovery cycle (within 4 hours) and the card is recomputed. Rebuild the draft from /admin/briefs before the call.`, 'amber') : ''}`
      : p('Readiness card not computed (see logs).', { muted: true });

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
      const adminBody = `
        ${p(`New Deal Intelligence Brief intake from <strong>${esc(body.name)}</strong>${body.company ? ` at <strong>${esc(body.company)}</strong>` : ''}. A draft is building now; it lands as <em>call_complete</em> in <a href="https://solidus.ambrosiaventures.co/admin/briefs" style="color:#0f766e;">/admin/briefs</a> when done.`)}
        ${stepper([
          { title: 'Draft', body: 'Building automatically from the intake. Review it before the call; if it fails, rebuild from /admin/briefs.', now: true },
          { title: 'Invoice', body: `Send ${BENCHMARK_PRICING.PRICE} within one business day to ${esc(body.billingEntity || body.company || body.name)} (${esc(body.billingEmail || body.email)}${body.poNumber ? `, PO ${esc(body.poNumber)}` : ''}).` },
          { title: 'Call', body: 'Fifteen minutes on receipt, with the draft open. Confirm asset, structure, counterparties in and out.' },
          { title: 'Deliver', body: 'Set mp_opinion, mp_reviewer, mp_reviewed_at and re-run generate. That uploads the final PDF and Excel and emails the data-room link.' },
        ])}
        ${offer ? callout(`<strong>An offer is already on the table</strong> from ${esc(offer.party)} at ${m(offer.upfrontM)} upfront / ${m(offer.totalM)} total. The brief prints it against the floor and the ask.`, 'amber') : ''}
        <div style="margin: 18px 0 4px; font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:#64748b;">Data readiness · ${readiness ? esc(readiness.overall) : 'n/a'}</div>
        ${readinessHtml}
        ${factsTable(rows.map(([k, v]) => [k, esc(v)] as [string, string]))}`;
      await sendEmail({
        to: 'ikildani@ambrosiaventures.co',
        subject: `Brief intake: ${assetLabel} — ${body.company ?? body.name} — invoice ${BENCHMARK_PRICING.PRICE}`,
        html: envelope({ eyebrow: 'Deal Intelligence Brief · new intake', headline: assetLabel, sub: `${body.therapeuticArea} · ${body.phase} · ${body.modality} · ${body.targetDealType ?? 'Licensing'} · ${body.territory ?? 'global'}`, body: adminBody, preheader: `Intake from ${body.name}${body.company ? `, ${body.company}` : ''}. Draft building; invoice to send.` }),
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
      const named = client.targetBuyers.slice(0, 3).map(esc).join(', ');
      const clientBody = `
        ${p(`Hi ${esc(first)},`)}
        ${p(`Thank you. Your intake for <strong>${esc(assetLabel)}</strong> is in, and a first draft of the brief has started building from what you entered. Nothing is sent from that draft; it is what we review together on the call.`)}
        ${stepper([
          { title: 'Intake', body: 'Received. Reply to this email with anything you want added before the call.', done: true },
          { title: 'Draft', body: 'Built now from your intake: the comparable set, the valuation bridge, the buyer map and a first version of the decision. Held for review.', now: true },
          { title: 'Invoice', body: `${BENCHMARK_PRICING.PRICE}, sent within one business day${body.billingEntity ? ` to ${esc(body.billingEntity)}` : ''}. No card, no checkout. Credited in full against a subsequent advisory mandate.` },
          { title: 'Intake call', body: 'Fifteen minutes on receipt of the invoice, with the draft in front of us: the asset, the structure you are preparing for, the counterparties you want in or out, and anything the draft got wrong.' },
          { title: 'Brief', body: 'Within 24 hours of the call, reviewed and signed by the Managing Partner, delivered to a private data room with the PDF and the Excel behind every figure.' },
          { title: 'Walkthrough and scoring', body: 'A 30-minute walkthrough arranged by reply. The call is then registered in the Solidus outcome ledger and scored against what happens; you see the status in your data room and hear from us at day 45 and day 120.' },
        ])}
        ${p(`<strong>What the brief commits to.</strong> The recommendation on page three: the ask, the floor, the walk-away, and who to open with. A valuation bridge reconciling cited comparables, the calibrated range and risk-adjusted value to one ask${client.model ? ', and a page setting your own model against ours line by line' : ''}. An indicative term sheet built from the levers in the decision${Object.keys(body.structurePrefs ?? {}).length ? ' and the structure answers you gave' : ''}. Buyers ranked on fit, urgency and what each has paid at your stage${named ? `, with ${named} assessed on the same terms` : ''}, with a 24-month catalyst calendar. Positioning, the objections you will hear with the evidence to answer them, and diligence readiness from the package you described.`)}
        ${client.model ? '' : callout(`You left the "your model" section blank. Send your peak-sales, probability and timing assumptions before the call and the brief adds a page comparing them to ours, line by line.`)}
        ${signature()}`;
      await sendEmail({
        to: body.email,
        subject: `Your Deal Intelligence Brief — ${assetLabel}`,
        html: envelope({ eyebrow: 'Deal Intelligence Brief · intake received', headline: `${assetLabel}: the draft is building`, sub: `${body.indication} · ${body.phase} · ${body.targetDealType ?? 'Licensing'}`, body: clientBody, preheader: `Your intake is in and a draft is building. Invoice within one business day, then a 15-minute call with the draft open.` }),
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
