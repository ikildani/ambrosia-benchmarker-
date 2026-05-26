'use client';

import { Deal } from './DealBrowser';
import type { UserTier } from '@/types/tier';

interface DealTableProps {
  deals: Deal[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
  tier: UserTier;
}

const formatCurrency = (value: number | null) => {
  if (value === null) return '—';
  if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `$${(value / 1000000).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
};

const phaseLabels: Record<string, string> = {
  discovery: 'Discovery',
  preclinical: 'Preclinical',
  phase_1: 'Ph1',
  phase_2: 'Ph2',
  phase_3: 'Ph3',
  approved: 'Approved',
  unknown: '—',
};

export default function DealTable({ deals, sortBy, sortOrder, onSort, tier }: DealTableProps) {
  const SortHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <th
      scope="col"
      onClick={() => onSort(field)}
      className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-navy-800 transition-colors"
    >
      <div className="flex items-center gap-1">
        {children}
        {sortBy === field && (
          <svg
            className={`w-3 h-3 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>
    </th>
  );

  if (deals.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-neutral-200">
        <svg className="w-12 h-12 mx-auto text-neutral-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-neutral-500">No deals match your filters</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-soft overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <SortHeader field="announced_date">Date</SortHeader>
              <SortHeader field="licensee_name">Licensee</SortHeader>
              <th scope="col" className="hidden sm:table-cell px-2 sm:px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Licensor / Asset
              </th>
              <SortHeader field="modality"><span className="hidden sm:inline">Modality</span><span className="sm:hidden">Mod.</span></SortHeader>
              <SortHeader field="phase_at_signing"><span className="hidden sm:inline">Phase</span><span className="sm:hidden">Ph.</span></SortHeader>
              <SortHeader field="upfront_usd">Upfront</SortHeader>
              <SortHeader field="total_deal_value_usd">Total Value</SortHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {deals.map((deal, index) => (
              <tr
                key={deal.id}
                className={`hover:bg-neutral-50 transition-colors ${
                  deal.blurred ? 'opacity-60' : ''
                }`}
              >
                <td className="px-2 sm:px-4 py-3 text-sm text-neutral-600 whitespace-nowrap">
                  {formatDate(deal.announced_date)}
                </td>
                <td className="px-2 sm:px-4 py-3">
                  <div className="text-sm font-medium text-navy-800">{deal.licensee_name}</div>
                  <div className="sm:hidden text-xs text-neutral-500">{deal.licensor_name}</div>
                </td>
                <td className="hidden sm:table-cell px-2 sm:px-4 py-3">
                  <div className="text-sm text-neutral-700">{deal.licensor_name}</div>
                  <div className="text-xs text-neutral-500">
                    {deal.asset_name || 'Undisclosed Asset'}
                  </div>
                </td>
                <td className="px-2 sm:px-4 py-3">
                  <span className="inline-flex px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium bg-teal-100 text-teal-700 rounded-full capitalize">
                    {deal.modality?.replace(/_/g, ' ') || '—'}
                  </span>
                </td>
                <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm text-neutral-600 whitespace-nowrap">
                  {phaseLabels[deal.phase_at_signing] || deal.phase_at_signing}
                </td>
                <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium text-neutral-800 whitespace-nowrap">
                  {deal.blurred ? (
                    <span className="inline-flex items-center gap-1 text-neutral-400">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Pro Only
                    </span>
                  ) : deal.terms_disclosed ? (
                    formatCurrency(deal.upfront_usd)
                  ) : (
                    <span className="text-neutral-400">Not Disclosed</span>
                  )}
                </td>
                <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium text-success-600 whitespace-nowrap">
                  {deal.blurred ? (
                    <span className="inline-flex items-center gap-1 text-neutral-400">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Pro Only
                    </span>
                  ) : deal.terms_disclosed ? (
                    formatCurrency(deal.total_deal_value_usd)
                  ) : (
                    <span className="text-neutral-400">Not Disclosed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
