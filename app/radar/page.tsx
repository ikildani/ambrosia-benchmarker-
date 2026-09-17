'use client';

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';
import { hasProAccess } from '@/types/tier';
import { RadarShell } from '@/components/radar/feed/RadarShell';
import { RadarUpgradeGate } from '@/components/radar/RadarUpgradeGate';
import { TableSkeleton } from '@/components/radar/feed/FeedStates';

/**
 * Launch gate. NEXT_PUBLIC_RADAR_ENABLED is inlined at build time on both the
 * server and the client, so the decision is identical in SSR and hydration.
 * Default: on in development, off everywhere else until launch. layout.tsx
 * performs the same check on the server so the response is a real 404.
 */
const RADAR_ENABLED =
  process.env.NEXT_PUBLIC_RADAR_ENABLED === 'true' ||
  (!process.env.NEXT_PUBLIC_RADAR_ENABLED && process.env.NODE_ENV === 'development');

export default function RadarPage() {
  if (!RADAR_ENABLED) notFound();
  return <RadarPageInner />;
}

function FeedFallback() {
  return (
    <div className="min-h-screen bg-neutral-50 pt-16 dark:bg-neutral-950 sm:pt-20">
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">Loading assets</p>
        <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <TableSkeleton />
        </div>
      </div>
    </div>
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

  const header = (
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
  );

  const authModal = (
    <AuthModal
      isOpen={showAuthModal}
      onClose={closeAuthModal}
      onSuccess={(email: string, name: string) => signIn(email, name)}
      initialMode={authModalMode}
    />
  );

  if (isLoading) {
    return (
      <>
        {header}
        <FeedFallback />
      </>
    );
  }

  if (!hasProAccess(tier)) {
    return (
      <>
        {header}
        <RadarUpgradeGate isAuthenticated={isAuthenticated} />
        {authModal}
      </>
    );
  }

  return (
    <>
      {header}
      {/* useSearchParams inside RadarShell requires a Suspense boundary for static prerender. */}
      <Suspense fallback={<FeedFallback />}>
        <RadarShell />
      </Suspense>
      {authModal}
    </>
  );
}
