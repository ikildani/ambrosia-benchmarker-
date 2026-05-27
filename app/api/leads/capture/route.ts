import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/client';
import { buildProGateEmail1, type LeadContext } from '@/lib/email/pro-gate-drip';
import { getProgrammaticPageData, formatCurrency } from '@/lib/seo/programmatic-pages';

function resolveContext(slug: string): LeadContext {
  const pageData = getProgrammaticPageData(slug);
  if (pageData) {
    return {
      ta: pageData.ta.label,
      phase: pageData.phase.label,
      territory: pageData.territory.label,
      upfrontLow: formatCurrency(pageData.upfront.low),
      upfrontMedian: formatCurrency(pageData.upfront.median),
      upfrontHigh: formatCurrency(pageData.upfront.high),
      totalValueMedian: formatCurrency(pageData.totalValue.median),
      royaltyRange: `${pageData.royalty.base}–${pageData.royalty.max}%`,
      page: slug,
    };
  }
  return {
    ta: 'Biopharma', phase: 'Phase 2', territory: 'Global',
    upfrontLow: '$50M', upfrontMedian: '$150M', upfrontHigh: '$350M',
    totalValueMedian: '$800M', royaltyRange: '8–15%', page: slug,
  };
}

export async function POST(request: Request) {
  try {
    const { email, source, page } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const supabase = createServiceClient();

    // Check if this email already exists (don't re-send Email 1 to returning leads)
    const { data: existing } = await supabase
      .from('leads')
      .select('id, drip_1_sent')
      .eq('email', cleanEmail)
      .maybeSingle();

    // Upsert the lead
    await supabase.from('leads').upsert(
      {
        email: cleanEmail,
        source: source || 'pro_gate',
        page: page || null,
        captured_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    );

    // Send Email 1 immediately (don't wait for cron)
    if (!existing?.drip_1_sent) {
      const context = resolveContext(page || '');
      const { subject, html } = buildProGateEmail1(cleanEmail, context);
      const result = await sendEmail({ to: cleanEmail, subject, html });
      if (result.success) {
        await supabase.from('leads')
          .update({ drip_1_sent: true })
          .eq('email', cleanEmail);
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
