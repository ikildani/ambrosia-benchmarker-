'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Library,
  Bell,
  FileBarChart,
  Shield,
  Settings,
  Clock,
  LogOut,
  Menu,
  X,
  Crown,
  ArrowLeft,
  Lock,
} from 'lucide-react';
import type { PortfolioSubTier } from '@/types/tier';
import { isScalePlus } from '@/lib/portfolio/feature-gates';

interface NavItem {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  minTier?: PortfolioSubTier;
  badge?: string;
}

const allNavItems: NavItem[] = [
  { href: '/portfolio/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/portfolio/admin/members', icon: Users, label: 'Members & Seats' },
  { href: '/portfolio/admin/comp-library', icon: Library, label: 'Comp Library', minTier: 'scale' },
  { href: '/portfolio/admin/alerts', icon: Bell, label: 'Deal Alerts' },
  { href: '/portfolio/admin/reports', icon: FileBarChart, label: 'Reports', minTier: 'scale', badge: 'Scale+' },
  { href: '/portfolio/admin/audit', icon: Shield, label: 'Audit Log' },
  { href: '/portfolio/admin/analyst-hours', icon: Clock, label: 'Analyst Hours' },
  { href: '/portfolio/admin/settings', icon: Settings, label: 'Settings' },
];

export default function PortfolioAdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, tier, isPortfolioAdmin, teamName, portfolioSubTier, signOut, isLoading, isTeamLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || tier !== 'portfolio')) {
      router.push('/');
    }
  }, [isAuthenticated, tier, isLoading, router]);

  if (isLoading || (tier === 'portfolio' && isTeamLoading)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  if (!isAuthenticated || tier !== 'portfolio') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-slate-400 mb-4">Portfolio admin access required.</p>
          <Link href="/" className="text-teal-400 hover:text-teal-300 font-medium">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 border-r border-slate-800 transform transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-5 h-5 text-amber-400" />
            <span className="text-white font-semibold text-sm">Portfolio Admin</span>
          </div>
          {teamName && (
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-slate-400 text-xs truncate">{teamName}</p>
              {portfolioSubTier && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${
                  portfolioSubTier === 'enterprise' ? 'bg-purple-500/15 text-purple-400' :
                  portfolioSubTier === 'scale' ? 'bg-teal-500/15 text-teal-400' :
                  'bg-slate-500/15 text-slate-400'
                }`}>
                  {portfolioSubTier}
                </span>
              )}
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden absolute top-4 right-4 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-3 space-y-0.5">
          {allNavItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/portfolio/admin' && pathname.startsWith(item.href));
            const isLocked = item.minTier && !isScalePlus(portfolioSubTier) && item.minTier !== 'growth';
            const isEnterpriseLocked = item.minTier === 'enterprise' && portfolioSubTier !== 'enterprise';
            const locked = isLocked || isEnterpriseLocked;

            if (locked) {
              return (
                <div
                  key={item.href}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-600 cursor-not-allowed group relative"
                >
                  <item.icon className="w-4 h-4" />
                  <span className="flex-1">{item.label}</span>
                  <Lock className="w-3 h-3 text-slate-600" />
                  <div className="absolute left-full ml-2 hidden group-hover:block bg-slate-800 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap border border-slate-700 shadow-lg z-50">
                    Requires {item.minTier === 'enterprise' ? 'Enterprise' : 'Scale'} tier
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-teal-500/10 text-teal-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 font-medium">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800 space-y-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-teal-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Calculator
          </Link>
          <div className="text-xs text-slate-500 truncate">{user?.email}</div>
          <button
            onClick={async () => {
              await signOut();
              router.push('/');
            }}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="bg-slate-900/50 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-4">
              <Link
                href="/portfolio"
                className="text-sm text-slate-400 hover:text-teal-400"
              >
                Portfolio License
              </Link>
            </div>
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
