'use client';

import { useState, useCallback } from 'react';
import { Mail, User, RefreshCw, Loader2 } from 'lucide-react';
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
  sessionId?: string;
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
  sessionId,
  onRegenerateStrategy,
}: ScoreBreakdownProps) {
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isRegeneratingStrategy, setIsRegeneratingStrategy] = useState(false);
  const [localStrategy, setLocalStrategy] = useState<ApproachStrategy | null>(approachStrategy);

  const handleRegenerateStrategy = useCallback(async () => {
    if (!detailedBreakdown) return;

    setIsRegeneratingStrategy(true);
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
          session_id: sessionId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setLocalStrategy(data.approach_strategy);
      }
    } catch (error) {
      console.error('Failed to regenerate strategy:', error);
    } finally {
      setIsRegeneratingStrategy(false);
    }
  }, [companyId, companyName, matchScore, detailedBreakdown, watchOuts, strategicContext, userAsset, userId, sessionId]);

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
    <div className="border-t border-gray-100 px-4 py-5 bg-gradient-to-b from-gray-50/50 to-white animate-fade-in">
      {/* Score Progress Bar */}
      <ScoreProgressBar score={matchScore} />

      {/* Why They Match Section */}
      {detailedBreakdown && detailedBreakdown.factors.length > 0 && (
        <div className="mt-5">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Why They Match
          </div>
          <div className="bg-white border border-gray-100 rounded-lg divide-y divide-gray-100">
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
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Watch Out For
          </div>
          <div className="space-y-2">
            {watchOuts.map((factor, i) => (
              <WatchOutItem key={i} factor={factor} />
            ))}
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
        <button
          onClick={handleRegenerateStrategy}
          disabled={isRegeneratingStrategy}
          className="mt-4 w-full py-2.5 border border-teal-200 bg-teal-50 text-teal-700 font-medium rounded-lg hover:bg-teal-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
      )}

      {/* Action Buttons */}
      <div className="mt-5 flex gap-3">
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
        sessionId={sessionId}
      />
    </div>
  );
}

export default ScoreBreakdown;
