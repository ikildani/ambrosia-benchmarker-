'use client';

import { useState } from 'react';
import { PRICING, DEAL_STATS } from '@/lib/config/constants';
import { usePromoCode } from '@/lib/hooks/usePromoCode';
import { generatePricingSchema } from '@/lib/seo/structured-data';

interface PricingProps {
  currentTier: 'free' | 'pro' | 'report';
  onSelectTier: (tier: 'free' | 'pro' | 'report') => void;
  userEmail?: string;
  userId?: string;
  initialPromoCode?: string;
}

export default function Pricing({ currentTier, onSelectTier, userEmail, userId, initialPromoCode }: PricingProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isManageLoading, setIsManageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    promoCode, setPromoCode, promoStatus, promoDiscount, promoId, promoError,
    validatePromoCode, clearPromo,
  } = usePromoCode(initialPromoCode);

  const hasValidPromo = promoStatus === 'valid' && promoDiscount?.percentOff === 100;

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          userId: userId,
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
      console.error('Checkout error:', err);
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
      console.error('Billing portal error:', err);
      setError('Connection error. Please try again.');
    } finally {
      setIsManageLoading(false);
    }
  };

  return (
    <section id="pricing" className="py-16 sm:py-20 lg:py-24 xl:py-28 px-4 xl:px-6 bg-white dark:bg-slate-900 scroll-mt-20 transition-colors duration-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generatePricingSchema()) }}
      />
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-12 lg:mb-16">
          <div className="inline-flex items-center gap-2 bg-teal-50 dark:bg-teal-500/20 border border-teal-200 dark:border-teal-500/30 rounded-full px-4 py-1.5 mb-6">
            <svg className="w-4 h-4 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-teal-700 dark:text-teal-400">Simple Pricing</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-neutral-900 dark:text-white mb-3 sm:mb-4">
            Choose Your Plan
          </h2>
          <p className="text-sm sm:text-base lg:text-lg text-neutral-600 dark:text-slate-400 max-w-2xl mx-auto">
            Unlimited free calculations. Pay only when you need the full picture.
          </p>
        </div>

        {/* Pricing Cards - Three columns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 xl:gap-8 max-w-5xl xl:max-w-6xl mx-auto">
          {/* Free Tier */}
          <div
            className={`relative bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl p-5 sm:p-6 xl:p-8 transition-all duration-300 ${
              currentTier === 'free'
                ? 'ring-2 ring-teal-500 shadow-glow-lg'
                : 'border border-neutral-200 dark:border-slate-700 shadow-soft hover:shadow-soft-lg hover:-translate-y-1'
            }`}
          >
            {currentTier === 'free' && (
              <div className="absolute -top-3 left-6">
                <span className="bg-teal-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-soft">
                  Current Plan
                </span>
              </div>
            )}

            <div className="mb-4">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">Free</h3>
              <p className="text-neutral-500 dark:text-slate-400 text-xs">Explore and calculate</p>
            </div>

            <div className="mb-5">
              <span className="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-white">$0</span>
              <span className="text-neutral-500 dark:text-slate-400 ml-1.5 text-sm">forever</span>
            </div>

            <ul className="space-y-2.5 mb-6">
              {[
                { included: true, text: 'Unlimited calculations' },
                { included: true, text: 'All metric headlines' },
                { included: true, text: 'Upfront card drill-down' },
                { included: true, text: '3 comparable deals' },
                { included: true, text: 'Top 2 sensitivity params' },
                { included: true, text: 'Risk factors' },
                { included: false, text: 'AI deal memo' },
                { included: false, text: 'Premium PDF / Excel' },
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  {item.included ? (
                    <div className="w-4 h-4 rounded-full bg-success-100 dark:bg-success-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-2.5 h-2.5 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-neutral-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-2.5 h-2.5 text-neutral-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  )}
                  <span className={`text-sm ${item.included ? 'text-neutral-700 dark:text-slate-200' : 'text-neutral-400 dark:text-slate-500'}`}>
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>

            <button
              onClick={(e) => { e.stopPropagation(); onSelectTier('free'); }}
              className={`w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
                currentTier === 'free'
                  ? 'bg-neutral-100 dark:bg-slate-700 text-neutral-500 dark:text-slate-400 cursor-default'
                  : 'bg-neutral-100 dark:bg-slate-700 text-neutral-700 dark:text-slate-200 hover:bg-neutral-200 dark:hover:bg-slate-600'
              }`}
            >
              {currentTier === 'free' ? 'Current Plan' : 'Select Free'}
            </button>
          </div>

          {/* Deal Report Tier */}
          <div className="relative bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl p-5 sm:p-6 xl:p-8 border-2 border-purple-300 dark:border-purple-500 shadow-soft hover:shadow-soft-lg hover:-translate-y-1 transition-all duration-300">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-soft whitespace-nowrap">
                Per Calculation
              </span>
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">{PRICING.REPORT_LABEL}</h3>
              <p className="text-neutral-500 dark:text-slate-400 text-xs">Board-ready deliverable</p>
            </div>

            <div className="mb-5">
              <span className="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-white">{PRICING.REPORT_PRICE}</span>
              <span className="text-neutral-500 dark:text-slate-400 ml-1.5 text-sm">one-time</span>
            </div>

            <ul className="space-y-2.5 mb-6">
              {[
                'AI-powered deal memo',
                'All card drill-downs',
                'Full comparable deals (15+)',
                'Complete sensitivity analysis',
                'Negotiation playbook',
                'Branded PDF report',
                'Excel data export',
                'Shareable link',
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm text-neutral-700 dark:text-slate-200">{item}</span>
                </li>
              ))}
            </ul>

            <p className="text-xs text-neutral-400 dark:text-slate-500 mb-3 text-center">Available after running a calculation</p>

            <button
              className="w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-200 bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 shadow-soft"
              onClick={() => {
                document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Run Calculation First
            </button>
          </div>

          {/* Pro Tier */}
          <div
            className={`relative bg-gradient-to-br from-navy-900 to-navy-800 rounded-xl sm:rounded-2xl p-5 sm:p-6 xl:p-8 transition-all duration-300 ${
              currentTier === 'pro'
                ? 'ring-2 ring-teal-500 shadow-glow-lg'
                : 'shadow-soft-xl hover:shadow-soft-xl hover:-translate-y-1'
            }`}
          >
            <div className="absolute -top-3 right-4">
              <span className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-soft">
                Best Value
              </span>
            </div>

            {currentTier === 'pro' && (
              <div className="absolute -top-3 left-6">
                <span className="bg-success-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-soft">
                  Current Plan
                </span>
              </div>
            )}

            <div className="mb-4">
              <h3 className="text-lg font-bold text-white mb-1">Pro</h3>
              <p className="text-neutral-400 text-xs">Complete deal intelligence</p>
            </div>

            {/* Promo Code Section */}
            {currentTier !== 'pro' && (
              <div className="mb-3">
                {promoStatus === 'valid' ? (
                  <div className="flex items-center gap-2 bg-teal-500/20 border border-teal-500/30 rounded-lg px-3 py-2">
                    <div className="w-4 h-4 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-teal-300 text-xs font-semibold flex-1">1 Month Free</span>
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

            <div className="mb-5">
              {hasValidPromo ? (
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-bold text-white">$0</span>
                    <span className="text-neutral-400 text-sm">/first mo</span>
                  </div>
                  <p className="text-teal-400 text-xs font-medium mt-0.5">
                    Then {PRICING.PRO_MONTHLY}
                  </p>
                </div>
              ) : (
                <>
                  <span className="text-3xl sm:text-4xl font-bold text-white">{PRICING.PRO_PRICE}</span>
                  <span className="text-neutral-400 ml-1.5 text-sm">/month</span>
                </>
              )}
            </div>

            <ul className="space-y-2.5 mb-6">
              {[
                'Everything in Report',
                'Unlimited full reports',
                'Scenario comparison',
                'Watchlist & deal alerts',
                'Weekly market digest',
                'Full partner profiles',
                'Priority support',
                'Cancel anytime',
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
                {isLoading ? 'Processing...' : hasValidPromo ? 'Start Free Month' : `Start Pro — ${PRICING.PRO_MONTHLY}`}
              </button>
            )}

            {error && (
              <div className="mt-3 p-2.5 bg-red-500/20 border border-red-400/30 rounded-lg">
                <p className="text-red-200 text-xs text-center">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Enterprise CTA */}
        <div className="mt-10 sm:mt-12 lg:mt-16 text-center">
          <div className="inline-flex flex-col sm:flex-row items-center gap-3 sm:gap-4 p-4 sm:p-6 bg-neutral-50 dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-neutral-200 dark:border-slate-700">
            <div className="text-center sm:text-left">
              <p className="font-semibold text-neutral-900 dark:text-white text-sm sm:text-base">Need enterprise features or custom analysis?</p>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-slate-400">Get tailored solutions for your organization</p>
            </div>
            <a
              href="mailto:info@ambrosiaventures.co?subject=Enterprise%20Inquiry"
              className="btn-secondary whitespace-nowrap"
            >
              Contact Sales
            </a>
          </div>
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
      </div>
    </section>
  );
}
