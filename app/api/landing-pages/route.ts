import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateSlug } from '@/types/content';

// GET - List landing pages
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const supabase = createServiceClient();

    let query = supabase
      .from('landing_pages')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching landing pages:', error);
      return NextResponse.json(
        { error: 'Failed to fetch landing pages' },
        { status: 500 }
      );
    }

    return NextResponse.json({ pages: data || [] });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create landing page
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.title) {
      return NextResponse.json(
        { error: 'title is required' },
        { status: 400 }
      );
    }

    const slug = body.slug || generateSlug(body.title);
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('landing_pages')
      .insert({
        slug,
        title: body.title,
        meta_description: body.meta_description,
        hero_title: body.hero_title,
        hero_subtitle: body.hero_subtitle,
        hero_cta_text: body.hero_cta_text || 'Try Calculator',
        sections: body.sections,
        target_keyword: body.target_keyword,
        prefill_modality: body.prefill_modality,
        prefill_indication: body.prefill_indication,
        prefill_phase: body.prefill_phase,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating landing page:', error);
      return NextResponse.json(
        { error: 'Failed to create landing page' },
        { status: 500 }
      );
    }

    return NextResponse.json({ page: data }, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
