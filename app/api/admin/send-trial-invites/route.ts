import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { signTrialToken } from '@/lib/trial-token';
import { sendEmail } from '@/lib/email/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// One-off: email-trial winback to dormant free signups (May 2026).
// Auth: Bearer $ADMIN_API_KEY. Body: { "dryRun": true } to preview without sending.

type Segment = 'operator' | 'investor' | 'neutral';

const RECIPIENTS: { email: string; segment: Segment }[] = [
  { email: 'eric.heil@medexcelcap.com', segment: 'investor' },
  { email: 'jessica@akasipharma.com', segment: 'operator' },
  { email: 'dbronnikov@4dmt.com', segment: 'operator' },
  { email: 'dkok@landmarkbioventures.com', segment: 'investor' },
  { email: 'helenmccormack38@gmail.com', segment: 'neutral' },
  { email: 'ryanjamespeabody@gmail.com', segment: 'neutral' },
  { email: 'ronbhagia@gmail.com', segment: 'neutral' },
  { email: 'noor.hammad@tabukpharmaceuticals.com', segment: 'operator' },
  // testallfreemx@gmail.com intentionally excluded (test account)
  { email: 'oriz@ziptx.bio', segment: 'operator' },
  { email: 'drschafes@aol.com', segment: 'neutral' },
  { email: 'davidlagares@gmail.com', segment: 'neutral' },
  { email: 'helen@voitheiabioscience.com', segment: 'operator' },
  { email: 'joancjcheng@gmail.com', segment: 'neutral' },
  { email: 'harish.kumar7@ey.com', segment: 'investor' },
];

function subjectFor(seg: Segment): string {
  if (seg === 'operator') return "The deal benchmark you didn't pull yet";
  if (seg === 'investor') return "The deal benchmarks you haven't run yet";
  return 'Your Ambrosia account is still on free';
}

function bodyFor(seg: Segment, activateUrl: string): string {
  const btn = `<div style="margin:28px 0;"><a href="${activateUrl}" style="background:#0d9488;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block;">Start my free week &rarr;</a></div>`;

  if (seg === 'neutral') {
    // Sample B — tight. Dormant users don't read walls. Hook, stakes,
    // what they get in one line, frictionless offer, button.
    return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.6;color:#1e293b;max-width:560px;">
<p>You signed up for Ambrosia a few weeks back and never ran a benchmark &mdash; the part worth your time is the part you haven't seen.</p>
<p>Walking into a licensing or M&amp;A conversation, the gap between your number and what comparable deals actually closed at is routinely 30&ndash;50%. It cuts against whoever did less homework.</p>
<p>Ten minutes on full access shows you the deal structure for your exact asset (upfront, milestones, royalties), the real comparable transactions with their terms, which companies would realistically buy it and at what price, and a board-ready write-up.</p>
<p>I've turned on <strong>7 days of full Pro &mdash; no card, nothing charged.</strong> It starts when you click, so it doesn't burn sitting in your inbox:</p>
${btn}
<p>&mdash; Issa, Ambrosia Ventures</p>
</div>`;
  }

  // Operator / investor — same tight shape as neutral, segment-specific stakes line.
  const stakes =
    seg === 'operator'
      ? `Sizing a partnering or licensing conversation for one of your programs, the gap between what you'd ask and what comparable deals actually closed at is usually 30&ndash;50%. It cuts against whoever did less homework.`
      : `Pressure-testing a deal &mdash; a portfolio company, a diligence, a thesis &mdash; the gap between the headline number and what comparable transactions actually closed at is usually 30&ndash;50%. It cuts against whoever did less homework.`;

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.6;color:#1e293b;max-width:560px;">
<p>You signed up for Ambrosia a few weeks back and never ran a benchmark &mdash; the part worth your time is the part you haven't seen.</p>
<p>${stakes}</p>
<p>Ten minutes on full access shows you the deal structure for your exact asset (upfront, milestones, royalties), the real comparable transactions with their terms, which companies would realistically buy it and at what price, and a board-ready write-up.</p>
<p>I've turned on <strong>7 days of full Pro &mdash; no card, nothing charged.</strong> It starts when you click, so it doesn't burn sitting in your inbox:</p>
${btn}
<p>&mdash; Issa, Ambrosia Ventures</p>
</div>`;
}

export async function POST(request: NextRequest) {
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const dryRun = body.dryRun === true;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://solidus.ambrosiaventures.co';

  const results: { email: string; ok: boolean; detail?: string }[] = [];

  for (const r of RECIPIENTS) {
    const token = signTrialToken(r.email);
    const activateUrl = `${appUrl}/api/trial/activate?token=${encodeURIComponent(token)}`;
    const subject = subjectFor(r.segment);
    const html = bodyFor(r.segment, activateUrl);

    if (dryRun) {
      results.push({ email: r.email, ok: true, detail: `[dry-run] ${subject}` });
      continue;
    }

    const res = await sendEmail({ to: r.email, subject, html });
    results.push({ email: r.email, ok: res.success, detail: res.success ? res.id : res.error });
  }

  return NextResponse.json({
    dryRun,
    sent: results.filter((r) => r.ok && !dryRun).length,
    total: results.length,
    results,
  });
}
