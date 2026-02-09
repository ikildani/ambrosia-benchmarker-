import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';

interface CalculationRequest {
  session_id?: string;
  anonymous_id?: string;
  user_id?: string;

  // Input parameters
  therapeutic_area?: string;
  modality: string;
  development_phase: string;
  indication_category?: string;
  indication_specific?: string;
  territory_scope?: string;
  territories_included?: string[];
  exclusivity_type?: string;
  deal_type?: string;
  includes_manufacturing?: boolean;
  includes_codev?: boolean;
  includes_copromote?: boolean;

  // Output values
  outputs: {
    upfront_low?: number;
    upfront_mid?: number;
    upfront_high?: number;
    milestones_total?: number;
    royalty_low?: number;
    royalty_high?: number;
    total_deal_value_low?: number;
    total_deal_value_high?: number;
  };
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const identifier = getIdentifier(request);
  const rateLimitResult = checkRateLimit(identifier, 'calculations', RATE_LIMIT_CONFIGS.calculations);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimitResult),
      }
    );
  }

  try {
    const supabase = createServiceClient();
    const body: CalculationRequest = await request.json();

    // Validate required fields
    if (!body.modality || !body.development_phase) {
      return NextResponse.json(
        { error: 'modality and development_phase are required' },
        { status: 400 }
      );
    }

    // Get user tier if user_id is provided
    let userTier = 'free';
    if (body.user_id) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tier')
        .eq('id', body.user_id)
        .single();

      if (profile?.tier) {
        userTier = profile.tier;
      }
    }

    // Store the calculation
    const calculationData = {
      user_id: body.user_id || null,
      session_id: body.session_id || null,
      anonymous_id: body.anonymous_id || null,
      therapeutic_area: body.therapeutic_area || 'oncology',
      modality: body.modality,
      development_phase: body.development_phase,
      indication_category: body.indication_category || null,
      indication_specific: body.indication_specific || null,
      territory_scope: body.territory_scope || null,
      territories_included: body.territories_included || null,
      exclusivity_type: body.exclusivity_type || null,
      deal_type: body.deal_type || null,
      includes_manufacturing: body.includes_manufacturing || false,
      includes_codev: body.includes_codev || false,
      includes_copromote: body.includes_copromote || false,
      output_upfront_low: body.outputs?.upfront_low || null,
      output_upfront_mid: body.outputs?.upfront_mid || null,
      output_upfront_high: body.outputs?.upfront_high || null,
      output_milestones_total: body.outputs?.milestones_total || null,
      output_royalty_low: body.outputs?.royalty_low || null,
      output_royalty_high: body.outputs?.royalty_high || null,
      output_total_deal_value_low: body.outputs?.total_deal_value_low || null,
      output_total_deal_value_high: body.outputs?.total_deal_value_high || null,
      calculation_version: '1.0.0',
    };

    const { data: calculation, error: calcError } = await supabase
      .from('calculations')
      .insert(calculationData)
      .select('id')
      .single();

    if (calcError) {
      console.error('Calculation save error:', calcError);
      return NextResponse.json(
        { error: 'Failed to save calculation' },
        { status: 500 }
      );
    }

    // Also fire the calculation_completed event
    const eventData = {
      user_id: body.user_id || null,
      session_id: body.session_id || null,
      anonymous_id: body.anonymous_id || null,
      event_type: 'calculation_completed',
      event_data: {
        calculation_id: calculation.id,
        therapeutic_area: body.therapeutic_area || 'oncology',
        modality: body.modality,
        development_phase: body.development_phase,
        indication_category: body.indication_category,
        territory_scope: body.territory_scope,
        outputs: {
          upfront_range: [body.outputs?.upfront_low, body.outputs?.upfront_high],
          milestones_total: body.outputs?.milestones_total,
          royalty_range: [body.outputs?.royalty_low, body.outputs?.royalty_high],
          total_deal_value_range: [
            body.outputs?.total_deal_value_low,
            body.outputs?.total_deal_value_high,
          ],
        },
      },
      user_tier: userTier,
    };

    await supabase.from('events').insert(eventData);

    // Update session calculation count
    if (body.session_id) {
      await supabase.rpc('increment_session_calculations', {
        p_session_id: body.session_id,
      });
    }

    return NextResponse.json({
      success: true,
      calculation_id: calculation.id,
    });
  } catch (error) {
    console.error('Calculation API error:', error);
    return NextResponse.json(
      { error: 'Failed to save calculation' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve user's calculation history or count
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const anonymousId = searchParams.get('anonymous_id');
    const sessionId = searchParams.get('session_id');
    const countOnly = searchParams.get('count') === 'true';
    const monthOnly = searchParams.get('month') === 'true'; // Get count for current month only
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    if (!userId && !anonymousId) {
      return NextResponse.json(
        { error: 'user_id or anonymous_id is required' },
        { status: 400 }
      );
    }

    // If count only is requested, return just the count
    if (countOnly && userId) {
      const now = new Date();
      let query = supabase
        .from('calculations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Filter to current month if requested
      if (monthOnly) {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        query = query.gte('created_at', startOfMonth.toISOString());
      }

      const { count, error } = await query;

      if (error) {
        console.error('Calculation count error:', error);
        return NextResponse.json(
          { error: 'Failed to count calculations' },
          { status: 500 }
        );
      }

      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return NextResponse.json({
        count: count || 0,
        month: monthOnly ? currentMonth : undefined
      });
    }

    // SECURITY: For anonymous_id queries, require session_id for verification
    // This prevents enumeration attacks on anonymous calculation data
    if (anonymousId && !userId) {
      if (!sessionId) {
        return NextResponse.json(
          { error: 'session_id required for anonymous access' },
          { status: 400 }
        );
      }

      // Verify the session_id matches calculations with this anonymous_id
      const { data: sessionCheck } = await supabase
        .from('calculations')
        .select('id')
        .eq('anonymous_id', anonymousId)
        .eq('session_id', sessionId)
        .limit(1);

      if (!sessionCheck || sessionCheck.length === 0) {
        return NextResponse.json(
          { error: 'Invalid session' },
          { status: 403 }
        );
      }
    }

    let query = supabase
      .from('calculations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (anonymousId) {
      query = query.eq('anonymous_id', anonymousId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Calculation fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch calculations' },
        { status: 500 }
      );
    }

    return NextResponse.json({ calculations: data });
  } catch (error) {
    console.error('Calculation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE endpoint to remove a calculation
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('user_id');

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'user_id is required for deletion' },
        { status: 400 }
      );
    }

    // Delete only if the calculation belongs to this user
    const { error } = await supabase
      .from('calculations')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Calculation delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete calculation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Calculation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
