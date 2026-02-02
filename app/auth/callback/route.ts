import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// Handle auth callbacks (email verification, password reset, magic links)
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');
  const next = requestUrl.searchParams.get('next') || '/';

  if (code) {
    const supabase = createServerClient();

    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // If this was email verification, update the user profile
      if (type === 'signup' || type === 'email') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('user_profiles')
            .update({
              email_verified: true,
              email_verified_at: new Date().toISOString(),
            })
            .eq('id', user.id);
        }
      }

      // Redirect to the app with success message
      const successUrl = new URL('/', requestUrl.origin);
      successUrl.searchParams.set('verified', 'true');
      return NextResponse.redirect(successUrl);
    }
  }

  // If there's an error, redirect to home with error
  const errorUrl = new URL('/', requestUrl.origin);
  errorUrl.searchParams.set('auth_error', 'true');
  return NextResponse.redirect(errorUrl);
}
