'use client';

import { useState } from 'react';
import { Filters, FilterOptions } from './DealBrowser';

interface DealFiltersProps {
  filters: Filters;
  filterOptions: FilterOptions;
  onFilterChange: (filters: Partial<Filters>) => void;
  onReset: () => void;
}

const phaseLabels: Record<string, string> = {
  discovery: 'Discovery',
  preclinical: 'Preclinical',
  phase_1: 'Phase 1',
  phase_2: 'Phase 2',
  phase_3: 'Phase 3',
  approved: 'Approved',
  unknown: 'Unknown',
};

const dealTypeLabels: Record<string, string> = {
  license: 'License',
  option: 'Option',
  collaboration: 'Collaboration',
  acquisition: 'Acquisition',
  co_development: 'Co-Development',
  co_promotion: 'Co-Promotion',
  other: 'Other',
};

export default function DealFilters({
  filters,
  filterOptions,
  onFilterChange,
  onReset,
}: DealFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters =
    filters.modality.length > 0 ||
    filters.phase.length > 0 ||
    filters.indication.length > 0 ||
    filters.dealType.length > 0 ||
    filters.minUpfront !== '' ||
    filters.maxUpfront !== '' ||
    filters.termsDisclosed ||
    filters.search !== '';

  const toggleArrayFilter = (
    key: 'modality' | 'phase' | 'indication' | 'dealType',
    value: string
  ) => {
    const current = filters[key];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFilterChange({ [key]: updated });
  };

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-soft overflow-hidden">
      {/* Search Bar */}
      <div className="p-4 border-b border-neutral-100">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search deals by asset, licensor, or licensee..."
              value={filters.search}
              onChange={(e) => onFilterChange({ search: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-sm font-medium text-neutral-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filters
            {hasActiveFilters && (
              <span className="px-1.5 py-0.5 bg-teal-500 text-white text-xs rounded-full">
                {
                  [
                    ...filters.modality,
                    ...filters.phase,
                    ...filters.indication,
                    ...filters.dealType,
                  ].length +
                  (filters.minUpfront ? 1 : 0) +
                  (filters.maxUpfront ? 1 : 0) +
                  (filters.termsDisclosed ? 1 : 0)
                }
              </span>
            )}
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="p-4 bg-neutral-50 space-y-4 animate-fade-in">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Modality Filter */}
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                Modality
              </label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {filterOptions.modalities.map((modality) => (
                  <label key={modality} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.modality.includes(modality)}
                      onChange={() => toggleArrayFilter('modality', modality)}
                      className="w-4 h-4 text-teal-500 border-neutral-300 rounded focus:ring-teal-500"
                    />
                    <span className="text-neutral-700 capitalize">
                      {modality.replace(/_/g, ' ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Phase Filter */}
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                Phase
              </label>
              <div className="space-y-1">
                {filterOptions.phases.map((phase) => (
                  <label key={phase} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.phase.includes(phase)}
                      onChange={() => toggleArrayFilter('phase', phase)}
                      className="w-4 h-4 text-teal-500 border-neutral-300 rounded focus:ring-teal-500"
                    />
                    <span className="text-neutral-700">{phaseLabels[phase] || phase}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Indication Filter */}
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                Indication
              </label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {filterOptions.indications.map((indication) => (
                  <label key={indication} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.indication.includes(indication)}
                      onChange={() => toggleArrayFilter('indication', indication)}
                      className="w-4 h-4 text-teal-500 border-neutral-300 rounded focus:ring-teal-500"
                    />
                    <span className="text-neutral-700 capitalize">
                      {indication.replace(/_/g, ' ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Deal Type Filter */}
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                Deal Type
              </label>
              <div className="space-y-1">
                {filterOptions.dealTypes.map((dealType) => (
                  <label key={dealType} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.dealType.includes(dealType)}
                      onChange={() => toggleArrayFilter('dealType', dealType)}
                      className="w-4 h-4 text-teal-500 border-neutral-300 rounded focus:ring-teal-500"
                    />
                    <span className="text-neutral-700">{dealTypeLabels[dealType] || dealType}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Financial Filters */}
          <div className="pt-4 border-t border-neutral-200">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Min Upfront ($M)
                </label>
                <input
                  type="number"
                  value={filters.minUpfront}
                  onChange={(e) => onFilterChange({ minUpfront: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Max Upfront ($M)
                </label>
                <input
                  type="number"
                  value={filters.maxUpfront}
                  onChange={(e) => onFilterChange({ maxUpfront: e.target.value })}
                  placeholder="Any"
                  className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Year Range
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={filters.yearFrom}
                    onChange={(e) => onFilterChange({ yearFrom: e.target.value })}
                    className="flex-1 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {Array.from({ length: 7 }, (_, i) => 2019 + i).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <span className="text-neutral-400">to</span>
                  <select
                    value={filters.yearTo}
                    onChange={(e) => onFilterChange({ yearTo: e.target.value })}
                    className="flex-1 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {Array.from({ length: 7 }, (_, i) => 2019 + i).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.termsDisclosed}
                    onChange={(e) => onFilterChange({ termsDisclosed: e.target.checked })}
                    className="w-4 h-4 text-teal-500 border-neutral-300 rounded focus:ring-teal-500"
                  />
                  <span className="text-neutral-700">Only deals with disclosed terms</span>
                </label>
              </div>
            </div>
          </div>

          {/* Reset Button */}
          {hasActiveFilters && (
            <div className="pt-2">
              <button
                onClick={onReset}
                className="text-sm text-teal-600 hover:text-teal-700 font-medium"
              >
                Reset all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Active Filter Tags */}
      {hasActiveFilters && !isExpanded && (
        <div className="p-3 border-t border-neutral-100 flex flex-wrap items-center gap-2">
          {filters.modality.map((m) => (
            <span
              key={m}
              className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 text-xs font-medium rounded-full"
            >
              {m.replace(/_/g, ' ')}
              <button onClick={() => toggleArrayFilter('modality', m)} className="hover:text-teal-900">
                ×
              </button>
            </span>
          ))}
          {filters.phase.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-100 text-cyan-700 text-xs font-medium rounded-full"
            >
              {phaseLabels[p] || p}
              <button onClick={() => toggleArrayFilter('phase', p)} className="hover:text-cyan-900">
                ×
              </button>
            </span>
          ))}
          {filters.indication.map((i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full"
            >
              {i.replace(/_/g, ' ')}
              <button onClick={() => toggleArrayFilter('indication', i)} className="hover:text-amber-900">
                ×
              </button>
            </span>
          ))}
          <button onClick={onReset} className="text-xs text-neutral-500 hover:text-neutral-700 ml-2">
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
