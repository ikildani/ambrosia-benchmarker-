'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

/** "My Dashboard" next to the hero CTA, only once the session says the visitor is signed in. */
export default function DashboardLink() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return null;
  return (
    <Link
      href="/dashboard"
      className="group inline-flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium px-8 py-4 rounded-xl hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white transition-all duration-300 w-full sm:w-auto text-[15px]"
    >
      <span>My Dashboard</span>
    </Link>
  );
}
