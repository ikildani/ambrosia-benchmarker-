'use client';

/**
 * Buyer-Specific Deal Valuation Panel
 *
 * Renders inside the rNPV & Deal Valuation section. Allows the user to select
 * a partner from the match list and see a side-by-side comparison of what that
 * specific buyer would pay versus a generic buyer, based on the strategic
 * premium computed by the buyer-specific valuation engine.
 *
 * Gated behind Pro/Report tier — free users see a blurred preview with upgrade CTA.
 *
 * @module components/results/BuyerSpecificPanel
 */

import { useState, useMemo } from 'react';
import {
  Target,
  Lock,
  ChevronDown,
  TrendingUp,
  Shield,
  Clock,
  Zap,
  Building2,
} from 'lucide-react';
import type { DealWaterfall, RNPVResult } from '@/lib/financial/types';
import {
  calculateBuyerSpecificValuation,
  buildBuyerProfileFromMatch,
  type BuyerSpecificValuation,
} from '@/lib/financial/buyer-specific-valuation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PartnerMatchForPanel {
  company_name: string;
  company_id: string;
  match_score: number;
  pharma_intent?: {
    intentScore: number;
    intentTier: string;
    timing: string;
    confidence: number;
    factors: Array<{ name: string; score: number; weight: number }>;
  } | null;
  deals_last_12mo?: number | null;
  hq_country?: string | null;
  company_type?: string | null;
}

