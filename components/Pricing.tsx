'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { PRICING, DEAL_STATS, PORTFOLIO_PRICING } from '@/lib/config/constants';
import { usePromoCode } from '@/lib/hooks/usePromoCode';
import { generatePricingSchema } from '@/lib/seo/structured-data';
import { captureClientError } from '@/lib/sentry-client';
import type { UserTier } from '@/types/tier';

interface PricingProps {
  currentTier: UserTier;
  onSelectTier: (tier: UserTier) => void;
  userEmail?: string;
  userId?: string;
  initialPromoCode?: string;
}

export default function Pricing({ currentTier, onSelectTier, userEmail, userId, initialPromoCode }: PricingProps) {
  const { isAuthenticated, openAuthModal, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isManageLoading, setIsManageLoading] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [error, setError] = useState<string | null>(null);
  const pendingCheckoutRef = useRef(false);
  const {
    promoCode, setPromoCode, promoStatus, promoDiscount, promoId, promoError,
    validatePromoCode, clearPromo,
  } = usePromoCode(initialPromoCode);

  const hasValidPromo = promoStatus === 'valid' && promoDiscount?.percentOff === 100;

  // Resume checkout once the user signs in via the auth modal. Mirrors
  // ProCheckoutButton so the subscription is always tied to an account —
  // a checkout without a userId orphans the Pro entitlement at the webhook.
  useEffect(() => {
    if (isAuthenticated && pendingCheckoutRef.current) {
      pendingCheckoutRef.current = false;
      handleUpgrade();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleUpgrade = async () => {
    // Require an account BEFORE checkout. Without an authenticated user the
    // Stripe webhook has no user_profiles row to upgrade and the paid Pro
    // tier is lost, forcing a post-payment signup + email verification.
    if (!isAuthenticated) {
      pendingCheckoutRef.current = true;
      openAuthModal('signup');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user?.email || userEmail,
          userId: user?.id || userId,
          billingInterval,
          promoCode: promoId || undefined,
        }),
      });
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      if (data.demo) {
        setError('Payment system is being configured. Please contact info@ambrosiaventures.co to upgrade.');
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('Unable to start checkout. Please try again.');
      }
    } catch (err) {
      captureClientError(err, 'Pricing', { context: 'Checkout request failed' });
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsManageLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          userId: userId,
        }),
      });
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('Unable to open billing portal. Please try again.');
      }
    } catch (err) {
      captureClientError(err, 'Pricing', { context: 'Billing portal request failed' });
      setError('Connection error. Please try again.');
    } finally {
      setIsManageLoading(false);
    }
  };

  return (
    <section className="py-16 sm:py-20 lg:py-24 xl:py-28 px-4 xl:px-6 bg-white dark:bg-slate-900 scroll-mt-20 transition-colors duration-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generatePricingSchema()) }}
      />
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-12 lg:mb-14">
          <div className="inline-flex items-center gap-2 bg-purple-50 dark:bg-purple-500/20 border border-purple-200 dark:border-purple-500/30 rounded-full px-4 py-1.5 mb-6">
            <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium text-purple-700 dark:text-purple-400">Deal Intelligence</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold font-display text-neutral-900 dark:text-white mb-3 sm:mb-4">
            Get deal benchmarks for your next licensing conversation
          </h2>
          <p className="text-sm sm:text-base lg:text-lg text-neutral-600 dark:text-slate-400 max-w-2xl mx-auto">
            One report. One deal. Everything you need to walk in prepared.
          </p>
        </div>

        {/* HERO: Deal Report Card */}
        <div className="relative bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl p-8 sm:p-10 lg:p-12 border-2 border-purple-300 dark:border-purple-500 shadow-soft-xl transition-all duration-300 mb-6">
          {currentTier === 'report' && (
            <div className="absolute -top-3 left-8">
              <span className="bg-purple-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-soft">
                Current Plan
              </span>
            </div>
          )}

          <div className="text-center mb-6">
            <h3 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white mb-2">Deal Intelligence Report</h3>
            <p className="text-neutral-500 dark:text-slate-400 text-sm sm:text-base">Everything you need for your next deal conversation</p>
          </div>

          <div className="text-center mb-8">
            <span className="text-5xl sm:text-6xl font-bold text-neutral-900 dark:text-white">{PRICING.REPORT_PRICE}</span>
            <span className="text-neutral-500 dark:text-slate-400 ml-2 text-base sm:text-lg">one-time</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 mb-8 max-w-lg mx-auto">
            {[
              'Institutional deal memo',
              'All card drill-downs',
              'Full comparable deals (15+)',
              'Complete sensitivity analysis',
              'Negotiation playbook',
              'Branded PDF report',
              'Excel data export',
              'Shareable link',
            ].map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 list-none">
                <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm sm:text-base text-neutral-700 dark:text-slate-200">{item}</span>
              </li>
            ))}
          </div>

          <div className="text-center">
            <a
              href="/report"
              className="inline-flex items-center justify-center px-10 py-3.5 rounded-xl font-bold text-base transition-all duration-200 bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5"
            >
              Get Your Report
            </a>
            <p className="text-xs text-neutral-400 dark:text-slate-500 mt-3">Personalized deal intelligence in 60 seconds</p>
          </div>
        </div>

        {/* SECONDARY: Pro Card — horizontal layout */}
        <div
          className={`relative bg-gradient-to-br from-navy-900 to-navy-800 rounded-xl sm:rounded-2xl p-6 sm:p-8 transition-all duration-300 mb-6 ${
            currentTier === 'pro'
              ? 'ring-2 ring-teal-500 shadow-glow-lg'
              : 'shadow-soft'
          }`}
        >
          {currentTier === 'pro' && (
            <div className="absolute -top-3 left-6">
              <span className="bg-success-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-soft">
                Current Plan
              </span>
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-start lg:gap-10">
            {/* Left: headline + price + toggle */}
            <div className="lg:flex-shrink-0 lg:w-64 mb-6 lg:mb-0">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-1">Running multiple deals? Go Pro.</h3>
              <p className="text-neutral-400 text-xs sm:text-sm mb-4">Unlimited reports, market intelligence, and partner matching</p>

              {/* Billing Toggle */}
              <div className="flex items-center gap-3 mb-4">
                <span className={`text-xs font-medium ${billingInterval === 'monthly' ? 'text-white' : 'text-neutral-500'}`}>
                  Monthly
                </span>
                <button
                  onClick={() => setBillingInterval(billingInterval === 'monthly' ? 'annual' : 'monthly')}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${billingInterval === 'annual' ? 'bg-teal-500' : 'bg-white/20'}`}
                  aria-label={`Switch to ${billingInterval === 'monthly' ? 'annual' : 'monthly'} billing`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${billingInterval === 'annual' ? 'translate-x-6' : ''}`} />
                </button>
                <span className={`text-xs font-medium ${billingInterval === 'annual' ? 'text-white' : 'text-neutral-500'}`}>
                  Annual
                </span>
                {billingInterval === 'annual' && (
                  <span className="text-xs font-semibold text-teal-400 bg-teal-500/20 px-2 py-0.5 rounded-full">
                    Save {PRICING.PRO_ANNUAL_SAVINGS}/yr
                  </span>
                )}
              </div>

              <div className="mb-4">
                {hasValidPromo ? (
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-white">$0</span>
                      <span className="text-neutral-400 text-sm">/first mo</span>
                    </div>
                    <p className="text-teal-400 text-xs font-medium mt-0.5">
                      Then {billingInterval === 'annual' ? PRICING.PRO_ANNUAL_MONTHLY : PRICING.PRO_MONTHLY}
                    </p>
                  </div>
                ) : billingInterval === 'annual' ? (
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-white">${PRICING.PRO_ANNUAL_MONTHLY_NUM}</span>
                      <span className="text-neutral-400 text-sm">/month</span>
                    </div>
                    <p className="text-teal-400 text-xs font-medium mt-0.5">
                      {PRICING.PRO_ANNUAL_PRICE}/yr &middot; Save {PRICING.PRO_ANNUAL_SAVINGS}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-baseline">
                    <span className="text-3xl font-bold text-white">{PRICING.PRO_PRICE}</span>
                    <span className="text-neutral-400 ml-1.5 text-sm">/month</span>
                  </div>
                )}
              </div>

              {/* Promo Code Section */}
              {currentTier !== 'pro' && (
                <div className="mb-4">
                  {promoStatus === 'valid' ? (
                    <div className="flex items-center gap-2 bg-teal-500/20 border border-teal-500/30 rounded-lg px-3 py-2">
                      <div className="w-4 h-4 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-teal-300 text-xs font-semibold flex-1">7-Day Free Trial</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); clearPromo(); }}
                        className="text-teal-400/50 hover:text-teal-300"
                        aria-label="Remove promo code"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(e.target.value);
                          if (promoStatus !== 'idle') {
                            clearPromo();
                            setPromoCode(e.target.value);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            validatePromoCode(promoCode);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Promo code"
                        aria-label="Promo code"
                        className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-xs
                                   placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-teal-500
                                   focus:border-transparent transition-all"
                        maxLength={20}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); validatePromoCode(promoCode); }}
                        disabled={!promoCode.trim() || promoStatus === 'validating'}
                        className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-xs
                                   font-medium hover:bg-white/20 transition-all disabled:opacity-40
                                   disabled:cursor-not-allowed"
                      >
                        {promoStatus === 'validating' ? '...' : 'Apply'}
                      </button>
                    </div>
                  )}
                  {promoStatus === 'invalid' && promoError && (
                    <p className="text-red-400 text-xs mt-1 ml-1">{promoError}</p>
                  )}
                </div>
              )}

              {currentTier === 'pro' ? (
                <button
                  onClick={(e) => { e.stopPropagation(); handleManageSubscription(); }}
                  disabled={isManageLoading}
                  className="w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 bg-white/10 text-white hover:bg-white/20 border border-white/20"
                >
                  {isManageLoading ? 'Loading...' : 'Manage Subscription'}
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); handleUpgrade(); }}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 bg-white text-neutral-900 hover:bg-neutral-100 shadow-soft hover:shadow-soft-lg"
                >
                  {isLoading ? 'Processing...' : hasValidPromo ? 'Start Free Month' : billingInterval === 'annual' ? `Start Pro — ${PRICING.PRO_ANNUAL_MONTHLY}` : `Start Pro — ${PRICING.PRO_MONTHLY}`}
                </button>
              )}

              {error && (
                <div className="mt-3 p-2.5 bg-red-500/20 border border-red-400/30 rounded-lg">
                  <p className="text-red-200 text-xs text-center">{error}</p>
                </div>
              )}
            </div>

            {/* Right: compact feature list */}
            <div className="lg:flex-1">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Everything in Report, plus:</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  'Unlimited full reports',
                  'Scenario comparison',
                  'Market Pulse intelligence',
                  'Company Intelligence profiles',
                  'AI Partner Matching',
                  'Watchlist & deal alerts',
                  'Weekly market digest',
                  'Priority support',
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-2.5 h-2.5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-neutral-200 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Portfolio License CTA — multi-seat for VC firms */}
        <div className="text-center">
          <Link
            href="/portfolio"
            className="group inline-flex flex-col sm:flex-row items-center gap-3 sm:gap-5 p-4 sm:p-6 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/40 rounded-xl sm:rounded-2xl border border-indigo-200 dark:border-indigo-500/30 hover:border-indigo-400 dark:hover:border-indigo-400/60 hover:shadow-lg hover:shadow-indigo-500/10 transition-all"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="hidden sm:flex w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 items-center justify-center shadow-md shadow-indigo-500/30">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-white"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>
              </div>
              <div className="text-center sm:text-left">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <p className="font-semibold text-neutral-900 dark:text-white text-sm sm:text-base">Running a fund? Equip every portfolio company.</p>
                  <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 rounded-full border border-indigo-500/20">New</span>
                </div>
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-slate-400 mt-0.5">
                  Portfolio License — multi-seat access from {PORTFOLIO_PRICING.GROWTH_PER_SEAT}/seat/mo + fund-level intelligence
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-lg shadow-md shadow-indigo-500/25 group-hover:shadow-indigo-500/40 group-hover:-translate-y-0.5 transition-all whitespace-nowrap">
              Explore Portfolio
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </span>
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-12 sm:mt-16 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-8 max-w-2xl mx-auto">
          {[
            { stat: DEAL_STATS.TOTAL_DEALS, label: 'Real deals analyzed' },
            { stat: '127+', label: 'BD pros upgraded' },
            { stat: '10x', label: 'Faster partner research' },
          ].map((item, i) => (
            <div key={i} className="text-center">
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent">
                {item.stat}
              </p>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-slate-400 mt-1">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Trust Badges */}
        <div className="mt-10 sm:mt-12 lg:mt-16 flex flex-wrap justify-center items-center gap-4 sm:gap-6 lg:gap-8 opacity-60">
          <div className="flex items-center gap-1.5 sm:gap-2 text-neutral-500 dark:text-slate-400">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-xs sm:text-sm font-medium">Secure Payments</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-neutral-500 dark:text-slate-400">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-xs sm:text-sm font-medium">7-Day Money-Back Guarantee</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-neutral-500 dark:text-slate-400">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="text-xs sm:text-sm font-medium">Powered by Stripe</span>
          </div>
        </div>

        {/* Free fallback — bottom, subtle */}
        <div className="mt-10 text-center">
          <button
            onClick={(e) => { e.stopPropagation(); onSelectTier('free'); }}
            className="text-xs text-neutral-400 dark:text-slate-500 hover:text-neutral-600 dark:hover:text-slate-300 transition-colors"
          >
            Just exploring? Try the calculator free — no account required →
          </button>
        </div>
      </div>
    </section>
  );
}
