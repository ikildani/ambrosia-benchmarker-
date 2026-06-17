import { NextRequest } from 'next/server';
import { requireTeamAdmin } from '@/lib/portfolio/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { apiSuccess, apiError } from '@/lib/api-response';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request: NextRequest) {
  try {
    const auth = await requireTeamAdmin(request);
    if ('error' in auth) return auth.error;

    const { teamId } = auth;

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return apiError('No file provided', 400);
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return apiError('Invalid file type. Allowed: PNG, JPEG, SVG, WebP', 400);
    }

    if (file.size > MAX_SIZE) {
      return apiError('File too large. Maximum size is 2MB', 400);
    }

    // Convert to base64 data URI
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const dataUri = `data:${file.type};base64,${base64}`;

    // Update team logo_url
    const supabase = createServiceClient();
    const { error: updateError } = await supabase
      .from('teams')
      .update({ logo_url: dataUri })
      .eq('id', teamId);

    if (updateError) {
      console.error('Logo update error:', updateError);
      return apiError('Failed to save logo', 500);
    }

    return apiSuccess({ logoUrl: dataUri });
  } catch (error) {
    console.error('Logo upload error:', error);
    return apiError('Failed to upload logo', 500);
  }
}
