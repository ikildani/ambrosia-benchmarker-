'use client';

import { useState, useCallback } from 'react';
import { Mail, User, RefreshCw, Loader2, AlertTriangle, Pill } from 'lucide-react';
import { ScoreProgressBar } from './ScoreProgressBar';
import { MatchFactor } from './MatchFactor';
import { WatchOutItem } from './WatchOutItem';
import { ApproachStrategyCard } from './ApproachStrategyCard';
import { RecentDealsSection } from './RecentDealsSection';
import { OutreachEmailModal } from './OutreachEmailModal';
import type {
  DetailedScoreBreakdown,
  WatchOutFactor,
  ApproachStrategy,
  RelevantDeal,
  StrategicContext,
} from '@/types/partner-breakdown';

interface ScoreBreakdownProps {
  companyId: string;
  companyName: string;
  matchScore: number;
  detailedBreakdown: DetailedScoreBreakdown | null;
  watchOuts: WatchOutFactor[] | null;
  approachStrategy: ApproachStrategy | null;
  relevantDeals: RelevantDeal[] | null;
  strategicContext: StrategicContext | null;
  userAsset: {
    modality: string;
    phase: string;
    indication_category: string | null;
    indication_specific: string | null;
    territory: string | null;
  };
  userId?: string;
  userEmail?: string;
  sessionId?: string;
  tier?: 'free' | 'pro' | 'report';
  onRegenerateStrategy?: () => void;
}

