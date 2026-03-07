import { NextResponse } from 'next/server';
import { createServiceClient, createServerClient } from '@/lib/supabase/server';
import { CreateBlogPostRequest, generateSlug } from '@/types/content';
import { isAdminEmail } from '@/lib/config/authorized-emails';
import { apiSuccess, apiError } from '@/lib/api-response';
import { clampInt, contentQuerySchema, contentPostSchema, formatZodErrors } from '@/lib/api-validation';

// Helper to verify admin authentication
async function verifyAdmin(request: Request): Promise<{ authorized: boolean; error?: NextResponse }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      authorized: false,
      error: apiError('Authorization required', 401),
    };
  }

  const token = authHeader.split(' ')[1];
  const authClient = await createServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);

  if (authError || !user) {
    return {
      authorized: false,
      error: apiError('Invalid or expired token', 401),
    };
  }

  if (!isAdminEmail(user.email)) {
    return {
      authorized: false,
      error: apiError('Admin access required', 403),
    };
  }

  return { authorized: true };
}

// GET - List blog posts (with optional filters) - Public for published, admin for all
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawParams = Object.fromEntries(searchParams.entries());
    const parsed = contentQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return apiError(formatZodErrors(parsed.error), 400);
    }
    const status = parsed.data.status;
    const category = parsed.data.category;
    const limit = clampInt(searchParams.get('limit'), 1, 100, 50);
    const offset = clampInt(searchParams.get('offset'), 0, 100000, 0);

    const supabase = createServiceClient();

    let query = supabase
      .from('blog_posts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching posts:', error);
      return apiError('Failed to fetch posts', 500);
    }

    return apiSuccess({ posts: data || [], total: count || 0, limit, offset });
  } catch (error) {
    console.error('Error:', error);
    return apiError('Internal server error', 500);
  }
}

// POST - Create a new blog post (Admin only)
export async function POST(request: Request) {
  try {
    // Security: Require admin authentication
    const authResult = await verifyAdmin(request);
    if (!authResult.authorized) {
      return authResult.error;
    }

    const rawBody = await request.json();
    const bodyResult = contentPostSchema.safeParse(rawBody);
    if (!bodyResult.success) {
      return apiError(formatZodErrors(bodyResult.error), 400);
    }
    const body = bodyResult.data;

    const slug = body.slug || generateSlug(body.title);
    const supabase = createServiceClient();

    // Check if slug already exists
    const { data: existing } = await supabase
      .from('blog_posts')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      return apiError('A post with this slug already exists', 409);
    }

    const { data, error } = await supabase
      .from('blog_posts')
      .insert({
        slug,
        title: body.title,
        content: body.content,
        excerpt: body.excerpt,
        meta_description: body.meta_description,
        category: body.category,
        tags: body.tags,
        modality: body.modality,
        indication: body.indication,
        ai_generated: body.ai_generated || false,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating post:', error);
      return apiError('Failed to create post', 500);
    }

    return apiSuccess({ post: data }, 201);
  } catch (error) {
    console.error('Error:', error);
    return apiError('Internal server error', 500);
  }
}
