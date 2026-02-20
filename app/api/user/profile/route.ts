import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

interface ProfileUpdateRequest {
  full_name?: string;
  company_name?: string;
  job_title?: string;
  phone_number?: string;
  linkedin_url?: string;
  deal_role?: string;
  avatar_gradient?: string;
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // Get the authenticated user from the Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const { createClient } = await import('@supabase/supabase-js');
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = (await request.json()) as ProfileUpdateRequest;

    // Only allow known fields
    const updateData: Record<string, string | undefined> = {};
    if (body.full_name !== undefined) updateData.full_name = body.full_name;
    if (body.company_name !== undefined) updateData.company_name = body.company_name;
    if (body.job_title !== undefined) updateData.job_title = body.job_title;
    if (body.phone_number !== undefined) updateData.phone_number = body.phone_number;
    if (body.linkedin_url !== undefined) updateData.linkedin_url = body.linkedin_url;
    if (body.deal_role !== undefined) updateData.deal_role = body.deal_role;
    if (body.avatar_gradient !== undefined) updateData.avatar_gradient = body.avatar_gradient;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
