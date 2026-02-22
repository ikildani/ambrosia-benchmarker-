import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { nanoid } from 'nanoid';
import { captureApiError } from '@/lib/sentry-api';

export const dynamic = 'force-dynamic';

// POST - Create a share link
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const { email, inputs, results, labels, tier, expiresIn } = body;

    if (!inputs || !results) {
      return NextResponse.json(
        { error: 'Inputs and results are required' },
        { status: 400 }
      );
    }

    // Verify Pro tier
    let userTier: 'free' | 'pro' | 'report' = 'free';

    if (email) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, tier')
        .eq('email', email)
        .single();

      userTier = (profile?.tier as 'free' | 'pro' | 'report') || 'free';
    }

    // SECURITY: Only trust database-verified tier, never client-provided tier
    if (userTier !== 'pro' && userTier !== 'report') {
      return NextResponse.json(
        { error: 'Pro subscription required to share calculations' },
        { status: 403 }
      );
    }

    // Generate unique share token
    const shareToken = nanoid(12);

    // Calculate expiration if specified
    let expiresAt: string | null = null;
    if (expiresIn) {
      const expDate = new Date();
      if (expiresIn === '7d') expDate.setDate(expDate.getDate() + 7);
      else if (expiresIn === '30d') expDate.setDate(expDate.getDate() + 30);
      else if (expiresIn === '90d') expDate.setDate(expDate.getDate() + 90);
      expiresAt = expDate.toISOString();
    }

    // Get user_id if available
    let userId: string | null = null;
    if (email) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', email)
        .single();
      userId = profile?.id || null;
    }

    // Create shared calculation
    const { data: shared, error } = await supabase
      .from('shared_calculations')
      .insert({
        share_token: shareToken,
        user_id: userId,
        email,
        inputs,
        results,
        labels: labels || {},
        is_public: true,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating share:', error);
      return NextResponse.json(
        { error: 'Failed to create share link' },
        { status: 500 }
      );
    }

    const shareUrl = `https://calculator.ambrosiaventures.co/share/${shareToken}`;

    return NextResponse.json({
      shareToken,
      shareUrl,
      expiresAt,
    });
  } catch (error) {
    captureApiError(error, 'share-post');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