export interface BuyerSpecificPanelProps {
  /** Ranked list of partner matches with optional pharma intent data */
  partnerMatches: PartnerMatchForPanel[];
  /** Generic deal waterfall from the rNPV engine */
  dealWaterfall: DealWaterfall;
  /** The underlying rNPV calculation result */
  rnpvResult: RNPVResult;
  /** User's subscription tier */
  tier: string;
  /** Callback to trigger Pro upgrade flow */
  onUpgrade?: () => void;
  /** Callback to trigger single-report purchase */
  onBuyReport?: () => void;
  /** Callback when a buyer-specific valuation is computed — used to capture for PDF */
  onValuationComputed?: (valuation: BuyerSpecificValuation | null) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = (v: number) => {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}B`;
  if (Math.abs(v) >= 1) return `$${v.toFixed(0)}M`;
  return `$${v.toFixed(1)}M`;
};

const leverageColor: Record<string, string> = {
  strong: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  moderate: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  limited: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const leverageLabel: Record<string, string> = {
  strong: 'STRONG',
  moderate: 'MODERATE',
  limited: 'LIMITED',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BuyerSpecificPanel({
  partnerMatches,
  dealWaterfall,
  rnpvResult,
  tier,
  onUpgrade,
  onBuyReport,
  onValuationComputed,
}: BuyerSpecificPanelProps) {
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const hasAccess = tier === 'pro' || tier === 'report';

  // Filter to partners that have pharma intent data
  const eligiblePartners = useMemo(
    () => partnerMatches.filter(p => p.pharma_intent && p.pharma_intent.intentScore > 0),
    [partnerMatches],
  );

  const selectedPartner = useMemo(
    () => eligiblePartners.find(p => p.company_id === selectedPartnerId) ?? null,
    [eligiblePartners, selectedPartnerId],
  );

  // Compute buyer-specific valuation when a partner is selected
  const valuation: BuyerSpecificValuation | null = useMemo(() => {
    if (!selectedPartner) {
      onValuationComputed?.(null);
      return null;
    }
    const profile = buildBuyerProfileFromMatch(selectedPartner);
    const result = calculateBuyerSpecificValuation(profile, dealWaterfall, rnpvResult);
    onValuationComputed?.(result);
    return result;
  }, [selectedPartner, dealWaterfall, rnpvResult, onValuationComputed]);

  // ── Locked overlay for free tier ──
  if (!hasAccess) {
    return (
      <div className="relative mt-6">
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm rounded-xl">
          <Lock className="w-8 h-8 text-slate-400 mb-3" />
          <p className="text-sm text-slate-300 font-medium mb-1">Buyer-Specific Valuation</p>
          <p className="text-xs text-slate-400 mb-4 max-w-xs text-center">
            See what specific buyers would pay based on their intent signals, portfolio gaps, and deal urgency.
          </p>
          <div className="flex gap-2">
            {onUpgrade && (
              <button
                onClick={onUpgrade}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Upgrade to Pro
              </button>
            )}
            {onBuyReport && (
              <button
                onClick={onBuyReport}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Buy Report — $149
              </button>
            )}
          </div>
        </div>
        {/* Blurred preview */}
        <div className="filter blur-sm pointer-events-none select-none opacity-50">
          <PlaceholderContent />
        </div>
      </div>
    );
  }

  if (eligiblePartners.length === 0) {
    return (
      <div className="mt-6 p-4 bg-slate-800/50 border border-slate-700 rounded-xl text-center">
        <Target className="w-5 h-5 text-slate-500 mx-auto mb-2" />
        <p className="text-sm text-slate-400">
          No partners with intent data available. Run partner matching first to enable buyer-specific valuation.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header with partner selector */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-teal-400" />
          <h3 className="text-sm font-semibold text-slate-200">Buyer-Specific Valuation</h3>
        </div>

        {/* Partner Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/60 hover:bg-slate-700 border border-slate-600 rounded-lg text-xs text-slate-300 transition-colors min-w-[200px]"
          >
            {selectedPartner ? (
              <span className="flex items-center gap-2 truncate">
                <Building2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <span className="truncate">{selectedPartner.company_name}</span>
                <span className="text-teal-400 font-mono flex-shrink-0">{selectedPartner.match_score}%</span>
              </span>
            ) : (
              <span className="text-slate-500">Select a partner...</span>
            )}
            <ChevronDown className={`w-3 h-3 text-slate-500 flex-shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 w-72 max-h-64 overflow-y-auto bg-slate-800 border border-slate-600 rounded-lg shadow-xl">
              {eligiblePartners.map(partner => (
                <button
                  key={partner.company_id}
                  onClick={() => {
                    setSelectedPartnerId(partner.company_id);
                    setDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-700/60 transition-colors ${
                    partner.company_id === selectedPartnerId ? 'bg-slate-700/40' : ''
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Building2 className="w-3 h-3 text-slate-500 flex-shrink-0" />
                    <span className="text-slate-300 truncate">{partner.company_name}</span>
                  </span>
                  <span className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-teal-400 font-mono">{partner.match_score}%</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-amber-400 font-mono">{partner.pharma_intent?.intentScore ?? 0}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4">
        {!valuation ? (
          <div className="text-center py-8">
            <Target className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Select a partner above to see their buyer-specific valuation.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Side-by-side value comparison */}
            <div className="grid grid-cols-2 gap-3">
              {/* Generic Buyer Card */}
              <div className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-3">Generic Buyer</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] text-slate-500">Deal Value</p>
                    <p className="text-lg font-semibold text-slate-300 font-mono">
                      {fmt(valuation.genericDealValue.median)}
                    </p>
                    <p className="text-[10px] text-slate-600 font-mono">
                      {fmt(valuation.genericDealValue.low)} – {fmt(valuation.genericDealValue.high)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Upfront</p>
                    <p className="text-sm font-semibold text-slate-400 font-mono">
                      {fmt(valuation.genericUpfront.median)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Buyer-Specific Card */}
              <div className="bg-teal-900/20 border border-teal-600/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-wider text-teal-400 truncate max-w-[60%]">
                    {valuation.buyer.companyName}
                  </p>
                  <span className="text-[10px] font-mono text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded">
                    {valuation.buyer.matchScore}% fit
                  </span>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] text-teal-500/70">Deal Value</p>
                    <p className="text-lg font-semibold text-teal-300 font-mono">
                      {fmt(valuation.buyerSpecificDealValue.median)}
                    </p>
                    <p className="text-[10px] text-teal-600/50 font-mono">
                      {fmt(valuation.buyerSpecificDealValue.low)} – {fmt(valuation.buyerSpecificDealValue.high)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-teal-500/70">Upfront</p>
                      <p className="text-sm font-semibold text-teal-300 font-mono">
                        {fmt(valuation.buyerUpfront.median)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-teal-500/70">Premium</p>
                      <p className="text-sm font-bold text-emerald-400 font-mono">
                        +{valuation.strategicPremiumPercent.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Premium Breakdown Bars */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-3">Premium Breakdown</p>
              <div className="space-y-2.5">
                {valuation.premiumBreakdown.map(factor => (
                  <div key={factor.factor} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">{factor.factor}</span>
                      <span className="text-xs font-mono text-slate-300">
                        +{factor.contribution.toFixed(0)}%
                        <span className="text-slate-600 ml-1.5">
                          ({factor.score}/100 &times; {factor.weight.toFixed(2)})
                        </span>
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min((factor.contribution / 30) * 100, 100)}%`,
                          background: factor.contribution >= 15
                            ? 'linear-gradient(90deg, #0EA5A5, #34d399)'
                            : factor.contribution >= 8
                              ? 'linear-gradient(90deg, #0EA5A5, #0891B2)'
                              : '#64748B',
                        }}
                      />
                    </div>
                    {/* Rationale on hover / always visible on mobile */}
                    <p className="text-[10px] text-slate-600 mt-0.5 hidden group-hover:block">
                      {factor.rationale}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Negotiation Leverage + Timing */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Shield className="w-3 h-3 text-slate-500" />
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Negotiation Leverage</p>
                </div>
                <span
                  className={`inline-block px-2 py-0.5 text-xs font-bold rounded border ${leverageColor[valuation.negotiationLeverage]}`}
                >
                  {leverageLabel[valuation.negotiationLeverage]}
                </span>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Upfront Premium</p>
                </div>
                <p className="text-sm font-semibold text-teal-300 font-mono">
                  +{fmt(valuation.upfrontPremium)}
                </p>
                <p className="text-[10px] text-slate-600">vs generic upfront</p>
              </div>
            </div>

            {/* Timing Advantage */}
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Zap className="w-3 h-3 text-amber-500" />
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Timing Advantage</p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{valuation.timingAdvantage}</p>
            </div>

            {/* Full Narrative */}
            <div className="bg-teal-950/20 border border-teal-800/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="w-3 h-3 text-teal-500" />
                <p className="text-[10px] uppercase tracking-wider text-teal-600">Analysis</p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed italic">{valuation.narrative}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placeholder for blurred free-tier preview
// ---------------------------------------------------------------------------

function PlaceholderContent() {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-teal-400" />
          <span className="text-sm font-semibold text-slate-200">Buyer-Specific Valuation</span>
        </div>
        <div className="w-40 h-7 bg-slate-700 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4">
          <div className="w-24 h-3 bg-slate-600 rounded mb-3" />
          <div className="w-16 h-6 bg-slate-600 rounded mb-2" />
          <div className="w-20 h-3 bg-slate-700 rounded" />
        </div>
        <div className="bg-teal-900/20 border border-teal-600/30 rounded-lg p-4">
          <div className="w-28 h-3 bg-teal-800/40 rounded mb-3" />
          <div className="w-16 h-6 bg-teal-800/40 rounded mb-2" />
          <div className="w-20 h-3 bg-teal-900/30 rounded" />
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i}>
            <div className="flex justify-between mb-1">
              <div className="w-24 h-3 bg-slate-700 rounded" />
              <div className="w-16 h-3 bg-slate-700 rounded" />
            </div>
            <div className="h-2 bg-slate-700/50 rounded-full">
              <div
                className="h-full bg-slate-600 rounded-full"
                style={{ width: `${70 - i * 12}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
