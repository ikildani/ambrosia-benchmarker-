import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabase = createServiceClient();

    const { count, error } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      supabaseUrl: supabaseUrl?.substring(0, 30) + '...',
      hasServiceKey,
      dealCount: count,
      error: error?.message || null,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

