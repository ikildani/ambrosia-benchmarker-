'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { SignInButton, SignUpButton, UserButton, useUser } from '@clerk/nextjs';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const { isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-xl shadow-soft border-b border-neutral-100'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-24 lg:h-32">
          <a
            href="https://www.ambrosiaventures.co"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center group"
          >
            <Image
              src="/logo.png"
              alt="Ambrosia Ventures"
              width={440}
              height={121}
              className="h-16 sm:h-20 lg:h-24 w-auto object-contain transition-all duration-300 hover:opacity-80"
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
            {!isLoaded ? (
              <div className="w-24 h-10 bg-neutral-100 rounded-xl animate-pulse" />
            ) : isSignedIn ? (
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: 'w-10 h-10 ring-2 ring-teal-500/20',
                    userButtonPopoverCard: 'shadow-xl border border-neutral-200 rounded-xl',
                    userButtonPopoverActionButton: 'hover:bg-teal-50',
                  },
                }}
              />
            ) : (
              <>
                <SignInButton mode="modal">
                  <button className="text-sm font-medium text-neutral-600 hover:text-teal-600 transition-colors px-4 py-2">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 bg-gradient-to-r from-teal-600 to-cyan-500 text-white hover:from-teal-700 hover:to-cyan-600 shadow-soft hover:shadow-glow hover:-translate-y-0.5">
                    <span>Sign Up Free</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </SignUpButton>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
