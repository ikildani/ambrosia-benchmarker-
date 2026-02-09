import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const startTime = Date.now();

export async function GET() {
  const checks: Record<string, string> = {};
  let healthy = true;

  // Check Supabase connectivity
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('calculations').select('id', { count: 'exact', head: true }).limit(1);
    checks.supabase = error ? 'error' : 'ok';
    if (error) healthy = false;
  } catch {
    checks.supabase = 'error';
    healthy = false;
  }

  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      checks: {
        ...checks,
        uptime: `${uptimeSeconds}s`,
      },
    },
    { status: healthy ? 200 : 503 }
  );
}
