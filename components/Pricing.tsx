'use client';

import { useState } from 'react';

interface PricingProps {
  currentTier: 'free' | 'pro';
  onSelectTier: (tier: 'free' | 'pro') => void;
}

export default function Pricing({ currentTier, onSelectTier }: PricingProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <section id="pricing" className="py-24 px-4 bg-white scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-full px-4 py-1.5 mb-6">
            <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-teal-700">Simple Pricing</span>
          </div>
          <h2 className="text-4xl font-bold text-neutral-900 mb-4">
            Choose Your Plan
          </h2>
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
            Get instant deal benchmarks for free, or unlock comprehensive insights with Pro
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Tier */}
          <div
            className={`relative bg-white rounded-2xl p-8 transition-all duration-300 cursor-pointer ${
              currentTier === 'free'
                ? 'ring-2 ring-teal-500 shadow-glow-lg'
                : 'border border-neutral-200 shadow-soft hover:shadow-soft-lg hover:border-neutral-300'
            }`}
            onClick={() => onSelectTier('free')}
          >
            {currentTier === 'free' && (
              <div className="absolute -top-3 left-6">
                <span className="bg-teal-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-soft">
                  Current Plan
                </span>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Free</h3>
              <p className="text-neutral-500 text-sm">Perfect for initial exploration</p>
            </div>

            <div className="mb-8">
              <span className="text-5xl font-bold text-neutral-900">$0</span>
              <span className="text-neutral-500 ml-2">forever</span>
            </div>

            <ul className="space-y-4 mb-8">
              {[
                { included: true, text: 'Basic deal term ranges' },
                { included: true, text: 'Upfront payment estimates' },
                { included: true, text: 'Total deal value calculations' },
                { included: true, text: 'All phases & modalities' },
                { included: false, text: 'Milestone breakdowns' },
                { included: false, text: 'Royalty rate analysis' },
                { included: false, text: 'Downloadable reports' },
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  {item.included ? (
                    <div className="w-5 h-5 rounded-full bg-success-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  )}
                  <span className={item.included ? 'text-neutral-700' : 'text-neutral-400'}>
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>

            <button
              onClick={(e) => { e.stopPropagation(); onSelectTier('free'); }}
              className={`w-full py-3.5 px-6 rounded-xl font-semibold transition-all duration-200 ${
                currentTier === 'free'
                  ? 'bg-neutral-100 text-neutral-500 cursor-default'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {currentTier === 'free' ? 'Current Plan' : 'Select Free'}
            </button>
          </div>

          {/* Pro Tier */}
          <div
            className={`relative bg-gradient-to-br from-navy-900 to-navy-800 rounded-2xl p-8 transition-all duration-300 cursor-pointer ${
              currentTier === 'pro'
                ? 'ring-2 ring-teal-500 shadow-glow-lg'
                : 'shadow-soft-xl hover:shadow-soft-xl hover:-translate-y-1'
            }`}
            onClick={() => handleUpgrade()}
          >
            <div className="absolute -top-3 right-6">
              <span className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-soft">
                Most Popular
              </span>
            </div>

            {currentTier === 'pro' && (
              <div className="absolute -top-3 left-6">
                <span className="bg-success-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-soft">
                  Current Plan
                </span>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-xl font-bold text-white mb-2">Pro</h3>
              <p className="text-neutral-400 text-sm">Complete deal intelligence</p>
            </div>

            <div className="mb-8">
              <span className="text-5xl font-bold text-white">$99</span>
              <span className="text-neutral-400 ml-2">/month</span>
            </div>

            <ul className="space-y-4 mb-8">
              {[
                'Everything in Free',
                'Full milestone breakdowns',
                'Royalty rate analysis',
                'Downloadable PDF reports',
                'Competitive positioning insights',
                'Priority email support',
                'Unlimited calculations',
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-neutral-200">{item}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={(e) => { e.stopPropagation(); handleUpgrade(); }}
              disabled={isLoading || currentTier === 'pro'}
              className={`w-full py-3.5 px-6 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                currentTier === 'pro'
                  ? 'bg-teal-500/20 text-teal-300 cursor-default'
                  : 'bg-white text-neutral-900 hover:bg-neutral-100 shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5'
              }`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Processing...</span>
                </>
              ) : currentTier === 'pro' ? (
                'Current Plan'
              ) : (
                <>
                  <span>Upgrade to Pro</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>

            {error && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-400/30 rounded-lg">
                <p className="text-red-200 text-sm text-center">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Enterprise CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-6 bg-neutral-50 rounded-2xl border border-neutral-200">
            <div className="text-center sm:text-left">
              <p className="font-semibold text-neutral-900">Need enterprise features or custom analysis?</p>
              <p className="text-sm text-neutral-500">Get tailored solutions for your organization</p>
            </div>
            <a
              href="mailto:info@ambrosiaventures.co?subject=Enterprise%20Inquiry"
              className="btn-secondary whitespace-nowrap"
            >
              Contact Sales
            </a>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-16 flex flex-wrap justify-center items-center gap-8 opacity-60">
          <div className="flex items-center gap-2 text-neutral-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-sm font-medium">Secure Payments</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-sm font-medium">Cancel Anytime</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="text-sm font-medium">Powered by Stripe</span>
          </div>
        </div>
      </div>
    </section>
  );
}