export function ScoreBreakdown({
  companyId,
  companyName,
  matchScore,
  detailedBreakdown,
  watchOuts,
  approachStrategy,
  relevantDeals,
  strategicContext,
  userAsset,
  userId,
  userEmail,
  sessionId,
  tier,
  onRegenerateStrategy,
}: ScoreBreakdownProps) {
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isRegeneratingStrategy, setIsRegeneratingStrategy] = useState(false);
  const [localStrategy, setLocalStrategy] = useState<ApproachStrategy | null>(approachStrategy);
  const [strategyError, setStrategyError] = useState<string | null>(null);

  const handleRegenerateStrategy = useCallback(async () => {
    if (!detailedBreakdown) return;

    setIsRegeneratingStrategy(true);
    setStrategyError(null);

    try {
      // Call the outreach API which also generates strategy
      const res = await fetch('/api/partners/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          company_name: companyName,
          match_context: {
            score: matchScore,
            factors: detailedBreakdown.factors,
            watch_outs: watchOuts || [],
            strategic_context: strategicContext || { patent_cliffs: [], revenue_at_risk: [], pipeline_gaps: [], strategic_priorities: [] },
          },
          user_asset: userAsset,
          user_id: userId,
          user_email: userEmail,
          session_id: sessionId,
          tier: tier, // Pass client-side tier for localStorage auth
        }),
      });

      const data = await res.json();

      if (res.ok && data.approach_strategy) {
        setLocalStrategy(data.approach_strategy);
        setStrategyError(null);
      } else if (data.upgrade_required) {
        setStrategyError('Upgrade to Pro to generate approach strategies');
      } else {
        setStrategyError(data.error || 'Failed to generate strategy. Please try again.');
      }
    } catch (error) {
      console.error('Failed to regenerate strategy:', error);
      setStrategyError('Network error. Please check your connection and try again.');
    } finally {
      setIsRegeneratingStrategy(false);
    }
  }, [companyId, companyName, matchScore, detailedBreakdown, watchOuts, strategicContext, userAsset, userId, userEmail, sessionId, tier]);

  // Build match context for email modal
  const matchContext = {
    score: matchScore,
    factors: detailedBreakdown?.factors || [],
    watch_outs: watchOuts || [],
    strategic_context: strategicContext || {
      patent_cliffs: [],
      revenue_at_risk: [],
      pipeline_gaps: [],
      strategic_priorities: [],
    },
  };

  return (
    <div className="border-t border-gray-100 dark:border-slate-700 px-3 sm:px-4 py-4 sm:py-5 bg-gradient-to-b from-gray-50/50 to-white dark:from-slate-800/50 dark:to-slate-800 animate-fade-in">
      {/* Score Progress Bar */}
      <ScoreProgressBar score={matchScore} />

      {/* Why They Match Section */}
      {detailedBreakdown && detailedBreakdown.factors.length > 0 && (
        <div className="mt-5">
          <div className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Why They Match
          </div>
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg divide-y divide-gray-100 dark:divide-slate-700">
            {detailedBreakdown.factors.slice(0, 5).map((factor, i) => (
              <div key={i} className="px-3">
                <MatchFactor factor={factor} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Watch Out Section */}
      {watchOuts && watchOuts.length > 0 && (
        <div className="mt-5">
          <div className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Watch Out For
          </div>
          <div className="space-y-2">
            {watchOuts.map((factor, i) => (
              <WatchOutItem key={i} factor={factor} />
            ))}
          </div>
        </div>
      )}

      {/* Patent Cliffs - Why They're Motivated */}
      {strategicContext?.patent_cliffs && strategicContext.patent_cliffs.length > 0 && (
        <div className="mt-5">
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-3 sm:p-4 overflow-hidden">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="text-[10px] sm:text-xs font-medium text-amber-800 dark:text-amber-300 uppercase tracking-wide truncate">
                Patent Cliffs - Why They Need Assets
              </span>
            </div>
            <div className="space-y-2">
              {strategicContext.patent_cliffs.slice(0, 3).map((cliff, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 text-sm bg-white dark:bg-slate-800 border border-amber-100 dark:border-amber-500/20 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2"
                >
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                    <Pill className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span className="font-medium text-gray-900 dark:text-white truncate text-xs sm:text-sm">
                      {cliff.drug_name}
                    </span>
                    {cliff.indication && (
                      <span className="text-gray-500 dark:text-slate-400 text-xs truncate hidden sm:inline">
                        ({cliff.indication})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
                    <span className="text-amber-700 dark:text-amber-300 font-medium text-[10px] sm:text-sm whitespace-nowrap">
                      {formatCurrency(cliff.revenue_usd)}
                    </span>
                    <span className="px-1.5 sm:px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] sm:text-xs font-medium rounded whitespace-nowrap">
                      {cliff.expiry_year}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {/* Revenue at Risk Summary */}
            {strategicContext.revenue_at_risk && strategicContext.revenue_at_risk.length > 0 && (
              <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-500/30 flex flex-wrap items-center gap-1.5 sm:gap-3 text-xs">
                <span className="text-amber-700 dark:text-amber-300 font-medium">Revenue at Risk:</span>
                {strategicContext.revenue_at_risk.map((risk, i) => (
                  <span key={i} className="text-gray-700 dark:text-slate-300">
                    {risk.year}: <strong>{formatCurrency(risk.amount)}</strong>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Deal Activity */}
      {relevantDeals && relevantDeals.length > 0 && (
        <RecentDealsSection deals={relevantDeals} maxDeals={3} />
      )}

      {/* Approach Strategy */}
      {localStrategy && (
        <ApproachStrategyCard
          strategy={localStrategy}
          companyName={companyName}
          onRegenerate={handleRegenerateStrategy}
          isRegenerating={isRegeneratingStrategy}
        />
      )}

      {/* Generate Strategy Button (if no strategy exists) */}
      {!localStrategy && detailedBreakdown && (
        <div className="mt-4">
          <button
            onClick={handleRegenerateStrategy}
            disabled={isRegeneratingStrategy}
            className="w-full py-2.5 border border-teal-200 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 font-medium rounded-lg hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isRegeneratingStrategy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Strategy...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Generate Approach Strategy
              </>
            )}
          </button>
          {strategyError && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {strategyError}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-5 flex gap-2 sm:gap-3">
        <button
          onClick={() => setShowEmailModal(true)}
          className="flex-1 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-medium rounded-lg hover:from-teal-600 hover:to-cyan-600 transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          <Mail className="w-4 h-4" />
          Draft Outreach Email
        </button>
      </div>

      {/* Email Modal */}
      <OutreachEmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        companyId={companyId}
        companyName={companyName}
        matchScore={matchScore}
        matchContext={matchContext}
        userAsset={userAsset}
        userId={userId}
        userEmail={userEmail}
        sessionId={sessionId}
        tier={tier}
      />
    </div>
  );
}

// Helper function to format currency
function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `$${(value / 1000000).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

export default ScoreBreakdown;
