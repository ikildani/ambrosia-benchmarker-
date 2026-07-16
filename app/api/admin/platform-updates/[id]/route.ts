import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { platformUpdateSchema, formatZodErrors } from '@/lib/api-validation';
import { captureApiError } from '@/lib/sentry-api';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data: existing } = await supabase
      .from('platform_updates')
      .select('sent_at')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Update not found' }, { status: 404 });
    }
    if (existing.sent_at) {
      return NextResponse.json({ error: 'Cannot edit a sent update' }, { status: 409 });
    }

    const rawBody = await request.json();
    const parsed = platformUpdateSchema.partial().safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodErrors(parsed.error) }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('platform_updates')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      captureApiError(error, 'admin-platform-updates-patch');
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json({ update: data });
  } catch (error) {
    captureApiError(error, 'admin-platform-updates-patch');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data: existing } = await supabase
      .from('platform_updates')
      .select('sent_at')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Update not found' }, { status: 404 });
    }
    if (existing.sent_at) {
      return NextResponse.json({ error: 'Cannot delete a sent update' }, { status: 409 });
    }

    const { error } = await supabase
      .from('platform_updates')
      .delete()
      .eq('id', id);

    if (error) {
      captureApiError(error, 'admin-platform-updates-delete');
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    captureApiError(error, 'admin-platform-updates-delete');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
