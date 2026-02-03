import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Pro user emails (synced with AuthContext)
const PRO_EMAILS = ['ikildani@ambrosiaventures.co', 'czuckerman@ambrosiaventures.co'];

// GET - List saved scenarios for a user
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    // SECURITY: Removed client tier - never trust client-provided tier
    // const clientTier = searchParams.get('tier');

    if (!email) {
      return NextResponse.json(
        { error: 'Email required' },
        { status: 400 }
      );
    }

    // SECURITY: Only trust database-verified tier, never client-provided tier
    let userTier: 'free' | 'pro' = 'free';
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('email', email)
      .single();

    userTier = (profile?.tier as 'free' | 'pro') || 'free';

    // Check PRO_EMAILS list for localStorage auth users (synced with AuthContext)
    if (userTier === 'free' && email) {
      const emailLower = email.toLowerCase().trim();
      if (PRO_EMAILS.some(e => e.toLowerCase() === emailLower)) {
        userTier = 'pro';
      }
    }

    if (userTier !== 'pro') {
      return NextResponse.json(
        { error: 'Pro subscription required', scenarios: [] },
        { status: 403 }
      );
    }

    // Fetch scenarios
    const { data: scenarios, error } = await supabase
      .from('saved_scenarios')
      .select('id, name, notes, inputs, results, labels, created_at, updated_at')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching scenarios:', error);
      return NextResponse.json(
        { error: 'Failed to fetch scenarios' },
        { status: 500 }
      );
    }

    return NextResponse.json({ scenarios: scenarios || [] });
  } catch (error) {
    console.error('Scenarios API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Save a new scenario
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    // SECURITY: Removed tier from destructuring - never trust client-provided tier
    const { email, name, notes, inputs, results, labels } = body;

    if (!email || !name || !inputs || !results) {
      return NextResponse.json(
        { error: 'Email, name, inputs, and results are required' },
        { status: 400 }
      );
    }

    // SECURITY: Only trust database-verified tier, never client-provided tier
    let userTier: 'free' | 'pro' = 'free';
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, tier')
      .eq('email', email)
      .single();

    userTier = (profile?.tier as 'free' | 'pro') || 'free';

    // Check PRO_EMAILS list for localStorage auth users (synced with AuthContext)
    if (userTier === 'free' && email) {
      const emailLower = email.toLowerCase().trim();
      if (PRO_EMAILS.some(e => e.toLowerCase() === emailLower)) {
        userTier = 'pro';
      }
    }

    if (userTier !== 'pro') {
      return NextResponse.json(
        { error: 'Pro subscription required to save scenarios' },
        { status: 403 }
      );
    }

    // Check scenario limit (max 20 per user)
    const { count } = await supabase
      .from('saved_scenarios')
      .select('*', { count: 'exact', head: true })
      .eq('email', email);

    if (count && count >= 20) {
      return NextResponse.json(
        { error: 'Maximum of 20 saved scenarios reached. Please delete some to save new ones.' },
        { status: 400 }
      );
    }

    // Save scenario
    const { data: scenario, error } = await supabase
      .from('saved_scenarios')
      .insert({
        user_id: profile?.id || null,
        email,
        name,
        notes: notes || null,
        inputs,
        results,
        labels: labels || {},
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving scenario:', error);
      return NextResponse.json(
        { error: 'Failed to save scenario' },
        { status: 500 }
      );
    }

    return NextResponse.json({ scenario });
  } catch (error) {
    console.error('Save scenario error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a scenario
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const email = searchParams.get('email');

    if (!id || !email) {
      return NextResponse.json(
        { error: 'ID and email required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('saved_scenarios')
      .delete()
      .eq('id', id)
      .eq('email', email);

    if (error) {
      console.error('Error deleting scenario:', error);
      return NextResponse.json(
        { error: 'Failed to delete scenario' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete scenario error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
