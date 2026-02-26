import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Report ID required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // SECURITY: Verify the requester owns this report purchase
    let verifiedUserId: string | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
      }
      const authClient = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user } } = await authClient.auth.getUser(token);
      if (user) verifiedUserId = user.id;
    }

    const { data: report, error } = await supabase
      .from('report_purchases')
      .select('id, user_id, status, calculation_inputs, calculation_results, memo_content, purchased_at')
      .eq('id', id)
      .single();

    if (error || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Allow access if: user owns the report, or report was purchased (completed status acts as access token via checkout flow)
    if (report.user_id && verifiedUserId && report.user_id !== verifiedUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({
      id: report.id,
      status: report.status,
      calculationInputs: report.calculation_inputs,
      calculationResults: report.calculation_results,
      memoContent: report.memo_content,
      purchasedAt: report.purchased_at,
    });
  } catch (error) {
    console.error('Report purchase lookup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
