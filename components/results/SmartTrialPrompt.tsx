'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PRICING } from '@/lib/config/constants';
import type { CalculationResult } from '@/lib/calculations';
import type { FinancialModelResult } from '@/lib/financial/run-financial-model';

interface Props {
  result: CalculationResult;
  tier: string;
  onUpgrade?: () => void;
  onBuyReport?: () => void;
  therapeuticArea?: string;
  phase?: string;
  modality?: string;
  financialModel?: FinancialModelResult | null;
  onUnlockPreview?: (section: string) => void;
}

// ── Persistence Keys ───────────────────────────────────────────────────
const SESSION_KEY = 'smart_trial_shown';
const DISMISS_KEY = 'smart_trial_dismissed';
const VISIT_KEY = 'ambrosia_visit_count';
const UNLOCKED_KEY = 'ambrosia_unlocked_section';
const CLICKED_FEATURES_KEY = 'ambrosia_clicked_features';

// ── Feature Definitions ────────────────────────────────────────────────
interface FeatureDef {
  id: string;
  label: string;
  desc: string;
  valueHook: (result: CalculationResult, fm?: FinancialModelResult | null) => string | null;
}

const ALL_FEATURES: FeatureDef[] = [
  {
    id: 'rnpv',
    label: 'rNPV + Monte Carlo',
    desc: '10,000 simulations with phase-specific PoS',
    valueHook: (_r, fm) => fm?.rnpv ? `rNPV of $${Math.abs(fm.rnpv.riskAdjustedNPV).toFixed(0)}M with ${(fm.rnpv.cumulativePoS * 100).toFixed(1)}% cumulative PoS` : null,
  },
  {
    id: 'partner_matching',
    label: 'Partner Matching',
    desc: '700+ companies scored for your asset',
    valueHook: () => null,
  },
  {
    id: 'institutional_analytics',
    label: 'Institutional Analytics',
    desc: 'FDA risk, milestones, patent dynamics, 7 more modules',
    valueHook: (_r, fm) => {
      if (fm?.regulatoryRisk) return `CRL probability: ${(fm.regulatoryRisk.crlProbability * 100).toFixed(1)}% — ${fm.regulatoryRisk.adcommRequired ? 'AdComm likely' : 'no AdComm expected'}`;
      return null;
    },
  },
  {
    id: 'deal_memo',
    label: 'AI Deal Memo + Playbook',
    desc: 'Board-ready narrative and negotiation strategy',
    valueHook: () => null,
  },
  {
    id: 'comparable_deals',
    label: 'Comparable Transactions',
    desc: 'Real disclosed deals with AI narration',
    valueHook: () => null,
  },
  {
    id: 'lifecycle',
    label: 'Lifecycle & Franchise',
    desc: 'Label expansion, pediatric exclusivity, indication sequencing',
    valueHook: (_r, fm) => {
      if (fm?.lifecycleExtensions) {
        const incr = fm.lifecycleExtensions.incrementalValue;
        if (incr > 0) return `$${incr.toFixed(0)}M in potential lifecycle value identified`;
      }
      return null;
    },
  },
  {
    id: 'scenario',
    label: 'Scenario Planning',
    desc: 'Bear/base/bull with defensive floor',
    valueHook: (_r, fm) => {
      if (fm?.scenarioComparison) return `Bull case: $${fm.scenarioComparison.bull.rnpv.toFixed(0)}M — ${((fm.scenarioComparison.bull.rnpv / (fm.scenarioComparison.base.rnpv || 1) - 1) * 100).toFixed(0)}% above base`;
      return null;
    },
  },
  {
    id: 'report',
    label: '30+ Page PDF Report',
    desc: 'Institutional-grade with SVG charts',
    valueHook: () => null,
  },
];

// ── Visit Counter ──────────────────────────────────────────────────────
function getVisitCount(): number {
  try {
    const count = parseInt(localStorage.getItem(VISIT_KEY) || '0', 10);
    return isNaN(count) ? 0 : count;
  } catch { return 0; }
}

function incrementVisitCount(): number {
  try {
    const count = getVisitCount() + 1;
    localStorage.setItem(VISIT_KEY, String(count));
    return count;
  } catch { return 1; }
}

function getClickedFeatures(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(CLICKED_FEATURES_KEY) || '[]');
  } catch { return []; }
}

