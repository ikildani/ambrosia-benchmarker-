import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const raw = typeof body?.email === 'string' ? body.email : '';
    const email = raw.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('newsletter_subscribers')
      .upsert(
        { email, source: 'intelligence_digest', status: 'active', unsubscribed_at: null },
        { onConflict: 'email' },
      );
    if (error) {
      console.error('intelligence subscribe error', error);
      return NextResponse.json({ error: 'Subscription failed' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('intelligence subscribe exception', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
