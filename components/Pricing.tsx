'use client';

import { RADAR_PUBLIC } from '@/lib/radar/launch';
import { useState } from 'react';
import Link from 'next/link';
import { PRICING, DEAL_STATS, PORTFOLIO_PRICING, ENGINE_COUNT } from '@/lib/config/constants';
import { usePromoCode } from '@/lib/hooks/usePromoCode';
import { useProCheckout, useTrialEligibility } from '@/lib/hooks/useProCheckout';
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
  const [isManageLoading, setIsManageLoading] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('annual');
  const [manageError, setManageError] = useState<string | null>(null);
  // Promo codes arrive only from campaign links (?code=); anyone else can type
  // a code on the Stripe checkout page.
  const { promoStatus, promoDiscount, promoId, clearPromo } = usePromoCode(initialPromoCode);
  const hasPromo = promoStatus === 'valid' && !!promoId;
  const hasFreeMonthPromo = hasPromo && promoDiscount?.percentOff === 100;

  const { start, isLoading, error: checkoutError } = useProCheckout();
  const { eligible: trialEligible } = useTrialEligibility();
  // A campaign code is applied to a paid checkout; otherwise lead with the trial.
  const offerTrial = trialEligible && !hasPromo;
  const error = checkoutError || manageError;

  const handleStart = () => start({
    trial: offerTrial,
    billingInterval,
    source: 'pricing',
    promoCode: hasPromo ? promoId ?? undefined : undefined,
  });

  const priceLabel = billingInterval === 'annual' ? PRICING.PRO_ANNUAL_MONTHLY : PRICING.PRO_MONTHLY;

  const handleManageSubscription = async () => {
    setIsManageLoading(true);
    setManageError(null);
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
        setManageError(data.error);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setManageError('Unable to open billing portal. Please try again.');
      }
    } catch (err) {
      captureClientError(err, 'Pricing', { context: 'Billing portal request failed' });
      setManageError('Connection error. Please try again.');
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

        {/* HERO: Deal Intelligence Brief */}
        <div className="relative bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl p-8 sm:p-10 lg:p-12 border-2 border-teal-300 dark:border-teal-500 shadow-soft-xl transition-all duration-300 mb-6">
          <div className="text-center mb-6">
            <h3 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white mb-2">Deal Intelligence Brief</h3>
            <p className="text-neutral-500 dark:text-slate-400 text-sm sm:text-base">One asset, one decision — built for you within 24 hours of the intake call</p>
          </div>

          <div className="text-center mb-8">
            <span className="text-5xl sm:text-6xl font-bold text-neutral-900 dark:text-white">$2,500</span>
            <span className="text-neutral-500 dark:text-slate-400 ml-2 text-base sm:text-lg">one-time</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 mb-8 max-w-lg mx-auto">
            {[
              'A signed recommendation: ask, floor, walk-away',
              'Valuation bridge reconciled to one number',
              'Cited comparables, phase-matched',
              'Buyers ranked on evidence, not a match score',
              'Catalyst calendar and go-to-market window',
              'Managing Partner review and 30-minute walkthrough',
            ].map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 list-none">
                <div className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm sm:text-base text-neutral-700 dark:text-slate-200">{item}</span>
              </li>
            ))}
          </div>

          <div className="text-center">
            <a
              href="/brief"
              className="inline-flex items-center justify-center px-10 py-3.5 rounded-xl font-bold text-base transition-all duration-200 bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600 shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5"
            >
              Configure Your Brief
            </a>
            <p className="text-xs text-neutral-400 dark:text-slate-500 mt-3">About 30 data-backed pages · Invoiced at intake · Credited in full against a subsequent advisory mandate</p>
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
                {hasFreeMonthPromo ? (
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

              {hasPromo && currentTier !== 'pro' && (
                <div className="mb-4 flex items-center gap-2 bg-teal-500/20 border border-teal-500/30 rounded-lg px-3 py-2">
                  <span className="text-teal-300 text-xs font-semibold flex-1">
                    Code applied{promoDiscount?.name ? `: ${promoDiscount.name}` : ''}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); clearPromo(); }}
                    className="text-teal-400/60 hover:text-teal-300 text-xs"
                    aria-label="Remove promo code"
                  >
                    Remove
                  </button>
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
                <div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleStart(); }}
                    disabled={isLoading}
                    aria-busy={isLoading}
                    className="w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-400 hover:to-cyan-400 shadow-soft hover:shadow-soft-lg disabled:opacity-60"
                  >
                    {isLoading
                      ? 'Opening secure checkout...'
                      : offerTrial
                        ? 'Start 7-day free trial'
                        : hasFreeMonthPromo
                          ? 'Start your free month'
                          : `Start Pro — ${priceLabel}`}
                  </button>
                  <p className="mt-2 text-[11px] leading-snug text-neutral-400 text-center">
                    {offerTrial
                      ? `$0 today, then ${priceLabel}. We email you 3 days before the first charge. Cancel anytime.`
                      : 'Secure checkout by Stripe. Cancel anytime.'}
                  </p>
                </div>
              )}

              {error && (
                <div className="mt-3 p-2.5 bg-red-500/20 border border-red-400/30 rounded-lg">
                  <p className="text-red-200 text-xs text-center">{error}</p>
                </div>
              )}
            </div>

            {/* Right: compact feature list */}
            <div className="lg:flex-1">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">What Pro includes</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  'Unlimited full reports',
                  ...(RADAR_PUBLIC ? ['Search & Evaluation asset screening'] : []),
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

        {/* Deal Intelligence Brief CTA — concierge benchmark product */}
        <div className="text-center mb-6">
          <Link
            href="/brief"
            className="group inline-flex flex-col sm:flex-row items-center gap-3 sm:gap-5 p-4 sm:p-6 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/40 dark:to-cyan-950/40 rounded-xl sm:rounded-2xl border border-teal-200 dark:border-teal-500/30 hover:border-teal-400 dark:hover:border-teal-400/60 hover:shadow-lg hover:shadow-teal-500/10 transition-all"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="hidden sm:flex w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 items-center justify-center shadow-md shadow-teal-500/30">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-white"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
              </div>
              <div className="text-center sm:text-left">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <p className="font-semibold text-neutral-900 dark:text-white text-sm sm:text-base">Need a decision for one asset? Get a Deal Intelligence Brief.</p>
                  <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-teal-500/15 text-teal-600 dark:text-teal-300 rounded-full border border-teal-500/20">New</span>
                </div>
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-slate-400 mt-0.5">
                  $2,500 — one scored recommendation, cited comparables, evidence-ranked buyers, 30-minute walkthrough; credited in full against a subsequent advisory mandate
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-teal-600 to-cyan-600 rounded-lg shadow-md shadow-teal-500/25 group-hover:shadow-teal-500/40 group-hover:-translate-y-0.5 transition-all whitespace-nowrap">
              Learn More
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </span>
          </Link>
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
            { stat: String(ENGINE_COUNT), label: 'Valuation engines' },
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
            <span className="text-xs sm:text-sm font-medium">Cancel Anytime</span>
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
            Just exploring? The Free plan includes 3 benchmarks a month →
          </button>
        </div>
      </div>
    </section>
  );
}
