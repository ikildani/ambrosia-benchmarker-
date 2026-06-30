'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PRICING } from '@/lib/config/constants';
import type { CalculationResult } from '@/lib/calculations';

interface Props {
  result: CalculationResult;
  tier: string;
  onUpgrade?: () => void;
  onBuyReport?: () => void;
  therapeuticArea?: string;
  phase?: string;
  modality?: string;
}

const SESSION_KEY = 'smart_trial_prompt_shown';
const DISMISS_KEY = 'smart_trial_prompt_dismissed';

export default function SmartTrialPrompt({
  result,
  tier,
  onUpgrade,
  onBuyReport,
  therapeuticArea,
  phase,
  modality,
}: Props) {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const shownRef = useRef(false);
  const hasAccess = tier === 'pro' || tier === 'report' || tier === 'portfolio';

  const triggerPrompt = useCallback(() => {
    if (shownRef.current || hasAccess || dismissed) return;

    // Don't show if already shown this session or permanently dismissed
    if (sessionStorage.getItem(SESSION_KEY)) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    shownRef.current = true;
    sessionStorage.setItem(SESSION_KEY, '1');
    setShow(true);

    // Track the event
    try {
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'smart_trial_prompt_shown',
          event_data: { therapeuticArea, phase, modality },
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }, [hasAccess, dismissed, therapeuticArea, phase, modality]);

  // Trigger after 12 seconds of viewing results — enough time to scroll
  // through summary, see blurred content, and feel the friction
  useEffect(() => {
    if (hasAccess || dismissed) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const timer = setTimeout(triggerPrompt, 12000);
    return () => clearTimeout(timer);
  }, [hasAccess, dismissed, triggerPrompt]);

  // Also trigger on second blur click (high intent signal)
  useEffect(() => {
    if (hasAccess) return;
    let blurClicks = 0;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[class*="blur"]') || target.closest('.pointer-events-none')) {
        blurClicks++;
        if (blurClicks >= 2) {
          triggerPrompt();
        }
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [hasAccess, triggerPrompt]);

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
  };

  const handleDismissPermanent = () => {
    setShow(false);
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, '1');
  };

  const handleUpgrade = () => {
    try {
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'smart_trial_prompt_clicked',
          event_data: { therapeuticArea, phase, modality, action: 'upgrade' },
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
    onUpgrade?.();
  };

  if (!show || hasAccess || dismissed) return null;

  // Personalize based on what they calculated
  const taLabel = therapeuticArea?.replace(/([A-Z])/g, ' $1').trim() || 'your';
  const phaseLabel = phase?.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) || '';
  const upfrontMedian = result.terms.upfront.median;
  const tdvMedian = result.terms.totalDealValue.median;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={handleDismiss} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden animate-fade-in">
        {/* Top accent */}
        <div className="h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-teal-500" />

        {/* Close */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors z-10"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6 sm:p-8">
          {/* Personalized hook */}
          <div className="mb-5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 mb-4">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider">Your analysis is ready</span>
            </div>
            <h2 className="text-xl font-bold text-white leading-tight">
              Your {taLabel} {phaseLabel} deal is valued at ${tdvMedian >= 1000 ? `${(tdvMedian / 1000).toFixed(1)}B` : `${tdvMedian}M`}
            </h2>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              You&apos;re seeing the summary. Behind the paywall is the full institutional analysis — the same depth Goldman and Lazard use for pharma M&A mandates.
            </p>
          </div>

          {/* What's locked — compact, high-impact list */}
          <div className="space-y-2 mb-6">
            {[
              { label: 'rNPV + Monte Carlo', desc: '10,000 simulations, phase-specific PoS' },
              { label: 'Partner Matching', desc: '850+ companies scored for your asset' },
              { label: 'Institutional Analytics', desc: 'FDA risk, milestones, patent dynamics, 7 more' },
              { label: 'AI Deal Memo + Playbook', desc: 'Board-ready narrative in seconds' },
              { label: 'PDF Report', desc: '30+ page branded report with SVG charts' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-200">{item.label}</span>
                  <span className="text-xs text-slate-500 ml-1.5">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={handleUpgrade}
            className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30"
          >
            Start 7-Day Free Trial — {PRICING.PRO_MONTHLY}
          </button>
          <p className="text-center text-xs text-slate-500 mt-2">Cancel anytime. No commitment.</p>

          {/* Or buy report */}
          <button
            onClick={() => { onBuyReport?.(); handleDismiss(); }}
            className="w-full mt-3 py-2.5 bg-transparent border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-300 text-xs font-medium rounded-xl transition-all"
          >
            Or get a single report — {PRICING.REPORT_PRICE}
          </button>

          {/* Don't show again */}
          <button
            onClick={handleDismissPermanent}
            className="w-full mt-3 text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
          >
            Don&apos;t show this again
          </button>
        </div>
      </div>
    </div>
  );
}