function addClickedFeature(feature: string): void {
  try {
    const features = getClickedFeatures();
    if (!features.includes(feature)) {
      features.push(feature);
      sessionStorage.setItem(CLICKED_FEATURES_KEY, JSON.stringify(features));
    }
  } catch {}
}

function getUnlockedSection(): string | null {
  try { return sessionStorage.getItem(UNLOCKED_KEY); } catch { return null; }
}

// ── Component ──────────────────────────────────────────────────────────

export default function SmartTrialPrompt({
  result,
  tier,
  onUpgrade,
  onBuyReport,
  therapeuticArea,
  phase,
  modality,
  financialModel,
  onUnlockPreview,
}: Props) {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [unlockedSection, setUnlockedSection] = useState<string | null>(null);
  const [visitCount, setVisitCount] = useState(1);
  const [clickedFeatures, setClickedFeatures] = useState<string[]>([]);
  const shownRef = useRef(false);
  const hasAccess = tier === 'pro' || tier === 'report' || tier === 'portfolio';

  // Track visit on mount
  useEffect(() => {
    const count = incrementVisitCount();
    setVisitCount(count);
    setUnlockedSection(getUnlockedSection());
    setClickedFeatures(getClickedFeatures());
  }, []);

  // Listen for pro feature clicks from the Results component
  useEffect(() => {
    if (hasAccess) return;
    const handler = (e: CustomEvent) => {
      const feature = e.detail?.feature;
      if (feature) {
        addClickedFeature(feature);
        setClickedFeatures(getClickedFeatures());
      }
    };
    window.addEventListener('pro-feature-click' as any, handler);
    return () => window.removeEventListener('pro-feature-click' as any, handler);
  }, [hasAccess]);

  const triggerPrompt = useCallback(() => {
    if (shownRef.current || hasAccess || dismissed) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    shownRef.current = true;
    sessionStorage.setItem(SESSION_KEY, '1');
    setShow(true);

    try {
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'smart_trial_prompt_shown',
          event_data: { therapeuticArea, phase, modality, visitCount, clickedFeatures: getClickedFeatures() },
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }, [hasAccess, dismissed, therapeuticArea, phase, modality, visitCount]);

  // Adaptive delay based on visit count
  useEffect(() => {
    if (hasAccess || dismissed) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    // First visit: 15s (let them explore). Second: 10s. Third+: 8s (they know the product)
    const delay = visitCount <= 1 ? 15000 : visitCount === 2 ? 10000 : 8000;
    const timer = setTimeout(triggerPrompt, delay);
    return () => clearTimeout(timer);
  }, [hasAccess, dismissed, triggerPrompt, visitCount]);

  // Blur click detection — fire on 2nd click
  useEffect(() => {
    if (hasAccess) return;
    let blurClicks = 0;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const blurEl = target.closest('[class*="blur-"]') || target.closest('.pointer-events-none');
      if (blurEl) {
        blurClicks++;
        // Try to identify which feature they clicked
        const section = blurEl.closest('[id]')?.id || '';
        if (section) addClickedFeature(section);
        setClickedFeatures(getClickedFeatures());

        if (blurClicks >= 2) triggerPrompt();
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [hasAccess, triggerPrompt]);

  const handleDismiss = () => { setShow(false); setDismissed(true); };
  const handleDismissPermanent = () => { setShow(false); setDismissed(true); localStorage.setItem(DISMISS_KEY, '1'); };

  const handleUnlockPreview = (featureId: string) => {
    sessionStorage.setItem(UNLOCKED_KEY, featureId);
    setUnlockedSection(featureId);
    setShow(false);
    onUnlockPreview?.(featureId);

    try {
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: 'smart_trial_preview_unlock', event_data: { feature: featureId, therapeuticArea, phase } }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  };

  const handleUpgrade = () => {
    try {
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'smart_trial_prompt_clicked',
          event_data: { therapeuticArea, phase, modality, visitCount, clickedFeatures: getClickedFeatures(), action: 'upgrade' },
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
    onUpgrade?.();
  };

  if (!show || hasAccess || dismissed) return null;

  const taLabel = therapeuticArea?.replace(/([A-Z])/g, ' $1').trim() || '';
  const phaseLabel = phase?.replace(/_/g, ' ').replace(/phase/i, 'Phase ').trim() || '';
  const tdvMedian = result.terms.totalDealValue.median;
  const tdvStr = tdvMedian >= 1000 ? `$${(tdvMedian / 1000).toFixed(1)}B` : `$${tdvMedian}M`;

  // Reorder features: put clicked features first (they already showed interest)
  const clicked = getClickedFeatures();
  const sortedFeatures = [...ALL_FEATURES].sort((a, b) => {
    const aClicked = clicked.some(c => c.includes(a.id) || a.id.includes(c)) ? -1 : 0;
    const bClicked = clicked.some(c => c.includes(b.id) || b.id.includes(c)) ? -1 : 0;
    return aClicked - bClicked;
  });

  // Pick top 5 features, prioritizing those the user tried to access
  const displayFeatures = sortedFeatures.slice(0, 5);

  // Find the best value hook to personalize the headline
  const bestValueHook = ALL_FEATURES
    .map(f => f.valueHook(result, financialModel))
    .find(v => v !== null);

  // Intensity based on visit count
  const isReturning = visitCount >= 2;
  const isHighIntent = visitCount >= 3 || clicked.length >= 3;

  // Has the user already unlocked their free preview?
  const hasUsedPreview = !!unlockedSection;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={handleDismiss} />

      <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-teal-500" />

        <button onClick={handleDismiss} className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors z-10" aria-label="Close">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6 sm:p-8">
          {/* Contextual badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider">
              {isHighIntent ? 'Your full analysis is ready' : isReturning ? 'Welcome back' : 'Analysis complete'}
            </span>
          </div>

          {/* Personalized headline */}
          <h2 className="text-xl font-bold text-white leading-tight">
            {isHighIntent
              ? `You've explored ${clicked.length} sections — unlock everything for ${taLabel}`
              : isReturning
                ? `Still researching ${taLabel} ${phaseLabel}? Your ${tdvStr} analysis is waiting`
                : `Your ${taLabel} ${phaseLabel} deal is valued at ${tdvStr}`
            }
          </h2>

          {/* Value hook — personalized insight from their calculation */}
          {bestValueHook && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-teal-500/10 border border-teal-500/20">
              <p className="text-xs text-teal-300">{bestValueHook}</p>
            </div>
          )}

          <p className="mt-3 text-sm text-slate-400 leading-relaxed">
            {hasUsedPreview
              ? 'You previewed one section for free. Upgrade for unlimited access to every module.'
              : 'Unlock one section for free to experience the full depth — or start your trial for everything.'
            }
          </p>

          {/* Feature list — reordered by click intent */}
          <div className="space-y-1.5 my-5">
            {displayFeatures.map((feature) => {
              const wasClicked = clicked.some(c => c.includes(feature.id) || feature.id.includes(c));
              const isUnlocked = unlockedSection === feature.id;
              const canUnlock = !hasUsedPreview && !isUnlocked;

              return (
                <div key={feature.id} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${wasClicked ? 'bg-teal-500/5 border border-teal-500/10' : ''}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isUnlocked ? 'bg-teal-500' : 'bg-slate-800 border border-slate-600'}`}>
                    {isUnlocked ? (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-200">{feature.label}</span>
                      {wasClicked && !isUnlocked && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold text-amber-400 bg-amber-500/10 rounded">YOU TRIED THIS</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">{feature.desc}</span>
                  </div>
                  {canUnlock && (
                    <button
                      onClick={() => handleUnlockPreview(feature.id)}
                      className="px-2 py-1 text-[10px] font-semibold text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-md hover:bg-teal-500/20 transition-colors flex-shrink-0"
                    >
                      Preview free
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Primary CTA */}
          <button
            onClick={handleUpgrade}
            className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30"
          >
            {isHighIntent
              ? `Unlock Everything — 7 Days Free`
              : `Start Free Trial — ${PRICING.PRO_MONTHLY}`
            }
          </button>
          <p className="text-center text-xs text-slate-500 mt-2">Cancel anytime. No commitment.</p>

          {/* Secondary CTA */}
          <button
            onClick={() => { onBuyReport?.(); handleDismiss(); }}
            className="w-full mt-3 py-2.5 bg-transparent border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-300 text-xs font-medium rounded-xl transition-all"
          >
            Or get a single report — {PRICING.REPORT_PRICE}
          </button>

          <button onClick={handleDismissPermanent} className="w-full mt-3 text-[11px] text-slate-600 hover:text-slate-400 transition-colors">
            Don&apos;t show this again
          </button>
        </div>
      </div>
    </div>
  );
}
