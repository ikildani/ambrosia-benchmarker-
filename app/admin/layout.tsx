import { Metadata } from 'next';
import AdminLayoutClient from './AdminLayoutClient';
import { requireAdminPage } from '@/lib/auth/require-admin-page';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Server-rendered admin data must never reach a non-admin. The client layout
// only hides it in the browser; this check stops the response on first load,
// and each server page repeats it because layouts are not re-run on
// client-side navigation (see lib/auth/require-admin-page.ts).
export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage();
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
