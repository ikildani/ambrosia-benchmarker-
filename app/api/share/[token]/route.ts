import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET - Get shared calculation by token
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const supabase = createServiceClient();
    const { token } = params;

    if (!token) {
      return NextResponse.json(
        { error: 'Token required' },
        { status: 400 }
      );
    }

    // Fetch shared calculation
    const { data: shared, error } = await supabase
      .from('shared_calculations')
      .select('*')
      .eq('share_token', token)
      .eq('is_public', true)
      .single();

    if (error || !shared) {
      return NextResponse.json(
        { error: 'Shared calculation not found or expired' },
        { status: 404 }
      );
    }

    // Check expiration
    if (shared.expires_at && new Date(shared.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This shared link has expired' },
        { status: 410 }
      );
    }

    // Increment view count
    await supabase.rpc('increment_share_views', { p_token: token });

    return NextResponse.json({
      inputs: shared.inputs,
      results: shared.results,
      labels: shared.labels,
      viewCount: (shared.view_count || 0) + 1,
      createdAt: shared.created_at,
      expiresAt: shared.expires_at,
    });
  } catch (error) {
    console.error('Get share error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
