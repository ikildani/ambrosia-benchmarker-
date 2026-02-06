'use client';

import { useState, useEffect } from 'react';

interface StickyUpgradeBannerProps {
  tier: 'free' | 'pro';
  onUpgradeClick: () => void;
}

export default function StickyUpgradeBanner({ tier, onUpgradeClick }: StickyUpgradeBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Only show for free users after they've scrolled a bit
    if (tier !== 'free' || isDismissed) return;

    const handleScroll = () => {
      const scrolled = window.scrollY > 300;
      setIsVisible(scrolled);
    };

    // Check if dismissed in this session
    const dismissed = sessionStorage.getItem('upgrade_banner_dismissed');
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [tier, isDismissed]);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('upgrade_banner_dismissed', 'true');
  };

  if (tier !== 'free' || !isVisible || isDismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 animate-slide-up">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-t border-slate-700 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            {/* Left: Value prop */}
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="hidden sm:flex w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-sm sm:text-base">
                  Unlock full partner profiles, patent cliffs & unlimited calculations
                </p>
                <p className="text-slate-400 text-xs sm:text-sm">
                  127+ BD professionals upgraded this month
                </p>
              </div>
            </div>

            {/* Right: CTA */}
            <div className="flex items-center gap-3">
              <button
                onClick={onUpgradeClick}
                className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold px-5 py-2.5 rounded-xl
                         shadow-lg shadow-teal-500/30 hover:shadow-xl hover:shadow-teal-500/40
                         hover:from-teal-600 hover:to-cyan-600 transition-all duration-200
                         flex items-center gap-2 text-sm whitespace-nowrap"
              >
                <span>Upgrade to Pro</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
              <button
                onClick={handleDismiss}
                className="text-slate-500 hover:text-slate-300 transition-colors p-2"
                aria-label="Dismiss"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
