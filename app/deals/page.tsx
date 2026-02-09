'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import DealBrowser from '@/components/deals/DealBrowser';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';

export default function DealsPage() {
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
  } = useAuth();

  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleAuthSuccess = (email: string, name: string) => {
    signIn(email, name);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-xl shadow-soft border-b border-neutral-100'
            : 'bg-navy-900/95 backdrop-blur-sm'
        }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16 lg:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <Image
                src={scrolled ? "/logo-color.png" : "/logo-white.png"}
                alt="Ambrosia Ventures"
                width={220}
                height={46}
                className="h-10 w-auto"
                priority
              />
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/calculator"
                className={`text-sm font-medium transition-colors ${
                  scrolled ? 'text-neutral-600 hover:text-teal-600' : 'text-white/80 hover:text-white'
                }`}
              >
                Calculator
              </Link>
              <Link
                href="/deals"
                className={`text-sm font-medium transition-colors ${
                  scrolled ? 'text-teal-600' : 'text-teal-300'
                }`}
              >
                Deals
              </Link>
              <Link
                href="/#pricing"
                className={`text-sm font-medium transition-colors ${
                  scrolled ? 'text-neutral-600 hover:text-teal-600' : 'text-white/80 hover:text-white'
                }`}
              >
                Pricing
              </Link>
            </nav>

            {/* Auth */}
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${
                      scrolled
                        ? 'bg-slate-100 hover:bg-slate-200'
                        : 'bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white text-xs font-semibold">
                      {user?.name ? getInitials(user.name) : 'U'}
                    </div>
                    <span className={`text-sm font-medium hidden sm:block ${
                      scrolled ? 'text-slate-700' : 'text-white'
                    }`}>
                      {user?.name || 'User'}
                    </span>
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                      <Link
                        href="/dashboard"
                        className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Dashboard
                      </Link>
                      <Link
                        href="/calculator"
                        className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Calculator
                      </Link>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          signOut();
                        }}
                        className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 border-t"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <button
                    onClick={() => openAuthModal('signin')}
                    className={`text-sm font-medium transition-colors ${
                      scrolled ? 'text-slate-600 hover:text-teal-600' : 'text-white/80 hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => openAuthModal('signup')}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600 transition-all"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 text-white pt-20 sm:pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 bg-teal-500/20 text-teal-300 text-xs font-semibold rounded-full">
                2,500+ Deals
              </span>
              <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 text-xs font-semibold rounded-full">
                Updated Weekly
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              Biotech Deal Database
            </h1>
            <p className="text-lg sm:text-xl text-neutral-300 mb-6">
              Browse real licensing deals across oncology, rare disease, and autoimmune.
              Filter by modality, phase, indication, and financial terms.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-400">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                SEC & Press Release Data
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Verified Financial Terms
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                2019-2026 Coverage
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deal Browser */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DealBrowser />
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={closeAuthModal}
        initialMode={authModalMode}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
