'use client';

import { useState, useRef } from 'react';
import { CalculationInput, CalculationResult } from '@/lib/calculations';
import { useTracking } from './TrackingProvider';
import { PRICING, DEAL_STATS } from '@/lib/config/constants';
import { usePromoCode } from '@/lib/hooks/usePromoCode';
import { useAuth } from '@/contexts/AuthContext';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import { captureClientError } from '@/lib/sentry-client';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: 'report_upsell' | 'pro_feature';
  promoCode?: string;
  calculationData?: {
    inputs: CalculationInput;
    results: CalculationResult;
  };
}

export default function PaywallModal({ isOpen, onClose, reason, promoCode: initialPromo, calculationData }: PaywallModalProps) {
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [isProLoading, setIsProLoading] = useState(false);
  const { trackUpgradeCtaClick, trackPaywallDismissed } = useTracking();
  const { promoId, promoStatus, promoDiscount } = usePromoCode(initialPromo);
  const { user } = useAuth();
  const hasValidPromo = promoStatus === 'valid' && promoDiscount?.percentOff === 100;
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen, onClose);

  if (!isOpen) return null;

  const handleClose = () => {
    trackPaywallDismissed();
    onClose();
  };

  const handleBuyReport = async () => {
    if (!calculationData) return;
    trackUpgradeCtaClick('paywall_report');
    setIsReportLoading(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseType: 'report',
          userId: user?.id,
          email: user?.email,
          calculationData: {
            inputs: calculationData.inputs,
            results: calculationData.results,
          },
        }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        captureClientError(data.error, 'PaywallModal', { context: 'Report checkout API returned error' });
      }
    } catch {
      captureClientError(new Error('Report checkout failed'), 'PaywallModal', { context: 'Report checkout network error' });
    } finally {
      setIsReportLoading(false);
    }
  };

  const handleUpgradePro = async () => {
    trackUpgradeCtaClick('paywall_pro');
    setIsProLoading(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseType: 'subscription',
          userId: user?.id,
          email: user?.email,
          promoCode: promoId || undefined,
        }),
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
      setIsProLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-modal-title"
        tabIndex={-1}
        className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-y-auto overscroll-contain animate-slide-up"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 px-6 py-6 overflow-hidden">
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
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 mb-4 shadow-lg shadow-teal-500/30">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 id="paywall-modal-title" className="text-xl font-bold text-white mb-1">
              Unlock Full Analysis
            </h2>
            <p className="text-slate-300 text-sm">
              AI deal memo, full comparable deals, sensitivity analysis, and board-ready reports
            </p>
          </div>
        </div>

        {/* Two-option cards */}
        <div className="p-5 sm:p-6">
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Report Card */}
            <div className="relative border-2 border-slate-200 dark:border-slate-600 rounded-xl p-5 hover:border-teal-300 dark:hover:border-teal-500 transition-all">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Get This Report</h3>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{PRICING.REPORT_PRICE}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">one-time</span>
              </div>
              <ul className="space-y-2 mb-5 text-sm">
                {[
                  'AI-powered deal memo',
                  'Full comparable deals',
                  'Complete sensitivity analysis',
                  'Negotiation playbook',
                  'Board-ready branded PDF',
                  'Excel data export',
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">For this calculation only</p>
              <button
                onClick={handleBuyReport}
                disabled={isReportLoading || !calculationData}
                className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold rounded-lg
                         hover:bg-slate-800 dark:hover:bg-slate-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2 text-sm"
              >
                {isReportLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  `Get Full Report — ${PRICING.REPORT_PRICE}`
                )}
              </button>
            </div>

            {/* Pro Card */}
            <div className="relative border-2 border-teal-400 dark:border-teal-500 rounded-xl p-5 bg-gradient-to-b from-teal-50/50 to-white dark:from-teal-900/10 dark:to-slate-800">
              <div className="absolute -top-3 right-4">
                <span className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Best Value
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Go Pro</h3>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{PRICING.PRO_PRICE}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">/month</span>
              </div>
              <ul className="space-y-2 mb-5 text-sm">
                {[
                  'Everything in Report, plus:',
                  'Unlimited full reports',
                  'Scenario comparison tool',
                  'Watchlist & deal alerts',
                  'Weekly market digest',
                  'Full partner profiles',
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">For all your calculations</p>
              <button
                onClick={handleUpgradePro}
                disabled={isProLoading}
                className="w-full py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg
                         hover:from-teal-600 hover:to-cyan-600 transition-all shadow-soft hover:shadow-glow
                         disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2 text-sm"
              >
                {isProLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    {hasValidPromo ? 'Start Free Month' : `Start Pro — ${PRICING.PRO_MONTHLY}`}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Trust Signals */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
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
              <span>Secure checkout via Stripe</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Cancel anytime</span>
            </div>
          </div>

          {/* Social proof */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="flex -space-x-2">
              {['IK', 'CZ', 'ML'].map((initials, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white text-[10px] font-bold border-2 border-white dark:border-slate-800"
                >
                  {initials}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Based on <span className="font-semibold text-slate-700 dark:text-slate-300">{DEAL_STATS.TOTAL_DEALS}</span> analyzed deals
            </p>
          </div>

          {/* Close */}
          <button
            onClick={handleClose}
            className="w-full mt-4 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
