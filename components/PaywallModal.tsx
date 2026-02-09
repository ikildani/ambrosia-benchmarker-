'use client';

import { useState, useEffect } from 'react';
import { FREE_LIMIT } from '@/lib/usage';
import { SITE_CONFIG } from '@/lib/constants';
import { useTracking } from './TrackingProvider';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: 'limit_reached' | 'pro_feature';
}

export default function PaywallModal({ isOpen, onClose, reason }: PaywallModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ hours: 23, minutes: 59, seconds: 59 });
  const { trackUpgradeCtaClick, trackPaywallDismissed } = useTracking();

  // Countdown timer for urgency
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    trackPaywallDismissed();
    onClose();
  };

  const handleUpgrade = async () => {
    trackUpgradeCtaClick('paywall_modal');
    setIsLoading(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        handleClose();
        setTimeout(() => {
          document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch {
      handleClose();
      setTimeout(() => {
        document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-modal-title"
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up"
      >
        {/* Header with gradient */}
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-8 overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(20, 184, 166, 0.4) 1px, transparent 0)`,
              backgroundSize: '20px 20px'
            }} />
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/20 rounded-full blur-3xl" />

          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="relative text-center">
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 mb-5 shadow-lg shadow-teal-500/30">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>

            <h2 id="paywall-modal-title" className="text-2xl font-bold text-white mb-2">
              {reason === 'limit_reached'
                ? 'You\'re on a Roll!'
                : 'Unlock Full Access'}
            </h2>
            <p className="text-slate-300 text-sm">
              {reason === 'limit_reached'
                ? `You've used your ${FREE_LIMIT} free calculations. Upgrade to keep the momentum going.`
                : 'Get the complete picture with Pro features.'}
            </p>

            {/* Urgency Timer */}
            <div className="mt-5 inline-flex items-center gap-2 bg-amber-500/20 border border-amber-400/30 rounded-full px-4 py-2">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-amber-300 text-sm font-medium">
                Special offer ends in {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Social Proof */}
          <div className="flex items-center justify-center gap-2 mb-6 pb-6 border-b border-slate-100">
            <div className="flex -space-x-2">
              {['IK', 'CZ', 'ML', 'RJ'].map((initials, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold border-2 border-white"
                >
                  {initials}
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">127+ BD professionals</span> upgraded this month
            </p>
          </div>

          {/* Value Props with specific outcomes */}
          <div className="space-y-3 mb-6">
            {[
              { icon: '🎯', text: 'Find ideal partners 10x faster', subtext: 'AI-matched to your asset' },
              { icon: '💰', text: `Benchmark with ${SITE_CONFIG.dealsAnalyzed} real deals`, subtext: 'Know your worth before negotiating' },
              { icon: '📊', text: 'Patent cliff & pipeline insights', subtext: 'Understand partner motivation' },
              { icon: '📄', text: 'Board-ready PDF reports', subtext: 'Professional deliverables in seconds' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <span className="text-xl">{item.icon}</span>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{item.text}</p>
                  <p className="text-xs text-slate-500">{item.subtext}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pricing with anchor */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-lg text-slate-400 line-through">$199</span>
              <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">50% OFF</span>
            </div>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold text-slate-900">{SITE_CONFIG.proPriceDisplay}</span>
              <span className="text-slate-500">/month</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Less than one hour of consultant time</p>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleUpgrade}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold py-4 px-6 rounded-xl
                     shadow-lg shadow-teal-500/30 hover:shadow-xl hover:shadow-teal-500/40 transition-all duration-200
                     hover:from-teal-600 hover:to-cyan-600 hover:-translate-y-0.5
                     disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0
                     flex items-center justify-center gap-3 text-lg"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>Start Pro Trial</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>

          {/* Trust Signals */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>7-day money-back guarantee</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Secure checkout</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Cancel anytime</span>
            </div>
          </div>

          {/* Alternative CTA */}
          <button
            onClick={handleClose}
            className="w-full mt-4 text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
