import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { email, source, page } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Upsert to avoid duplicates — update source/page if they hit multiple gates
    await supabase.from('leads').upsert(
      {
        email: email.toLowerCase().trim(),
        source: source || 'pro_gate',
        page: page || null,
        captured_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Don't expose errors
  }
}
