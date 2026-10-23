'use client';

import { useState, useRef } from 'react';
import { CalculationInput, CalculationResult } from '@/lib/calculations';
import { useTracking } from './TrackingProvider';
import { PRICING, DEAL_STATS, ENGINE_COUNT } from '@/lib/config/constants';
import { usePromoCode } from '@/lib/hooks/usePromoCode';
import { useProCheckout, useTrialEligibility } from '@/lib/hooks/useProCheckout';
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

const PRO_POINTS = [
  `Every comparable deal behind your numbers, linked to its filing (${DEAL_STATS.TOTAL_DEALS} deals)`,
  `All ${ENGINE_COUNT} valuation engines and unlimited benchmarks`,
  'Deal alerts the day a comparable deal is announced',
  'PDF and Excel exports for your deal memo',
];

function Check() {
  return (
    <svg className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function PaywallModal({ isOpen, onClose, reason, promoCode: initialPromo, calculationData }: PaywallModalProps) {
  // All hooks run on every render, open or closed: callers keep this modal
  // mounted and toggle isOpen.
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const { trackUpgradeCtaClick, trackPaywallDismissed } = useTracking();
  const { promoId, promoStatus, promoDiscount } = usePromoCode(initialPromo);
  const { user } = useAuth();
  const { start, isLoading: isProLoading, error: proError } = useProCheckout();
  const { eligible: trialEligible } = useTrialEligibility();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen, onClose);

  if (!isOpen) return null;

  const hasPromo = promoStatus === 'valid' && !!promoId;
  const offerTrial = trialEligible && !hasPromo;
  const canBuyReport = reason === 'report_upsell' && !!calculationData;

  const handleClose = () => {
    trackPaywallDismissed();
    onClose();
  };

  const handleStartPro = () => {
    trackUpgradeCtaClick(offerTrial ? 'paywall_trial' : 'paywall_pro');
    void start({
      trial: offerTrial,
      billingInterval: 'monthly',
      source: reason === 'report_upsell' ? 'paywall_report' : 'paywall_feature',
      promoCode: hasPromo ? promoId ?? undefined : undefined,
    });
  };

  const handleBuyReport = async () => {
    if (!calculationData) return;
    trackUpgradeCtaClick('paywall_report');
    setIsReportLoading(true);
    setReportError(null);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseType: 'report',
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
        return;
      }
      captureClientError(data.error, 'PaywallModal', { context: 'Report checkout API returned error' });
      setReportError(data.error || 'Could not open checkout. Please try again.');
    } catch {
      captureClientError(new Error('Report checkout failed'), 'PaywallModal', { context: 'Report checkout network error' });
      setReportError('Connection error. Please try again.');
    }
    setIsReportLoading(false);
  };

  const proLabel = offerTrial
    ? 'Start 7-day free trial'
    : hasPromo && promoDiscount?.percentOff === 100
      ? 'Start your free month'
      : `Start Pro — ${PRICING.PRO_MONTHLY}`;

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
        className="relative w-full max-w-lg max-h-[90vh] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-y-auto overscroll-contain animate-slide-up"
      >
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Close dialog"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 px-6 pt-7 pb-6 text-center">
          <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-teal-300 mb-2">Solidus Pro</p>
          <h2 id="paywall-modal-title" className="text-xl sm:text-2xl font-bold text-white">
            {reason === 'report_upsell' ? 'See the full analysis behind your numbers' : 'This is a Pro feature'}
          </h2>
          <p className="text-slate-300 text-sm mt-2">
            {offerTrial
              ? 'Try everything in Pro free for 7 days.'
              : 'Everything in Solidus, for every deal you work on.'}
          </p>
        </div>

        <div className="p-6">
          <ul className="space-y-2.5 mb-6">
            {PRO_POINTS.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-200">
                <Check />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={handleStartPro}
            disabled={isProLoading}
            aria-busy={isProLoading}
            className="w-full py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl
                     hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/20
                     disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProLoading ? <><Spinner /> Opening secure checkout...</> : proLabel}
          </button>
          <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-2">
            {offerTrial
              ? `$0 today, then ${PRICING.PRO_MONTHLY}. We email you 3 days before the first charge. Cancel anytime.`
              : `Or ${PRICING.PRO_ANNUAL_MONTHLY} billed annually. Cancel anytime.`}
          </p>
          {proError && <p role="alert" className="text-xs text-center text-red-500 mt-2">{proError}</p>}

          {canBuyReport && (
            <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Only need this one deal?</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Deal memo, comparables, sensitivity and negotiation playbook as a board-ready PDF and Excel. {PRICING.REPORT_PRICE}, one time.
                </p>
              </div>
              <button
                onClick={handleBuyReport}
                disabled={isReportLoading}
                className="shrink-0 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 font-semibold rounded-lg
                         hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm inline-flex items-center gap-2"
              >
                {isReportLoading ? <><Spinner /> Opening...</> : `Get this report — ${PRICING.REPORT_PRICE}`}
              </button>
            </div>
          )}
          {reportError && <p role="alert" className="text-xs text-red-500 mt-2">{reportError}</p>}

          <button
            onClick={handleClose}
            className="w-full mt-5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
