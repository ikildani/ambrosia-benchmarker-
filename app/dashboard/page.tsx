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

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
          <p className="text-slate-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Don't render dashboard if not authenticated (will redirect)
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
          <p className="text-slate-600 font-medium">Redirecting...</p>
        </div>
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
