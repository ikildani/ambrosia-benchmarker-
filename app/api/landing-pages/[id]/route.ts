import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateSlug } from '@/types/content';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get a single landing page by ID
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

// PATCH - Update a landing page
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
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

// DELETE - Delete a landing page
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
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
