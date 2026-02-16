import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';

const MAX_WATCHLIST_ITEMS = 25;

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    // Verify user is Pro
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', userId)
      .single();

    if (profile?.tier !== 'pro') {
      return NextResponse.json({ error: 'Pro subscription required' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('watchlist_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Watchlist fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch watchlist' }, { status: 500 });
    }

    return NextResponse.json({ items: data || [] });
  } catch (error) {
    console.error('Watchlist API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'calculations', RATE_LIMIT_CONFIGS.calculations);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const { user_id, item_type, item_value, company_id } = body;

    if (!user_id || !item_type || !item_value) {
      return NextResponse.json({ error: 'user_id, item_type, and item_value are required' }, { status: 400 });
    }

    const validTypes = ['modality', 'indication', 'company', 'therapeutic_area'];
    if (!validTypes.includes(item_type)) {
      return NextResponse.json({ error: `item_type must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    // Verify Pro tier
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', user_id)
      .single();

    if (profile?.tier !== 'pro') {
      return NextResponse.json({ error: 'Pro subscription required' }, { status: 403 });
    }

    // Check item count
    const { count } = await supabase
      .from('watchlist_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id);

    if ((count || 0) >= MAX_WATCHLIST_ITEMS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_WATCHLIST_ITEMS} watchlist items allowed` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('watchlist_items')
      .insert({
        user_id,
        item_type,
        item_value,
        company_id: company_id || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Item already in watchlist' }, { status: 409 });
      }
      console.error('Watchlist insert error:', error);
      return NextResponse.json({ error: 'Failed to add to watchlist' }, { status: 500 });
    }

    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    console.error('Watchlist API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('user_id');

    if (!id || !userId) {
      return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('watchlist_items')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Watchlist delete error:', error);
      return NextResponse.json({ error: 'Failed to remove from watchlist' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Watchlist API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
