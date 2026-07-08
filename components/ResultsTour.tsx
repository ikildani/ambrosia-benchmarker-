'use client';

import { useState, useEffect, useCallback, useRef, type JSX } from 'react';
import { DEAL_STATS } from '@/lib/config/constants';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  DollarSign,
  BarChart3,
  Layers,
  TrendingUp,
  Users,
  ToggleLeft,
  Dice5,
  FlaskConical,
  Globe,
  GitBranch,
  Swords,
  Handshake,
  Shield,
  FileText,
} from 'lucide-react';
import { markTourComplete, markTourSkipped, saveTourProgress } from '@/lib/tour';

// ---------------------------------------------------------------------------
// Tour step IDs — export so Results.tsx can add id={} to section wrappers
// ---------------------------------------------------------------------------

export const TOUR_STEP_IDS = {
  DEAL_TERMS: 'tour-deal-terms',
  SENSITIVITY: 'tour-sensitivity',
  WATERFALL: 'tour-waterfall',
  RNPV: 'tour-rnpv',
  BUYER_SPECIFIC: 'tour-buyer-specific',
  DEAL_STRUCTURE: 'tour-deal-structure',
  MONTE_CARLO: 'tour-monte-carlo',
  INDEX_DRUGS: 'tour-index-drugs',
  MARKET_SIZE: 'tour-market-size',
  SCENARIO_PLANNER: 'tour-scenario-planner',
  COMPETITIVE: 'tour-competitive',
  PARTNER_MATCHES: 'tour-partner-matches',
  ASSET_READINESS: 'tour-asset-readiness',
  AI_TOOLS: 'tour-ai-tools',
} as const;

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

interface TourStepDef {
  targetId: string;
  title: string;
  body: string;
  icon: JSX.Element;
}

const ICON_CLASS = 'w-5 h-5';

