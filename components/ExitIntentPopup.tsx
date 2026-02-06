'use client';

import { useState, useEffect, useCallback } from 'react';

interface ExitIntentPopupProps {
  tier: 'free' | 'pro';
  onUpgradeClick: () => void;
}

export default function ExitIntentPopup({ tier, onUpgradeClick }: ExitIntentPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  const handleExitIntent = useCallback((e: MouseEvent) => {
    // Only trigger when mouse leaves through top of viewport
    if (e.clientY <= 0 && !hasShown && tier === 'free') {
      // Check if already shown in this session
      const shown = sessionStorage.getItem('exit_intent_shown');
      if (!shown) {
        setIsOpen(true);
        setHasShown(true);
        sessionStorage.setItem('exit_intent_shown', 'true');
      }
    }
  }, [hasShown, tier]);

  useEffect(() => {
    if (tier !== 'free') return;

    // Don't show immediately, wait for user to engage
    const timeout = setTimeout(() => {
      document.addEventListener('mouseout', handleExitIntent);
    }, 10000); // Wait 10 seconds before enabling

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mouseout', handleExitIntent);
    };
  }, [tier, handleExitIntent]);

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleUpgrade = () => {
    setIsOpen(false);
    onUpgradeClick();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-amber-500 to-orange-500 px-6 py-8 text-center">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="text-5xl mb-4">👋</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Wait! Don't leave empty-handed
          </h2>
          <p className="text-amber-100">
            Get 20% off your first month of Pro
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-600 text-sm">Use code at checkout:</span>
              <span className="bg-slate-900 text-white font-mono font-bold px-3 py-1 rounded-lg text-sm">
                SAVE20
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">$79</span>
              <span className="text-slate-400 line-through">$99</span>
              <span className="text-slate-500 text-sm">/month for first month</span>
            </div>
          </div>

          <div className="space-y-2 mb-6">
            {[
              'Unlimited deal calculations',
              '5 AI-matched partner profiles',
              'Patent cliff & deal history data',
              'Downloadable PDF reports',
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleUpgrade}
            className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold py-4 px-6 rounded-xl
                     shadow-lg shadow-teal-500/30 hover:shadow-xl hover:from-teal-600 hover:to-cyan-600
                     transition-all duration-200 flex items-center justify-center gap-2"
          >
            <span>Claim 20% Discount</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>

          <button
            onClick={handleClose}
            className="w-full mt-3 text-sm text-slate-400 hover:text-slate-600 transition-colors py-2"
          >
            No thanks, I'll pay full price later
          </button>
        </div>
      </div>
    </div>
  );
}
