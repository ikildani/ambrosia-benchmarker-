import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/client';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

interface BenchmarkIntakeBody {
  name: string;
  email: string;
  company?: string;
  title?: string;
  therapeuticArea: string;
  indication: string;
  phase: string;
  modalities: string[];
  dealTypes: string[];
  analyses: string[];
  territory?: string;
  customNotes?: string;
  whiteLabel?: boolean;
  brandName?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: BenchmarkIntakeBody = await request.json();

    if (!body.name || !body.email || !body.therapeuticArea || !body.indication || !body.phase) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

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
        modalities: body.modalities || [],
        deal_types: body.dealTypes || [],
        analyses: body.analyses || [],
        territory: body.territory || 'global',
        custom_notes: body.customNotes || null,
        white_label: body.whiteLabel || false,
        brand_name: body.brandName || null,
        status: 'intake',
        source: 'website',
      })
      .select('id')
      .single();

    if (insertErr) throw insertErr;

    const modalityList = body.modalities.join(', ');
    const dealTypeList = body.dealTypes.join(', ');
    const analysisList = body.analyses.join(', ');

    // Notify admin via email
    try {
      await sendEmail({
        to: 'ikildani@ambrosiaventures.co',
        subject: `Deal Intelligence Brief Request — ${body.indication} (${body.phase}) — ${body.company || body.name}`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 600px;">
            <div style="background: #1a1e42; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; font-size: 18px;">New Deal Intelligence Brief Request</h2>
              <p style="margin: 4px 0 0; color: rgba(255,255,255,0.6); font-size: 13px;">ID: ${record.id}</p>
            </div>
            <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
              <h3 style="color: #0d9488; font-size: 14px; margin: 0 0 12px;">Contact</h3>
              <p style="margin: 4px 0;"><strong>${body.name}</strong>${body.title ? ` — ${body.title}` : ''}</p>
              <p style="margin: 4px 0;">${body.email}</p>
              ${body.company ? `<p style="margin: 4px 0;">${body.company}</p>` : ''}

              <h3 style="color: #0d9488; font-size: 14px; margin: 20px 0 12px;">Scope</h3>
              <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                <tr><td style="padding: 4px 0; color: #64748b;">Therapeutic Area</td><td style="padding: 4px 0;"><strong>${body.therapeuticArea}</strong></td></tr>
                <tr><td style="padding: 4px 0; color: #64748b;">Indication</td><td style="padding: 4px 0;"><strong>${body.indication}</strong></td></tr>
                <tr><td style="padding: 4px 0; color: #64748b;">Phase</td><td style="padding: 4px 0;"><strong>${body.phase}</strong></td></tr>
                <tr><td style="padding: 4px 0; color: #64748b;">Territory</td><td style="padding: 4px 0;"><strong>${body.territory || 'Global'}</strong></td></tr>
                <tr><td style="padding: 4px 0; color: #64748b;">Modalities</td><td style="padding: 4px 0;">${modalityList} (${body.modalities.length})</td></tr>
                <tr><td style="padding: 4px 0; color: #64748b;">Deal Types</td><td style="padding: 4px 0;">${dealTypeList}</td></tr>
                <tr><td style="padding: 4px 0; color: #64748b;">Analyses</td><td style="padding: 4px 0;">${analysisList}</td></tr>
                <tr><td style="padding: 4px 0; color: #64748b;">White-Label</td><td style="padding: 4px 0;">${body.whiteLabel ? `Yes — ${body.brandName || 'TBD'}` : 'No'}</td></tr>
              </table>

              ${body.customNotes ? `
                <h3 style="color: #0d9488; font-size: 14px; margin: 20px 0 12px;">Custom Notes</h3>
                <p style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 13px; line-height: 1.6;">${body.customNotes}</p>
              ` : ''}
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('[Benchmark] Admin email failed:', emailErr);
    }

    // Notify via Slack
    try {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `New Deal Intelligence Brief Request`,
            attachments: [{
              color: '#0d9488',
              blocks: [
                { type: 'header', text: { type: 'plain_text', text: `Deal Intelligence Brief — ${body.indication} (${body.phase})` } },
                { type: 'section', text: { type: 'mrkdwn', text: `*Contact:* ${body.name}${body.company ? ` (${body.company})` : ''}\n*Email:* ${body.email}\n*Scope:* ${body.therapeuticArea} / ${body.indication} / ${body.phase}\n*Modalities:* ${body.modalities.length} selected\n*White-label:* ${body.whiteLabel ? 'Yes' : 'No'}` } },
                { type: 'context', elements: [{ type: 'mrkdwn', text: `ID: ${record.id} — ${new Date().toISOString()}` }] },
              ],
            }],
          }),
        });
      }
    } catch (slackErr) {
      console.error('[Benchmark] Slack notification failed:', slackErr);
    }

    // Auto-reply to requester
    try {
      await sendEmail({
        to: body.email,
        subject: `Your Deal Intelligence Brief — ${body.indication} (${body.phase})`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 600px; color: #1e293b;">
            <p>Hi ${body.name.split(' ')[0]},</p>
            <p>Thank you for requesting a Deal Intelligence Brief. We've received your intake and here's what happens next:</p>
            <ol style="line-height: 1.8;">
              <li><strong>Intake call</strong> — We'll reach out within 24 hours to schedule a brief 15-minute call to understand your specific angle and any customization needs.</li>
              <li><strong>Generation</strong> — Your Brief will be generated within 24 hours of our call, covering ${body.modalities.length} modalities across ${body.dealTypes.length} deal structures for ${body.indication} (${body.phase}).</li>
              <li><strong>Delivery</strong> — You'll receive a secure data room link with your PDF report, Excel data export, and a link to schedule your complimentary 30-minute walkthrough.</li>
            </ol>
            <p>Your Brief will include:</p>
            <ul style="line-height: 1.8; color: #64748b;">
              <li>${body.modalities.length * body.dealTypes.length} deal term calculations</li>
              <li>AI-written strategic narrative and negotiation playbook</li>
              <li>Comparable transactions from our database of 1,600+ deals</li>
              <li>Partner matching with intent scoring</li>
              <li>Full financial model suite (rNPV, Monte Carlo, scenarios)</li>
              ${body.whiteLabel ? `<li>White-label branding under ${body.brandName || 'your firm name'}</li>` : ''}
            </ul>
            <p>If you have any questions in the meantime, reply directly to this email.</p>
            <p style="margin-top: 24px;">Best,<br><strong>Issa Kildani</strong><br>Ambrosia Ventures<br>solidus.ambrosiaventures.co</p>
          </div>
        `,
        replyTo: 'ikildani@ambrosiaventures.co',
      });
    } catch (autoReplyErr) {
      console.error('[Benchmark] Auto-reply failed:', autoReplyErr);
    }

    return NextResponse.json({
      success: true,
      requestId: record.id,
      message: 'Your Deal Intelligence Brief request has been received. We will reach out within 24 hours to schedule your intake call.',
    });
  } catch (error) {
    console.error('[Benchmark Intake] Error:', error);
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
  }
}