const TOUR_STEPS: TourStepDef[] = [
  {
    targetId: TOUR_STEP_IDS.DEAL_TERMS,
    title: 'Deal Terms Overview',
    body: `Your headline numbers. These ranges are benchmarked against ${DEAL_STATS.TOTAL_DEALS} verified biopharma transactions \u2014 filtered by your exact therapeutic area, modality, and phase combination.`,
    icon: <DollarSign className={ICON_CLASS} />,
  },
  {
    targetId: TOUR_STEP_IDS.SENSITIVITY,
    title: 'Sensitivity Analysis',
    body: 'See which variables move the needle most. The tornado chart ranks every input by dollar impact on your deal value, so you know exactly where to focus negotiation leverage.',
    icon: <BarChart3 className={ICON_CLASS} />,
  },
  {
    targetId: TOUR_STEP_IDS.WATERFALL,
    title: 'Deal Waterfall',
    body: 'Visualizes how value flows from upfront through development, regulatory, and commercial milestones. Each bar represents a probability-weighted payment tier.',
    icon: <Layers className={ICON_CLASS} />,
  },
  {
    targetId: TOUR_STEP_IDS.RNPV,
    title: 'rNPV Analysis',
    body: 'The institutional gold standard. Risk-adjusted NPV models your asset\u2019s expected value by discounting future cash flows through phase-specific probability of success gates.',
    icon: <TrendingUp className={ICON_CLASS} />,
  },
  {
    targetId: TOUR_STEP_IDS.BUYER_SPECIFIC,
    title: 'Buyer-Specific Valuation',
    body: 'Not all buyers value your asset the same way. This engine scores specific acquirers based on their pipeline gaps, therapeutic focus, and historical deal patterns.',
    icon: <Users className={ICON_CLASS} />,
  },
  {
    targetId: TOUR_STEP_IDS.DEAL_STRUCTURE,
    title: 'Deal Structure Toggle',
    body: 'Explore three structuring strategies: upfront-heavy (de-risk early), balanced, or milestone-heavy (maximize total value). Each recalculates the full deal term distribution.',
    icon: <ToggleLeft className={ICON_CLASS} />,
  },
  {
    targetId: TOUR_STEP_IDS.MONTE_CARLO,
    title: 'Monte Carlo Simulation',
    body: '10,000 correlated simulations using Cholesky decomposition. Shows the probability distribution of outcomes, plus institutional risk metrics: VaR, CVaR, skewness, and kurtosis.',
    icon: <Dice5 className={ICON_CLASS} />,
  },
  {
    targetId: TOUR_STEP_IDS.INDEX_DRUGS,
    title: 'Index Drug Comparison',
    body: 'Benchmarks your asset\u2019s projected peak sales against real-world reference drugs in the same therapeutic area. Flags if projections look unrealistic vs. proven comparables.',
    icon: <FlaskConical className={ICON_CLASS} />,
  },
  {
    targetId: TOUR_STEP_IDS.MARKET_SIZE,
    title: 'Market Sizing',
    body: 'Bottom-up epidemiology: prevalence, diagnosis rate, treatment-eligible population, market share capture. Validated against actual market data with territory-specific pricing.',
    icon: <Globe className={ICON_CLASS} />,
  },
  {
    targetId: TOUR_STEP_IDS.SCENARIO_PLANNER,
    title: 'Scenario Planner',
    body: 'Base, bull, and bear cases \u2014 plus compound scenarios where multiple risks interact non-linearly. Shows how regulatory delays, competitive entries, and pricing changes stack.',
    icon: <GitBranch className={ICON_CLASS} />,
  },
  {
    targetId: TOUR_STEP_IDS.COMPETITIVE,
    title: 'Competitive Landscape',
    body: 'Maps your asset against the competitive pipeline: who\u2019s ahead, who\u2019s behind, what\u2019s in Phase 3. Identifies white space opportunities and crowded indications.',
    icon: <Swords className={ICON_CLASS} />,
  },
  {
    targetId: TOUR_STEP_IDS.PARTNER_MATCHES,
    title: 'Partner Matching',
    body: 'Scored against 850+ pharma and biotech companies. Ranks potential partners by therapeutic fit, modality expertise, deal history, and strategic alignment.',
    icon: <Handshake className={ICON_CLASS} />,
  },
  {
    targetId: TOUR_STEP_IDS.ASSET_READINESS,
    title: 'Asset Readiness Score',
    body: 'A 0\u2013100 composite score across clinical, regulatory, commercial, and IP readiness factors. Tells you where your asset is strong and where gaps may slow a deal.',
    icon: <Shield className={ICON_CLASS} />,
  },
  {
    targetId: TOUR_STEP_IDS.AI_TOOLS,
    title: 'AI Deal Memo & Playbook',
    body: 'One-click AI-generated deal memo and negotiation playbook. The memo summarizes your asset\u2019s value proposition; the playbook provides tactical negotiation strategies.',
    icon: <FileText className={ICON_CLASS} />,
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ResultsTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEADER_OFFSET = 80; // px — space above target when scrolling

function scrollToTarget(el: HTMLElement) {
  const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
  window.scrollTo({ top, behavior: 'smooth' });
}

function getTargetRect(id: string): DOMRect | null {
  const el = document.getElementById(id);
  if (!el) return null;
  return el.getBoundingClientRect();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ResultsTour({ isOpen, onClose, onComplete }: ResultsTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const totalSteps = TOUR_STEPS.length;
  const step = TOUR_STEPS[currentStep];

  // ---- Detect mobile ----
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ---- Measure + scroll to current target ----
  const measureTarget = useCallback(() => {
    if (!isOpen || showCompletion) return;
    const s = TOUR_STEPS[currentStep];
    if (!s) return;
    const el = document.getElementById(s.targetId);
    if (el) {
      scrollToTarget(el);
      // Allow scroll to settle, then measure
      const measure = () => {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
      };
      // Measure immediately and again after scroll settles
      measure();
      setTimeout(measure, 400);
      setTimeout(measure, 700);
    } else {
      setTargetRect(null);
    }
  }, [currentStep, isOpen, showCompletion]);

  useEffect(() => {
    measureTarget();
  }, [measureTarget]);

  // ---- Track target position on scroll/resize ----
  useEffect(() => {
    if (!isOpen || showCompletion) return;

    const update = () => {
      const s = TOUR_STEPS[currentStep];
      if (!s) return;
      const rect = getTargetRect(s.targetId);
      if (rect) setTargetRect(rect);
      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isOpen, currentStep, showCompletion]);

  // ---- Keyboard navigation ----
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (showCompletion) {
        if (e.key === 'Escape' || e.key === 'Enter') {
          handleFinish();
        }
        return;
      }
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          goNext();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          goBack();
          break;
        case 'Escape':
          handleSkip();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentStep, showCompletion]);

  // ---- Navigation helpers ----
  const goNext = useCallback(() => {
    if (currentStep >= totalSteps - 1) {
      // Show completion
      setShowCompletion(true);
      markTourComplete(currentStep);
      return;
    }
    setIsTransitioning(true);
    setTimeout(() => {
      const next = currentStep + 1;
      setCurrentStep(next);
      saveTourProgress(next);
      setIsTransitioning(false);
    }, 150);
  }, [currentStep, totalSteps]);

  const goBack = useCallback(() => {
    if (currentStep <= 0) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentStep(currentStep - 1);
      setIsTransitioning(false);
    }, 150);
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    markTourSkipped(currentStep);
    onClose();
  }, [currentStep, onClose]);

  const handleFinish = useCallback(() => {
    markTourComplete(totalSteps - 1);
    onComplete();
  }, [totalSteps, onComplete]);

  // ---- Reset state when opening ----
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setShowCompletion(false);
      setIsTransitioning(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ---- Spotlight geometry ----
  const pad = 12; // px padding around spotlight
  const spotlightStyle =
    targetRect && !isMobile && !showCompletion
      ? {
          top: targetRect.top - pad,
          left: targetRect.left - pad,
          width: targetRect.width + pad * 2,
          height: targetRect.height + pad * 2,
        }
      : null;

  // ---- Tooltip position (desktop) ----
  const getTooltipPosition = (): React.CSSProperties => {
    if (isMobile || !targetRect || showCompletion) {
      // Mobile or completion: fixed bottom
      return {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        borderRadius: '1rem 1rem 0 0',
      };
    }

    const cardWidth = 420;
    const cardHeight = 320;
    const gap = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Prefer placing card to the right of the spotlight
    let left = targetRect.right + gap;
    let top = targetRect.top;

    // If card overflows right, try left side
    if (left + cardWidth > vw - 16) {
      left = targetRect.left - cardWidth - gap;
    }

    // If card overflows left, place below
    if (left < 16) {
      left = Math.max(16, targetRect.left);
      top = targetRect.bottom + gap;
    }

    // Clamp vertical
    if (top + cardHeight > vh - 16) {
      top = vh - cardHeight - 16;
    }
    if (top < 16) top = 16;

    return {
      position: 'fixed',
      top,
      left,
      width: cardWidth,
    };
  };

  // ---- Progress percentage ----
  const progressPct = showCompletion
    ? 100
    : ((currentStep + 1) / totalSteps) * 100;

  // ---- Render ----
  return (
    <div
      className="fixed inset-0 z-[9999]"
      role="dialog"
      aria-modal="true"
      aria-label="Results page guided tour"
    >
      {/* ---- Overlay with spotlight cutout ---- */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 1 }}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlightStyle && (
              <rect
                x={spotlightStyle.left}
                y={spotlightStyle.top}
                width={spotlightStyle.width}
                height={spotlightStyle.height}
                rx="12"
                fill="black"
                className="transition-all duration-500 ease-out"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(2, 6, 23, 0.72)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {/* Spotlight ring glow */}
      {spotlightStyle && !showCompletion && (
        <div
          className="absolute rounded-xl pointer-events-none transition-all duration-500 ease-out"
          style={{
            ...spotlightStyle,
            zIndex: 2,
            boxShadow: '0 0 0 2px rgba(56, 189, 248, 0.5), 0 0 24px 4px rgba(56, 189, 248, 0.15)',
          }}
        />
      )}

      {/* Clickable overlay behind card to skip */}
      <div
        className="absolute inset-0"
        style={{ zIndex: 3 }}
        onClick={handleSkip}
        aria-hidden="true"
      />

      {/* ---- Tooltip card ---- */}
      <div
        ref={cardRef}
        className={`
          bg-slate-800 border border-slate-700 shadow-2xl
          ${isMobile || showCompletion ? 'rounded-t-2xl' : 'rounded-xl'}
          transition-all duration-300 ease-out
          ${isTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}
        `}
        style={{ ...getTooltipPosition(), zIndex: 4, maxWidth: isMobile ? undefined : 420 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ---- Progress bar ---- */}
        <div className="h-1 bg-slate-700/50 rounded-t-xl overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="p-5 sm:p-6">
          {showCompletion ? (
            /* ---- Completion screen ---- */
            <div className="text-center py-4">
              {/* Celebration animation */}
              <div className="relative mx-auto w-20 h-20 mb-5">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-teal-500 to-cyan-400 animate-ping opacity-20" />
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-teal-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-teal-500/30">
                  <Check className="w-10 h-10 text-white" strokeWidth={3} />
                </div>
              </div>

              <h3 className="text-xl font-bold text-white mb-2">
                You&apos;re ready
              </h3>
              <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">
                You&apos;ve seen all 14 engines. Explore your results, adjust inputs, and generate reports with confidence.
              </p>

              <button
                onClick={handleFinish}
                className="w-full py-3 bg-gradient-to-r from-teal-500 to-cyan-400 text-white font-semibold rounded-xl
                           shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30
                           transition-all duration-200 hover:-translate-y-0.5
                           flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                Close Tour
              </button>
            </div>
          ) : (
            /* ---- Step content ---- */
            <>
              {/* Header row */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500/20 to-cyan-400/20 border border-teal-500/30 flex items-center justify-center text-teal-400 flex-shrink-0">
                    {step.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-teal-400 leading-tight">
                      {step.title}
                    </h3>
                    <span className="text-xs text-slate-500">
                      {currentStep + 1} of {totalSteps}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleSkip}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-700 transition-colors text-slate-500 hover:text-slate-300 flex-shrink-0"
                  aria-label="Close tour"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <p className="text-slate-300 text-sm leading-relaxed mb-5">
                {step.body}
              </p>

              {/* Step dots — compact visual */}
              <div className="flex items-center gap-1 mb-5">
                {TOUR_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      i === currentStep
                        ? 'w-5 bg-gradient-to-r from-teal-500 to-cyan-400'
                        : i < currentStep
                        ? 'w-1.5 bg-teal-500/60'
                        : 'w-1.5 bg-slate-600'
                    }`}
                  />
                ))}
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSkip}
                  className="text-sm text-slate-500 hover:text-slate-300 transition-colors font-medium px-1"
                >
                  Skip Tour
                </button>

                <div className="flex-1" />

                {currentStep > 0 && (
                  <button
                    onClick={goBack}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-600 text-slate-300
                               hover:bg-slate-700 hover:border-slate-500 transition-all duration-200
                               flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                )}

                <button
                  onClick={goNext}
                  className="px-5 py-2 text-sm font-semibold rounded-lg
                             bg-gradient-to-r from-teal-500 to-cyan-400 text-white
                             shadow-lg shadow-teal-500/20 hover:shadow-xl hover:shadow-teal-500/30
                             hover:-translate-y-0.5 transition-all duration-200
                             flex items-center gap-1"
                >
                  {currentStep === totalSteps - 1 ? (
                    <>
                      Finish Tour
                      <Check className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---- Live region for screen reader announcements ---- */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {showCompletion
          ? 'Tour complete. You have seen all 14 engine sections.'
          : `Step ${currentStep + 1} of ${totalSteps}: ${step.title}. ${step.body}`}
      </div>
    </div>
  );
}
