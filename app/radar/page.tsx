'use client';

import { Suspense, useState } from 'react';
import Header from '@/components/Header';
import { RadarFeed } from '@/components/radar/RadarFeed';
import { RadarWatchlist } from '@/components/radar/RadarWatchlist';
import { MandatePanel } from '@/components/radar/MandatePanel';
import { RadarUpgradeGate } from '@/components/radar/RadarUpgradeGate';
import { useAuth } from '@/contexts/AuthContext';
import AuthModal from '@/components/AuthModal';

type RadarView = 'feed' | 'watchlist' | 'mandates';

export default function RadarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-slate-600 animate-spin" /></div>}>
      <RadarPageInner />
    </Suspense>
  );
}

function RadarPageInner() {
  const {
    isAuthenticated,
    user,
    tier,
    signIn,
    signOut,
    openAuthModal,
    closeAuthModal,
    showAuthModal,
    authModalMode,
    isLoading,
    isPortfolioAdmin,
  } = useAuth();

  const [view, setView] = useState<RadarView>('feed');

  // Asset Radar is dev-only until launch
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <p className="text-sm">Coming soon.</p>
      </div>
    );
  }

  const isPro = tier === 'pro' || tier === 'report' || tier === 'portfolio';

  const handleAuthSuccess = (email: string, name: string) => {
    signIn(email, name);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-slate-600 animate-spin" />
      </div>
    );
  }

  if (!isPro) {
    return (
      <>
        <Header
          isAuthenticated={isAuthenticated}
          userName={user?.name}
          userEmail={user?.email}
          tier={tier}
          isPortfolioAdmin={isPortfolioAdmin}
          onSignInClick={() => openAuthModal('signin')}
          onSignUpClick={() => openAuthModal('signup')}
          onSignOut={signOut}
        />
        <RadarUpgradeGate isAuthenticated={isAuthenticated} />
        <AuthModal
          isOpen={showAuthModal}
          onClose={closeAuthModal}
          onSuccess={handleAuthSuccess}
          initialMode={authModalMode}
        />
      </>
    );
  }

  const NAV_ITEMS: { key: RadarView; label: string; icon: React.ReactNode }[] = [
    {
      key: 'feed',
      label: 'Asset Feed',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      ),
    },
    {
      key: 'watchlist',
      label: 'Watchlist',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      ),
    },
    {
      key: 'mandates',
      label: 'Mandates',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Header
        isAuthenticated={isAuthenticated}
        userName={user?.name}
        userEmail={user?.email}
        tier={tier}
        isPortfolioAdmin={isPortfolioAdmin}
        onSignInClick={() => openAuthModal('signin')}
        onSignUpClick={() => openAuthModal('signup')}
        onSignOut={signOut}
      />

      {/* Hero */}
      <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 text-white pt-16 sm:pt-20 lg:pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-xs font-semibold rounded-full">
              Asset Intelligence
            </span>
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-xs font-semibold rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              PRO
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Asset Radar</h1>
          <p className="text-lg text-slate-300 max-w-2xl">
            Clinical-stage assets indexed from ClinicalTrials.gov, cross-referenced against
            real deal comps. Partnership status, licensing intent signals, and predicted deal terms
            for every program in the universe.
          </p>

          {/* Sub-navigation */}
          <div className="flex items-center gap-1 mt-8 -mb-px">
            {NAV_ITEMS.map(item => (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-xs font-semibold transition-all ${
                  view === item.key
                    ? 'bg-white/10 text-white border-b-2 border-amber-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'feed' && <RadarFeed />}
        {view === 'watchlist' && <RadarWatchlist onBack={() => setView('feed')} />}
        {view === 'mandates' && <MandatePanel onBack={() => setView('feed')} />}
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={closeAuthModal}
        onSuccess={handleAuthSuccess}
        initialMode={authModalMode}
      />
    </div>
  );
}
