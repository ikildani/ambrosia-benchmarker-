import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

interface CalculationRequest {
  session_id?: string;
  anonymous_id?: string;
  user_id?: string;

  // Input parameters
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

// GET endpoint to retrieve user's calculation history
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const anonymousId = searchParams.get('anonymous_id');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!userId && !anonymousId) {
      return NextResponse.json(
        { error: 'user_id or anonymous_id is required' },
        { status: 400 }
      );
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
