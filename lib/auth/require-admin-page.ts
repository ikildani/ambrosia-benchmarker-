import 'server-only';
import { notFound } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/config/authorized-emails';

/**
 * Server-side gate for /admin pages.
 *
 * AdminLayoutClient only hides content in the browser: a server component
 * under /admin still renders, and its output (rows read with the service
 * client) ships in the RSC payload to anyone who requests the URL. Every
 * server page under /admin must call this before reading data. It is also
 * called from app/admin/layout.tsx for first loads, but a layout is not
 * re-run on client-side navigation between admin pages, so the page-level
 * call is the one that matters.
 *
 * Fails closed: no session, a non-admin email, or an auth error all 404.
 */
export async function requireAdminPage(): Promise<User> {
  let user: User | null = null;
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error) user = data.user;
  } catch {
    user = null;
  }
  if (!user?.email || !isAdminEmail(user.email)) notFound();
  return user;
}
