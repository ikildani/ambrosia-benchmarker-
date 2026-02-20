'use client';

import Link from 'next/link';
import AmbrosiaLogo from '@/components/AmbrosiaLogo';
import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';

// Avatar gradient options - premium color combinations (synced with Dashboard.tsx)
const AVATAR_GRADIENTS = [
  { id: 'ocean', from: 'from-cyan-500', to: 'to-blue-600', label: 'Ocean' },
  { id: 'aurora', from: 'from-violet-500', to: 'to-fuchsia-500', label: 'Aurora' },
  { id: 'sunset', from: 'from-orange-400', to: 'to-rose-500', label: 'Sunset' },
  { id: 'forest', from: 'from-emerald-500', to: 'to-teal-600', label: 'Forest' },
  { id: 'midnight', from: 'from-indigo-600', to: 'to-purple-700', label: 'Midnight' },
  { id: 'slate', from: 'from-slate-500', to: 'to-zinc-600', label: 'Slate' },
];

function getAvatarGradient(id: string | null) {
  return AVATAR_GRADIENTS.find(g => g.id === id) || AVATAR_GRADIENTS[0];
}

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
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [avatarGradientId, setAvatarGradientId] = useState<string>('ocean');
  const menuRef = useRef<HTMLDivElement>(null);

  // Load avatar from localStorage
  useEffect(() => {
    const userData = localStorage.getItem('user_data');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        if (parsed.avatarGradient) {
          setAvatarGradientId(parsed.avatarGradient);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  // Determine if we're on the landing page
  const isLandingPage = pathname === '/';
  const isCalculatorPage = pathname === '/calculator';
  const isDashboardPage = pathname === '/dashboard';
  const isPulsePage = pathname === '/pulse';
  const isCompaniesPage = pathname?.startsWith('/companies');

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

  // Focus first menu item when dropdown opens
  useEffect(() => {
    if (userMenuOpen && menuRef.current) {
      const firstItem = menuRef.current.querySelector<HTMLElement>('[role="menu"] a[href], [role="menu"] button:not([disabled])');
      // Delay to allow the menu to render
      requestAnimationFrame(() => {
        firstItem?.focus();
      });
    }
  }, [userMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Keyboard navigation for dropdown menu
  const handleDropdownKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const menuContainer = menuRef.current;
    if (!menuContainer || !userMenuOpen) return;

    const focusableSelectors = 'a[href], button:not([disabled])';
    const focusableItems = Array.from(
      menuContainer.querySelectorAll<HTMLElement>(focusableSelectors)
    ).filter(el => {
      // Exclude the toggle button itself (first button is the avatar trigger)
      return el.closest('[role="menu"]') !== null;
    });

    if (focusableItems.length === 0) return;

    const currentIndex = focusableItems.indexOf(document.activeElement as HTMLElement);

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const nextIndex = currentIndex < focusableItems.length - 1 ? currentIndex + 1 : 0;
        focusableItems[nextIndex]?.focus();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : focusableItems.length - 1;
        focusableItems[prevIndex]?.focus();
        break;
      }
      case 'Escape': {
        e.preventDefault();
        setUserMenuOpen(false);
        // Return focus to the trigger button
        const triggerButton = menuContainer.querySelector<HTMLButtonElement>('[aria-haspopup="true"]');
        triggerButton?.focus();
        break;
      }
      case 'Enter':
      case ' ': {
        // Let the default behavior handle activation of links/buttons
        // Only preventDefault for Space to avoid page scroll
        if (e.key === ' ') {
          e.preventDefault();
          (document.activeElement as HTMLElement)?.click();
        }
        break;
      }
      default:
        return;
    }
  }, [userMenuOpen]);

  // Navigation items with proper routing
  const navItems = [
    {
      label: 'Calculator',
      href: '/calculator',
      isActive: isCalculatorPage,
    },
    {
      label: 'Pulse',
      href: '/pulse',
      isActive: isPulsePage,
      badge: 'PRO',
    },
    {
      label: 'Companies',
      href: '/companies',
      isActive: isCompaniesPage,
      badge: 'PRO',
    },
    {
      label: 'Pricing',
      href: isLandingPage ? '#pricing' : '/#pricing',
      isActive: false,
    },
    {
      label: 'About',
      href: isLandingPage ? '#about' : '/#about',
      isActive: false,
    },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-soft border-b border-neutral-100 dark:border-slate-800'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20 lg:h-24">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center group"
          >
            <AmbrosiaLogo variant="color" height={40} />
          </Link>

          {/* Desktop Navigation */}
          <nav aria-label="Main navigation" className="hidden md:flex items-center gap-4 md:gap-6 lg:gap-8">
            {navItems.map((item, idx) => (
              item.href.startsWith('#') || item.href.includes('#') ? (
                <a
                  key={idx}
                  href={item.href}
                  className={`text-sm font-medium transition-colors ${
                    item.isActive
                      ? 'text-teal-600 dark:text-teal-400'
                      : 'text-neutral-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400'
                  }`}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={idx}
                  href={item.href}
                  className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    item.isActive
                      ? 'text-teal-600 dark:text-teal-400'
                      : 'text-neutral-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400'
                  }`}
                >
                  {item.label}
                  {item.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-gradient-to-r from-teal-500 to-cyan-500 text-white leading-none">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            ))}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="relative" ref={menuRef} onKeyDown={handleDropdownKeyDown}>
                {/* User Avatar Button */}
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-label="User menu"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                  className="flex items-center gap-3 p-1.5 pr-4 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all duration-200"
                >
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarGradient(avatarGradientId).from} ${getAvatarGradient(avatarGradientId).to} flex items-center justify-center text-white text-sm font-semibold shadow-sm`}>
                    {userName ? getInitials(userName) : 'U'}
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 hidden sm:block">
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
                  <div role="menu" aria-label="User actions" className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-72 max-w-[288px] bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-fade-in">
                    {/* User Info Header */}
                    <div className="px-5 py-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 border-b border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarGradient(avatarGradientId).from} ${getAvatarGradient(avatarGradientId).to} flex items-center justify-center text-white text-lg font-semibold shadow-md`}>
                          {userName ? getInitials(userName) : 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {userName || 'User'}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {userEmail || 'user@example.com'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <Link
                        href="/dashboard"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                        className={`w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
                          isDashboardPage ? 'bg-slate-50 dark:bg-slate-700' : ''
                        }`}
                      >
                        <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-500/20 flex items-center justify-center">
                          <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Dashboard</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">View history & reports</p>
                        </div>
                      </Link>

                      <Link
                        href="/calculator"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                        className={`w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
                          isCalculatorPage ? 'bg-slate-50 dark:bg-slate-700' : ''
                        }`}
                      >
                        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                          <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Calculator</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Run new analysis</p>
                        </div>
                      </Link>
                    </div>

                    {/* Sign Out */}
                    <div className="border-t border-slate-200 dark:border-slate-700 p-2">
                      <button
                        role="menuitem"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onSignOut?.();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors group"
                      >
                        <svg className="w-5 h-5 text-slate-400 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
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
                  className="hidden sm:inline-flex items-center px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
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

            {/* Mobile Menu Button - Larger touch target */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-3 -mr-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors touch-feedback rounded-xl"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation - Full-screen overlay */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-16 sm:top-20 bg-white dark:bg-slate-900 z-50 animate-mobile-menu overflow-y-auto safe-bottom">
            <nav aria-label="Mobile navigation" className="flex flex-col p-4 gap-1">
              {navItems.map((item, idx) => {
                const iconMap: Record<string, JSX.Element> = {
                  Calculator: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  ),
                  Pricing: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  Pulse: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  ),
                  Companies: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  ),
                  About: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                };

                return item.href.startsWith('#') || item.href.includes('#') ? (
                  <a
                    key={idx}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-4 px-4 py-4 rounded-2xl font-medium transition-colors touch-feedback ${
                      item.isActive
                        ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      item.isActive ? 'bg-teal-100 dark:bg-teal-500/30' : 'bg-slate-100 dark:bg-slate-800'
                    }`}>
                      {iconMap[item.label] || iconMap.About}
                    </div>
                    <span className="text-base">{item.label}</span>
                  </a>
                ) : (
                  <Link
                    key={idx}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-4 px-4 py-4 rounded-2xl font-medium transition-colors touch-feedback ${
                      item.isActive
                        ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      item.isActive ? 'bg-teal-100 dark:bg-teal-500/30' : 'bg-slate-100 dark:bg-slate-800'
                    }`}>
                      {iconMap[item.label] || iconMap.About}
                    </div>
                    <span className="text-base">{item.label}</span>
                  </Link>
                );
              })}

              {isAuthenticated ? (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-4 px-4 py-4 rounded-2xl font-medium transition-colors touch-feedback ${
                      isDashboardPage
                        ? 'bg-teal-50 text-teal-600'
                        : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isDashboardPage ? 'bg-teal-100' : 'bg-slate-100'
                    }`}>
                      <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                    </div>
                    <span className="text-base">Dashboard</span>
                  </Link>

                  {/* User Info Card */}
                  <div className="my-4 px-4 py-3 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarGradient(avatarGradientId).from} ${getAvatarGradient(avatarGradientId).to} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
                        {userName ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{userName || 'User'}</p>
                        <p className="text-sm text-slate-500 truncate">{userEmail || 'user@example.com'}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onSignOut?.();
                    }}
                    className="flex items-center gap-4 px-4 py-4 rounded-2xl text-red-600 hover:bg-red-50 active:bg-red-100 font-medium transition-colors touch-feedback"
                  >
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </div>
                    <span className="text-base">Sign Out</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="my-4 border-t border-slate-200" />
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onSignInClick?.();
                    }}
                    className="flex items-center gap-4 px-4 py-4 rounded-2xl text-slate-700 hover:bg-slate-50 active:bg-slate-100 font-medium transition-colors touch-feedback"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                    </div>
                    <span className="text-base">Sign In</span>
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onSignUpClick?.();
                    }}
                    className="flex items-center justify-center gap-2 mx-4 py-4 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-500 text-white font-semibold transition-all shadow-lg shadow-teal-500/25 touch-feedback active:scale-[0.98]"
                  >
                    <span className="text-base">Get Started Free</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
