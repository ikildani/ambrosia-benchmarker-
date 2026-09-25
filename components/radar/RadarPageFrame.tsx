'use client';

/**
 * The site chrome every Radar surface shares: the Header wired to the auth
 * context and the AuthModal. Before this, the feed and the asset page each
 * mounted their own copy and the upgrade gate on /radar/[id] and the
 * methodology page had no Header at all.
 *
 * Server pages can wrap their content in it (client component with server
 * children); client pages use `useRadarAuth()` for the sign-up hook.
 */

import type { ReactNode } from 'react';
import Header from '@/components/Header';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';

export function RadarPageFrame({ children }: { children: ReactNode }) {
  const auth = useAuth();
  return (
    <>
      <Header
        isAuthenticated={auth.isAuthenticated}
        userName={auth.user?.name}
        userEmail={auth.user?.email}
        tier={auth.tier}
        isPortfolioAdmin={auth.isPortfolioAdmin}
        onSignInClick={() => auth.openAuthModal('signin')}
        onSignUpClick={() => auth.openAuthModal('signup')}
        onSignOut={auth.signOut}
      />
      {children}
      <AuthModal
        isOpen={auth.showAuthModal}
        onClose={auth.closeAuthModal}
        onSuccess={(email: string, name: string) => auth.signIn(email, name)}
        initialMode={auth.authModalMode}
      />
    </>
  );
}
