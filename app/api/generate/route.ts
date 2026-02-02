import { NextResponse } from 'next/server';
import { createServiceClient, createServerClient } from '@/lib/supabase/server';
import { getContentGenerator } from '@/lib/ai/content-generator';
import { GenerateContentRequest, generateSlug } from '@/types/content';

// Admin email check
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'ikildani@ambrosiaventures.co').split(',').map(e => e.trim().toLowerCase());

export async function POST(request: Request) {
  try {
    // Security: Require admin authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const authClient = createServerClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Verify user is admin
    if (!user.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as GenerateContentRequest;
    const { job_type, target_keyword, parameters } = body;

    if (!job_type || !target_keyword) {
      return NextResponse.json(
        { error: 'job_type and target_keyword are required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const generator = getContentGenerator();

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from('content_generation_jobs')
      .insert({
        job_type,
        target_keyword,
        parameters,
        status: 'processing',
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating job:', jobError);
      return NextResponse.json(
        { error: 'Failed to create generation job' },
        { status: 500 }
      );
    }

    try {
      if (job_type === 'blog_post') {
        // Generate blog post
        const content = await generator.generateBlogPost({
          ...parameters,
          topic: target_keyword,
        });

        // Create draft blog post
        const slug = generateSlug(content.title);
        const { data: post, error: postError } = await supabase
          .from('blog_posts')
          .insert({
            slug,
            title: content.title,
            meta_description: content.meta_description,
            excerpt: content.excerpt,
            content: content.content,
            category: parameters.category || 'deal-trends',
            modality: parameters.modality,
            indication: parameters.indication,
            ai_generated: true,
            ai_prompt_used: target_keyword,
            generation_model: 'claude-sonnet-4-20250514',
            status: 'draft',
          })
          .select()
          .single();

        if (postError) {
          throw new Error(`Failed to save blog post: ${postError.message}`);
        }

        // Update job with result
        await supabase
          .from('content_generation_jobs')
          .update({
            status: 'completed',
            generated_content: content.content,
            generated_title: content.title,
            generated_meta_description: content.meta_description,
            generated_at: new Date().toISOString(),
            result_post_id: post.id,
          })
          .eq('id', job.id);

        return NextResponse.json({
          success: true,
          job_id: job.id,
          post_id: post.id,
          content: {
            title: content.title,
            meta_description: content.meta_description,
            excerpt: content.excerpt,
            slug,
            faqs: content.faqs,
          },
        });
      } else if (job_type === 'landing_page') {
        // Generate landing page
        const content = await generator.generateLandingPage({
          ...parameters,
          topic: target_keyword,
        });

        // Create draft landing page
        const slug = generateSlug(target_keyword);
        const { data: page, error: pageError } = await supabase
          .from('landing_pages')
          .insert({
            slug,
            title: content.title,
            meta_description: content.meta_description,
            hero_title: content.hero.headline,
            hero_subtitle: content.hero.subtitle,
            hero_cta_text: content.hero.cta_text,
            sections: {
              value_props: content.value_props,
              how_it_works: content.how_it_works,
              stats: content.stats,
              faqs: content.faqs,
            },
            target_keyword,
            prefill_modality: parameters.modality,
            prefill_indication: parameters.indication,
            prefill_phase: parameters.phase,
            ai_generated: true,
            status: 'draft',
          })
          .select()
          .single();

        if (pageError) {
          throw new Error(`Failed to save landing page: ${pageError.message}`);
        }

        // Update job with result
        await supabase
          .from('content_generation_jobs')
          .update({
            status: 'completed',
            generated_title: content.title,
            generated_meta_description: content.meta_description,
            generated_at: new Date().toISOString(),
            result_page_id: page.id,
          })
          .eq('id', job.id);

        return NextResponse.json({
          success: true,
          job_id: job.id,
          page_id: page.id,
          content: {
            title: content.title,
            meta_description: content.meta_description,
            hero: content.hero,
            slug,
          },
        });
      } else {
        return NextResponse.json(
          { error: 'Invalid job_type. Must be "blog_post" or "landing_page"' },
          { status: 400 }
        );
      }
    } catch (genError) {
      // Update job with error
      await supabase
        .from('content_generation_jobs')
        .update({
          status: 'failed',
          error_message: genError instanceof Error ? genError.message : 'Unknown error',
        })
        .eq('id', job.id);

      throw genError;
    }
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
