import { NextResponse } from 'next/server';
import { createServiceClient, createServerClient } from '@/lib/supabase/server';
import { generateSlug } from '@/types/content';

// Admin email check
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'ikildani@ambrosiaventures.co').split(',').map(e => e.trim().toLowerCase());

// Helper to verify admin authentication
async function verifyAdmin(request: Request): Promise<{ authorized: boolean; error?: NextResponse }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      authorized: false,
      error: NextResponse.json({ error: 'Authorization required' }, { status: 401 }),
    };
  }

  const token = authHeader.split(' ')[1];
  const authClient = createServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);

  if (authError || !user) {
    return {
      authorized: false,
      error: NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 }),
    };
  }

  if (!user.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return {
      authorized: false,
      error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    };
  }

  return { authorized: true };
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get a single landing page by ID (Public)
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Landing page not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ page: data });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Update a landing page (Admin only)
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    // Security: Require admin authentication
    const authResult = await verifyAdmin(request);
    if (!authResult.authorized) {
      return authResult.error;
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = createServiceClient();

    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) {
      updates.title = body.title;
      if (!body.slug) {
        updates.slug = generateSlug(body.title);
      }
    }

    if (body.slug !== undefined) updates.slug = body.slug;
    if (body.meta_description !== undefined) updates.meta_description = body.meta_description;
    if (body.hero_title !== undefined) updates.hero_title = body.hero_title;
    if (body.hero_subtitle !== undefined) updates.hero_subtitle = body.hero_subtitle;
    if (body.hero_cta_text !== undefined) updates.hero_cta_text = body.hero_cta_text;
    if (body.sections !== undefined) updates.sections = body.sections;
    if (body.target_keyword !== undefined) updates.target_keyword = body.target_keyword;
    if (body.prefill_modality !== undefined) updates.prefill_modality = body.prefill_modality;
    if (body.prefill_indication !== undefined) updates.prefill_indication = body.prefill_indication;
    if (body.prefill_phase !== undefined) updates.prefill_phase = body.prefill_phase;

    if (body.status !== undefined) {
      updates.status = body.status;
      if (body.status === 'published') {
        const { data: existing } = await supabase
          .from('landing_pages')
          .select('published_at')
          .eq('id', id)
          .single();

        if (existing && !existing.published_at) {
          updates.published_at = new Date().toISOString();
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('landing_pages')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating landing page:', error);
      return NextResponse.json(
        { error: 'Failed to update landing page' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Landing page not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ page: data });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a landing page (Admin only)
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    // Security: Require admin authentication
    const authResult = await verifyAdmin(request);
    if (!authResult.authorized) {
      return authResult.error;
    }

    const { id } = await params;
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('landing_pages')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting landing page:', error);
      return NextResponse.json(
        { error: 'Failed to delete landing page' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
