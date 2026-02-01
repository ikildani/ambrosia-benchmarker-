'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';

interface HeaderProps {
  isAuthenticated?: boolean;
  userName?: string;
  userEmail?: string;
  onSignInClick?: () => void;
  onSignUpClick?: () => void;
  onSignOut?: () => void;
  onDashboardClick?: () => void;
}

export default function Header({
  isAuthenticated = false,
  userName,
  userEmail,
  onSignInClick,
  onSignUpClick,
  onSignOut,
  onDashboardClick,
}: HeaderProps) {
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

  // Close menu when clicking outside
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

  return (
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
              width={900}
              height={248}
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
            {isAuthenticated ? (
              <div className="relative" ref={menuRef}>
                {/* User Avatar Button */}
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-3 p-1.5 pr-4 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all duration-200"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                    {userName ? getInitials(userName) : 'U'}
                  </div>
                  <span className="text-sm font-medium text-slate-700 hidden sm:block">
                    {userName || 'User'}
                  </span>
                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-fade-in">
                    {/* User Info Header */}
                    <div className="px-5 py-4 bg-gradient-to-br from-slate-50 to-slate-100 border-b border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white text-lg font-semibold shadow-md">
                          {userName ? getInitials(userName) : 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {userName || 'User'}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {userEmail || 'user@example.com'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          onDashboardClick?.();
                        }}
                        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
                          <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">Dashboard</p>
                          <p className="text-xs text-slate-500">View history & reports</p>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          onDashboardClick?.();
                        }}
                        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-xl bg-cyan-50 flex items-center justify-center">
                          <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">My Reports</p>
                          <p className="text-xs text-slate-500">Download PDF reports</p>
                        </div>
                      </button>

                      <a
                        href="#calculator"
                        onClick={() => setUserMenuOpen(false)}
                        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">Calculator</p>
                          <p className="text-xs text-slate-500">Run new analysis</p>
                        </div>
                      </a>
                    </div>

                    {/* Sign Out */}
                    <div className="border-t border-slate-200 p-2">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          onSignOut?.();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left hover:bg-red-50 transition-colors group"
                      >
                        <svg className="w-5 h-5 text-slate-400 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span className="text-sm font-medium text-slate-600 group-hover:text-red-600 transition-colors">
                          Sign Out
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={onSignInClick}
                  className="hidden sm:inline-flex items-center px-4 py-2 text-sm font-medium text-slate-600 hover:text-teal-600 transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={onSignUpClick}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200
                           bg-gradient-to-r from-teal-600 to-cyan-500 text-white hover:from-teal-700 hover:to-cyan-600 shadow-soft hover:shadow-glow hover:-translate-y-0.5"
                >
                  <span>Get Started</span>
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
  );
}
// Trigger redeploy Sat Jan 31 20:39:49 EST 2026
