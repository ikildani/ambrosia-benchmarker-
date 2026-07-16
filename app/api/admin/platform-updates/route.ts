import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { platformUpdateSchema, formatZodErrors } from '@/lib/api-validation';
import { captureApiError } from '@/lib/sentry-api';
import { getAuthenticatedUser } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('platform_updates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      captureApiError(error, 'admin-platform-updates-list');
      return NextResponse.json({ error: 'Failed to fetch updates' }, { status: 500 });
    }

    return NextResponse.json({ updates: data });
  } catch (error) {
    captureApiError(error, 'admin-platform-updates-list');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  try {
    const rawBody = await request.json();
    const parsed = platformUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodErrors(parsed.error) }, { status: 400 });
    }

    const user = await getAuthenticatedUser(request);
    const createdBy = user?.email || 'admin';

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('platform_updates')
      .insert({ ...parsed.data, created_by: createdBy })
      .select()
      .single();

    if (error) {
      captureApiError(error, 'admin-platform-updates-create');
      return NextResponse.json({ error: 'Failed to create update' }, { status: 500 });
    }

    return NextResponse.json({ update: data }, { status: 201 });
  } catch (error) {
    captureApiError(error, 'admin-platform-updates-create');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
