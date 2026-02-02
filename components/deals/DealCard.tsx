'use client';

import { Deal } from './DealBrowser';

interface DealCardProps {
  deal: Deal;
  tier: 'free' | 'pro';
}

const formatCurrency = (value: number | null) => {
  if (value === null) return '—';
  if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `$${(value / 1000000).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const phaseLabels: Record<string, string> = {
  discovery: 'Discovery',
  preclinical: 'Preclinical',
  phase_1: 'Phase 1',
  phase_2: 'Phase 2',
  phase_3: 'Phase 3',
  approved: 'Approved',
  unknown: 'Unknown',
};

export default function DealCard({ deal, tier }: DealCardProps) {
  const isBlurred = deal.blurred;

  return (
    <div
      className={`bg-white rounded-xl border border-neutral-200 p-4 hover:border-teal-200 hover:shadow-soft transition-all ${
        isBlurred ? 'opacity-60' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-navy-800 truncate">{deal.licensee_name}</h3>
          <p className="text-sm text-neutral-500 truncate">
            {deal.licensor_name}
          </p>
        </div>
        <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-600 rounded">
          {formatDate(deal.announced_date)}
        </span>
      </div>

      {/* Asset Name */}
      <p className="text-sm font-medium text-neutral-700 mb-3 truncate">
        {deal.asset_name || 'Undisclosed Asset'}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <span className="px-2 py-0.5 text-xs font-medium bg-teal-100 text-teal-700 rounded-full capitalize">
          {deal.modality?.replace(/_/g, ' ') || '—'}
        </span>
        <span className="px-2 py-0.5 text-xs font-medium bg-cyan-100 text-cyan-700 rounded-full">
          {phaseLabels[deal.phase_at_signing] || deal.phase_at_signing}
        </span>
        {deal.indication_category && (
          <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full capitalize">
            {deal.indication_category.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Financial Terms */}
      <div className="pt-3 border-t border-neutral-100">
        {isBlurred ? (
          <div className="flex items-center justify-center gap-2 py-2 text-neutral-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span className="text-sm font-medium">Upgrade to Pro to view</span>
          </div>
        ) : deal.terms_disclosed ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">Upfront</p>
              <p className="text-sm font-bold text-navy-800">{formatCurrency(deal.upfront_usd)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">Total Value</p>
              <p className="text-sm font-bold text-success-600">
                {formatCurrency(deal.total_deal_value_usd)}
              </p>
            </div>
            {deal.royalty_low_pct && deal.royalty_high_pct && (
              <div className="col-span-2">
                <p className="text-xs text-neutral-500 mb-0.5">Royalties</p>
                <p className="text-sm font-medium text-neutral-700">
                  {deal.royalty_low_pct}% - {deal.royalty_high_pct}%
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-neutral-400 text-center py-2">Terms Not Disclosed</p>
        )}
      </div>
    </div>
  );
}
