'use client';

/**
 * The site header for pages that are server-rendered for SEO (companies, data,
 * blog, methodology). Reads auth from context and renders the guest header in
 * the server HTML immediately; the avatar swaps in once the session resolves.
 * Before this, those routes rendered with no navigation at all on phones.
 */
import Header from '@/components/Header';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';

export default function SiteHeaderAuto() {
  const { isAuthenticated, user, tier, signIn, signOut, openAuthModal, closeAuthModal, showAuthModal, authModalMode, isPortfolioAdmin } = useAuth();
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
      <AuthModal
        isOpen={showAuthModal}
        onClose={closeAuthModal}
        onSuccess={(email: string, name: string) => signIn(email, name)}
        initialMode={authModalMode}
      />
    </>
  );
}
