'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Dashboard from '@/components/Dashboard';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, user, tier, signOut, isLoading, isPortfolioAdmin } = useAuth();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  // While auth resolves (or before the redirect fires), paint the page chrome and a
  // content skeleton instead of a blank spinner so the first paint is the real layout.
  if (isLoading || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
        <Header isAuthenticated={false} />
        <main id="main-content" className="pt-24 sm:pt-28 px-4 max-w-6xl mx-auto" aria-busy="true" aria-label={isLoading ? 'Loading dashboard' : 'Redirecting'}>
          <div className="h-8 w-56 rounded-lg bg-slate-200/80 dark:bg-slate-700/60 animate-pulse mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
            ))}
          </div>
          <div className="h-64 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
        </main>
      </div>
    );
  }

  const handleNavigateToCalculator = () => {
    router.push('/calculator?new=true');
  };

  const handleUpgrade = () => {
    router.push('/#pricing');
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <>
      <Header
        isAuthenticated={isAuthenticated}
        userName={user.name}
        userEmail={user.email}
        tier={tier}
        isPortfolioAdmin={isPortfolioAdmin}
        onSignOut={handleSignOut}
      />
      <Dashboard
        userName={user.name}
        userEmail={user.email}
        tier={tier}
        onNavigateToCalculator={handleNavigateToCalculator}
        onUpgrade={handleUpgrade}
        onSignOut={handleSignOut}
      />
    </>
  );
}
