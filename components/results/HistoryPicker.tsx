'use client';

import React, { useEffect, useState } from 'react';
import { getHistory, formatDate, formatCurrency as historyFormatCurrency } from '@/lib/history';
import type { CalculationHistoryItem } from '@/lib/history';

interface HistoryPickerProps {
  onSelect: (item: CalculationHistoryItem) => void;
  onClose: () => void;
}

const taColors: Record<string, { dot: string; bg: string; text: string }> = {
  oncology: { dot: 'bg-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/20', text: 'text-rose-700 dark:text-rose-300' },
  neurology: { dot: 'bg-violet-500', bg: 'bg-violet-50 dark:bg-violet-500/20', text: 'text-violet-700 dark:text-violet-300' },
  immunology: { dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300' },
  metabolic: { dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300' },
};

const taLabels: Record<string, string> = {
  oncology: 'Oncology',
  neurology: 'Neurology',
  immunology: 'Immunology',
  metabolic: 'Metabolic',
};

function HistoryPickerInner({ onSelect, onClose }: HistoryPickerProps) {
  const [items, setItems] = useState<CalculationHistoryItem[]>([]);

  useEffect(() => {
    const history = getHistory();
    setItems(history.slice(0, 10));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col motion-safe:animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-slate-700">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Compare with Previous
            </h3>
            <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
              Select a previous analysis to compare
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-slate-300 rounded-lg hover:bg-neutral-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Close history picker"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto p-3">
          {items.length === 0 ? (
            <div className="text-center py-10">
              <svg
                className="w-12 h-12 mx-auto text-neutral-600 dark:text-slate-600 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-neutral-500 dark:text-slate-400 font-medium">
                No previous analyses to compare
              </p>
              <p className="text-xs text-neutral-400 dark:text-slate-500 mt-1">
                Run another calculation first
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const ta = item.inputs.therapeuticArea || 'oncology';
                const colors = taColors[ta] || taColors.oncology;
                const taLabel = taLabels[ta] || ta;

                return (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item)}
                    className="w-full text-left p-3.5 rounded-xl border border-neutral-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-500/50 hover:bg-teal-50/50 dark:hover:bg-teal-500/5 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {/* TA badge + Phase */}
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                            {taLabel}
                          </span>
                          <span className="text-xs font-medium text-neutral-600 dark:text-slate-300">
                            {item.labels.phase}
                          </span>
                        </div>

                        {/* Modality + Indication */}
                        <p className="text-sm font-medium text-slate-800 dark:text-white truncate">
                          {item.labels.modality}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-slate-400 truncate">
                          {item.labels.indication}
                        </p>

                        {/* Date */}
                        <p className="text-xs text-neutral-400 dark:text-slate-500 mt-1">
                          {formatDate(item.timestamp)}
                        </p>
                      </div>

                      {/* Total deal value */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-success-600 dark:text-success-400">
                          {historyFormatCurrency(item.results.totalValueMedian)}
                        </p>
                        <p className="text-xs text-neutral-400 dark:text-slate-500">
                          Total Value
                        </p>
                      </div>
                    </div>

                    {/* Hover arrow */}
                    <div className="flex justify-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm font-medium text-neutral-600 dark:text-slate-400 hover:text-neutral-800 dark:hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const HistoryPicker = React.memo(HistoryPickerInner);
HistoryPicker.displayName = 'HistoryPicker';

export default HistoryPicker;
export type { HistoryPickerProps };
