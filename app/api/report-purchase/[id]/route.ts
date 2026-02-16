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

    const { data: report, error } = await supabase
      .from('report_purchases')
      .select('id, status, calculation_inputs, calculation_results, memo_content, purchased_at')
      .eq('id', id)
      .single();

    if (error || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
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
