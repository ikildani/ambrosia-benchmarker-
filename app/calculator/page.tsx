'use client';

import { useRouter } from 'next/navigation';
import Calculator from '@/components/Calculator';
import Header from '@/components/Header';
import AuthModal from '@/components/AuthModal';
import ExitIntentCapture from '@/components/ExitIntentCapture';
import { useAuth } from '@/contexts/AuthContext';

export default function CalculatorPage() {
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
  } = useAuth();

  const router = useRouter();
  const handleUpgrade = () => {
    router.push('/#pricing');
  };

  const handleAuthSuccess = (email: string, name: string) => {
    signIn(email, name);
  };

  // Show loading state while auth is initializing
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-teal-200 dark:border-teal-800 border-t-teal-500 animate-spin" />
          <p className="text-slate-600 dark:text-slate-300 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <Header
        isAuthenticated={isAuthenticated}
        userName={user?.name}
        userEmail={user?.email}
        tier={tier}
        onSignInClick={() => openAuthModal('signin')}
        onSignUpClick={() => openAuthModal('signup')}
        onSignOut={signOut}
      />

      {/* Main Content */}
      <main id="main-content" className="pt-20 sm:pt-24 lg:pt-28 pb-12 sm:pb-16 px-3 sm:px-4">
        {/* Page Header */}
        <div className="max-w-6xl mx-auto mb-6 sm:mb-8">
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-2">
              Deal Terms Calculator
            </h1>
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto px-2">
              Data-driven estimates for upfront payments, milestones, and royalties across oncology, neurology, immunology, and metabolic/obesity licensing deals
            </p>
          </div>
        </div>

        {/* Calculator */}
        <Calculator tier={tier} onUpgrade={handleUpgrade} />

        {/* Upgrade Banner for Free Users */}
        {tier === 'free' && (
          <div className="max-w-6xl mx-auto mt-8 sm:mt-12">
            <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 rounded-xl sm:rounded-2xl p-5 sm:p-6 lg:p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, rgba(14, 165, 165, 0.5) 1px, transparent 0)`,
                  backgroundSize: '24px 24px'
                }} />
              </div>
              <div className="relative flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
                <div className="text-center md:text-left">
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-1 sm:mb-2">
                    Unlock Full Analysis
                  </h3>
                  <p className="text-neutral-300 text-xs sm:text-sm max-w-md">
                    Get detailed milestone breakdowns, royalty analysis, and downloadable PDF reports with Pro.
                  </p>
                </div>
                <button
                  onClick={handleUpgrade}
                  className="flex-shrink-0 inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm sm:text-base font-semibold rounded-xl shadow-glow hover:shadow-glow-lg transition-all duration-200 hover:-translate-y-0.5 w-full md:w-auto"
                >
                  <span>Upgrade to Pro</span>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-slate-200 py-6 sm:py-8 px-3 sm:px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500">
            <span>&copy; {new Date().getFullYear()} Ambrosia Ventures</span>
            <span className="hidden sm:inline">|</span>
            <a
              href="https://www.ambrosiaventures.co"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-teal-600 transition-colors"
            >
              Visit Website
            </a>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-right max-w-sm">
            For informational purposes only. Not financial or legal advice.
          </p>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={closeAuthModal}
        onSuccess={handleAuthSuccess}
        initialMode={authModalMode}
      />

      <ExitIntentCapture />
    </div>
  );
}
