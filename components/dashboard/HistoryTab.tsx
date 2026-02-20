import React from 'react';
import { formatDate, type CalculationHistoryItem } from '@/lib/history';

interface HistoryTabProps {
  history: CalculationHistoryItem[];
  filteredHistory: CalculationHistoryItem[];
  historyLoading: boolean;
  historySearch: string;
  historyAreaFilter: 'all' | 'oncology' | 'neurology' | 'immunology';
  historySort: 'newest' | 'oldest' | 'highest_value' | 'highest_upfront';
  onSearchChange: (value: string) => void;
  onAreaFilterChange: (value: 'all' | 'oncology' | 'neurology' | 'immunology') => void;
  onSortChange: (value: 'newest' | 'oldest' | 'highest_value' | 'highest_upfront') => void;
  onHistoryClick: (item: CalculationHistoryItem) => void;
  onDeleteHistory: (id: string) => void;
  onNavigateToCalculator: () => void;
  formatCurrency: (value: number) => string;
}

const HistoryTab = React.memo(function HistoryTab({
  history,
  filteredHistory,
  historyLoading,
  historySearch,
  historyAreaFilter,
  historySort,
  onSearchChange,
  onAreaFilterChange,
  onSortChange,
  onHistoryClick,
  onDeleteHistory,
  onNavigateToCalculator,
  formatCurrency,
}: HistoryTabProps) {
  return (
    <div id="tabpanel-history" role="tabpanel" aria-labelledby="tab-history" aria-live="polite" className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-200 dark:border-slate-700 space-y-4">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Calculation History</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">View and manage your past deal analyses</p>
        </div>

        {/* Search & Controls */}
        {history.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by phase, modality, indication..."
                value={historySearch}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Area Filter Chips */}
            <div className="flex items-center gap-1.5">
              {([['all', 'All Areas'], ['oncology', 'Oncology'], ['neurology', 'Neurology'], ['immunology', 'Immunology']] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => onAreaFilterChange(value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    historyAreaFilter === value
                      ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <select
              value={historySort}
              onChange={(e) => onSortChange(e.target.value as typeof historySort)}
              className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest_value">Highest value</option>
              <option value="highest_upfront">Highest upfront</option>
            </select>
          </div>
        )}
      </div>

      {historyLoading ? (
        <div className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-8 h-8 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-slate-500 dark:text-slate-400">Loading your calculation history...</p>
        </div>
      ) : history.length > 0 ? (
        filteredHistory.length > 0 ? (
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {filteredHistory.map((item) => (
            <div key={item.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors history-item-clickable group">
              <div
                onClick={() => onHistoryClick(item)}
                onKeyDown={(e) => e.key === 'Enter' && onHistoryClick(item)}
                role="button"
                tabIndex={0}
                aria-label={`View calculation details for ${item.labels.phase} ${item.labels.modality}`}
                className="flex items-start justify-between gap-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 rounded-lg -m-2 p-2"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-500/20 dark:to-cyan-500/20 flex items-center justify-center flex-shrink-0 group-hover:from-teal-100 group-hover:to-cyan-100 dark:group-hover:from-teal-500/30 dark:group-hover:to-cyan-500/30 transition-colors">
                    <svg className="w-6 h-6 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-slate-900 dark:text-white">{item.labels.phase}</p>
                      {item.inputs.therapeuticArea === 'neurology' && (
                        <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full">
                          Neuro
                        </span>
                      )}
                      {item.hasPDF && (
                        <span className="px-2 py-0.5 bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 text-xs font-medium rounded-full">
                          PDF
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {item.labels.modality} • {item.labels.indication}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {formatDate(item.timestamp)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Upfront</p>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(item.results.upfrontMedian)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Total Value</p>
                    <p className="font-semibold text-teal-600 dark:text-teal-400">
                      {formatCurrency(item.results.totalValueMedian)}
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteHistory(item.id); }}
                  className="text-sm text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-slate-500 dark:text-slate-400 mb-3">No calculations match your filters</p>
            <button
              onClick={() => { onSearchChange(''); onAreaFilterChange('all'); }}
              className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
            >
              Clear filters
            </button>
          </div>
        )
      ) : (
        <div className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white mb-2">No calculations yet</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4">Your calculation history will appear here</p>
          <button
            onClick={onNavigateToCalculator}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Calculation
          </button>
        </div>
      )}
    </div>
  );
});

export default HistoryTab;
