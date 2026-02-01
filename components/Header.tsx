'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import AuthModal from './AuthModal';

interface HeaderProps {
  isAuthenticated?: boolean;
  userEmail?: string;
  onAuthSuccess?: (email: string) => void;
  onSignOut?: () => void;
}

export default function Header({ isAuthenticated, userEmail, onAuthSuccess, onSignOut }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAuthSuccess = (email: string) => {
    setShowAuthModal(false);
    onAuthSuccess?.(email);
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-xl shadow-soft border-b border-neutral-100'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20 lg:h-24">
            <a
              href="https://www.ambrosiaventures.co"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center group"
            >
              <Image
                src="/logo.png"
                alt="Ambrosia Ventures"
                width={320}
                height={88}
                className="h-12 sm:h-14 lg:h-16 w-auto object-contain transition-all duration-300 hover:opacity-80"
                priority
              />
            </a>

            <nav className="hidden md:flex items-center gap-8">
              <a
                href="#calculator"
                className="text-sm font-medium text-neutral-600 hover:text-teal-600 transition-colors"
              >
                Calculator
              </a>
              <a
                href="#pricing"
                className="text-sm font-medium text-neutral-600 hover:text-teal-600 transition-colors"
              >
                Pricing
              </a>
              <a
                href="#about"
                className="text-sm font-medium text-neutral-600 hover:text-teal-600 transition-colors"
              >
                About
              </a>
            </nav>

            <div className="flex items-center gap-3">
              {isAuthenticated && userEmail ? (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white font-semibold text-sm">
                      {userEmail.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden sm:block text-sm font-medium text-neutral-700 max-w-[120px] truncate">
                      {userEmail}
                    </span>
                    <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-neutral-200 py-2 animate-fade-in">
                      <div className="px-4 py-2 border-b border-neutral-100">
                        <p className="text-xs text-neutral-500">Signed in as</p>
                        <p className="text-sm font-medium text-neutral-800 truncate">{userEmail}</p>
                      </div>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onSignOut?.();
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="text-sm font-medium text-neutral-600 hover:text-teal-600 transition-colors px-4 py-2"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200
                             bg-gradient-to-r from-teal-600 to-cyan-500 text-white hover:from-teal-700 hover:to-cyan-600 shadow-soft hover:shadow-glow hover:-translate-y-0.5"
                  >
                    <span>Sign Up Free</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        mode="signup"
      />
    </>
  );
}
