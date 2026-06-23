'use client';

/**
 * Interactive results grid for the Trade Space feature.
 *
 * Displays 5 deal structure cards ranked by the optimizer, with a
 * recommendation banner when one structure is materially better.
 */

import { RiskScoreOverlay } from './RiskScoreOverlay';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface RankedDeal {
  dealType: string;
  upfrontMedian: number;
  totalDealMedian: number;
  pctVsBaseline: number;
  rank: number;
  rationale: string;
}

export interface TradeSpaceResponse {
  success: boolean;
  rankings: RankedDeal[];
  recommendation: string | null;
  recommendationStrength: 'strong' | 'moderate' | 'weak' | 'none';
  buyerPremium: { name: string; premium: number } | null;
  error?: string;
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function fmtMoney(m: number): string {
  if (m >= 1000) return `$${(m / 1000).toFixed(1)}B`;
  return `$${Math.round(m)}M`;
}

const DEAL_TYPE_COPY: Record<string, { label: string; description: string }> = {
  licensing: {
    label: 'Licensing',
    description: 'Upfront + milestones + royalties. Standard bio-pharma template.',
  },
  acquisition: {
    label: 'Acquisition',
    description: 'Cash now for full ownership. Highest upfront ratio.',
  },
  codevelopment: {
    label: 'Co-development',
    description: 'Shared R&D cost, shared upside. Lower upfront, higher retained NPV.',
  },
  option: {
    label: 'Option',
    description: 'Small option fee now + larger exercise fee after data. Probability-weighted.',
  },
  collaboration: {
    label: 'Collaboration',
    description: 'Research funding + joint milestones. Early-stage partnership.',
  },
};

function rankColor(rank: number): string {
  if (rank === 1) return 'border-teal-500/40 bg-teal-500/5';
  if (rank <= 3) return 'border-cyan-500/30 bg-cyan-500/5';
  return 'border-slate-700/50 bg-slate-900/20';
}

// ──────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────

export function InteractiveResults({ data }: { data: TradeSpaceResponse }) {
  const { rankings, recommendation, recommendationStrength, buyerPremium } = data;

  return (
    <div className="space-y-6">
      {/* Recommendation banner */}
      {recommendation && (recommendationStrength === 'strong' || recommendationStrength === 'moderate') && (
        <div className="rounded-lg border border-teal-500/30 bg-teal-500/5 p-4">
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-teal-400">
            Recommendation ({recommendationStrength})
          </div>
          <p className="text-sm text-slate-200">{recommendation}</p>
        </div>
      )}

      {/* Buyer premium badge */}
      {buyerPremium && (
        <div className="rounded border border-cyan-500/30 bg-cyan-500/5 px-4 py-2 text-sm text-cyan-300">
          <span className="font-medium">{buyerPremium.name}</span> historical premium:{' '}
          <span className="font-mono">{((buyerPremium.premium - 1) * 100).toFixed(0)}%</span> vs comparable median
        </div>
      )}

      {/* Deal structure cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {rankings.map((deal) => {
          const copy = DEAL_TYPE_COPY[deal.dealType] ?? {
            label: deal.dealType,
            description: '',
          };
          return (
            <div
              key={deal.dealType}
              className={`relative rounded-lg border p-4 transition-colors ${rankColor(deal.rank)}`}
            >
              {deal.rank === 1 && (
                <span className="absolute -top-2 right-3 rounded-full border border-teal-500/40 bg-slate-950 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-teal-400">
                  Recommended
                </span>
              )}
              <div className="mb-1 flex items-baseline justify-between">
                <h3 className="font-semibold text-slate-100">{copy.label}</h3>
                <span className="font-mono text-xs text-slate-500">#{deal.rank}</span>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-slate-500">
                {copy.description}
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Upfront</span>
                  <span className="font-mono text-slate-200">
                    {fmtMoney(deal.upfrontMedian)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total deal</span>
                  <span className="font-mono text-slate-200">
                    {fmtMoney(deal.totalDealMedian)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-800/60 pt-1.5">
                  <span className="text-slate-500">vs baseline</span>
                  <span
                    className={`font-mono ${
                      deal.pctVsBaseline >= 0 ? 'text-teal-400' : 'text-slate-400'
                    }`}
                  >
                    {deal.pctVsBaseline >= 0 ? '+' : ''}
                    {(deal.pctVsBaseline * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Risk overlay */}
              <div className="mt-3 border-t border-slate-800/60 pt-2">
                <RiskScoreOverlay dealType={deal.dealType} />
              </div>

              {/* Rationale */}
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                {deal.rationale}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
