/**
 * Renders 5 deal-structure cards ranked by preference-adjusted value.
 * Highest rank uses teal accent; rank 1 gets a "RECOMMENDED" badge.
 */

import type { DealStructureOption } from '@/lib/financial/types';

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

function rankColor(rank: number, total: number): string {
  if (rank === 1) return 'border-teal-500/40 bg-teal-500/5';
  if (rank === 2) return 'border-cyan-500/30 bg-cyan-500/5';
  if (rank === total) return 'border-slate-800 bg-slate-900/30';
  return 'border-slate-700/50 bg-slate-900/20';
}

export function StructureCards({ rankings }: { rankings: DealStructureOption[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {rankings.map((opt) => {
        const copy = DEAL_TYPE_COPY[opt.dealType];
        return (
          <div
            key={opt.dealType}
            className={`relative rounded-lg border p-4 transition-colors ${rankColor(opt.rank, rankings.length)}`}
          >
            {opt.rank === 1 && (
              <span className="absolute -top-2 right-3 rounded-full border border-teal-500/40 bg-slate-950 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-teal-400">
                Recommended
              </span>
            )}
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="font-semibold text-slate-100">{copy.label}</h3>
              <span className="font-mono text-xs text-slate-500">#{opt.rank}</span>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-slate-500">{copy.description}</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Upfront</span>
                <span className="font-mono text-slate-200">{fmtMoney(opt.upfrontMedian)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total deal</span>
                <span className="font-mono text-slate-200">{fmtMoney(opt.totalDealMedian)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800/60 pt-1.5">
                <span className="text-slate-500">vs current</span>
                <span className={`font-mono ${opt.pctVsBaseline >= 0 ? 'text-teal-400' : 'text-slate-400'}`}>
                  {opt.pctVsBaseline >= 0 ? '+' : ''}{opt.pctVsBaseline.toFixed(0)}%
                </span>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">{opt.rationale}</p>
          </div>
        );
      })}
    </div>
  );
}
